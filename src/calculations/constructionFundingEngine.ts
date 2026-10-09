import {
  FullModelAssumptions,
  MonthlyCapexSchedule,
  SourcesAndUses,
} from '../types';

/**
 * Audited construction funding layer.
 *
 * Purpose:
 * 1. Keep Debt / Equity / Shareholder Loan funding explicit during construction.
 * 2. Ensure capitalized IDC is added to debt only once.
 * 3. Include both upfront and commitment fees in financing uses.
 * 4. Reconcile construction closing debt to operating opening debt at COD.
 *
 * This module intentionally does not change management assumptions. It only makes
 * the funding bridge explicit and traceable.
 */

export interface AuditedMonthlyCapexSchedule extends MonthlyCapexSchedule {
  shareholderLoanDrawdown: number;
  cumulativeShareholderLoan: number;
}

export interface AuditedSourcesAndUses extends SourcesAndUses {
  upfrontFee: number;
  commitmentFees: number;

  scheduledBaseDebtDrawdown: number;
  scheduledBaseEquityDrawdown: number;
  scheduledBaseShareholderLoanDrawdown: number;

  constructionDebtBeforeFinancingAdjustment: number;
  debtFinancingAdjustmentAtCod: number;
  constructionDebtAtCod: number;
  debtAtCodReconciliationVariance: number;

  sponsorFundingAdjustmentAtCod: number;
  baseCapexFundingVariance: number;
}

function getSpendFraction(
  curve: string,
  activeDuration: number,
  monthIdxInActive: number,
  customWeights?: number[]
): number {
  if (activeDuration <= 0) return 0;

  if (curve === 'linear') return 1 / activeDuration;

  if (curve === 'custom' && customWeights?.length === activeDuration) {
    const total = customWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    return total > 0 ? Math.max(0, customWeights[monthIdxInActive - 1]) / total : 1 / activeDuration;
  }

  const weights: number[] = [];
  for (let i = 1; i <= activeDuration; i++) {
    if (curve === 's_curve') {
      weights.push(Math.sin((Math.PI * (i - 0.5)) / activeDuration));
    } else if (curve === 'early_heavy') {
      weights.push(activeDuration - i + 1);
    } else if (curve === 'late_heavy') {
      weights.push(i);
    } else {
      weights.push(1);
    }
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? weights[monthIdxInActive - 1] / total : 1 / activeDuration;
}

export function calculateAuditedMonthlyCapex(
  assumptions: FullModelAssumptions
): AuditedMonthlyCapexSchedule[] {
  const { project, funding, capexItems } = assumptions;
  const nMonths = project.constructionPeriodMonths;
  const startDate = new Date(project.constructionStartDate);

  const debtPct = funding.bankDebtPct / 100;
  const equityPct = funding.equityPct / 100;
  const shlPct = funding.shareholderLoanPct / 100;
  const sponsorPct = equityPct + shlPct;

  const sponsorEquityMix = sponsorPct > 0 ? equityPct / sponsorPct : 0;
  const sponsorShlMix = sponsorPct > 0 ? shlPct / sponsorPct : 0;

  const totalBaseCapex = capexItems.reduce((sum, item) => sum + item.amountIdrBillion, 0);
  const totalTargetDebt = totalBaseCapex * debtPct;
  const totalTargetSponsor = totalBaseCapex * sponsorPct;

  const monthlyInterestRate = funding.bankInterestRatePct / 100 / 12;
  const drawdownOrder = funding.drawdownOrder ?? 'pro_rata';

  let cumulativeCapex = 0;
  let cumulativeDebt = 0;
  let cumulativeEquity = 0;
  let cumulativeShareholderLoan = 0;
  let runningDebt = 0;

  const schedule: AuditedMonthlyCapexSchedule[] = [];

  for (let month = 1; month <= nMonths; month++) {
    const currentMonthDate = new Date(startDate);
    currentMonthDate.setMonth(startDate.getMonth() + month - 1);
    const dateStr = currentMonthDate.toISOString().substring(0, 10);

    const itemsExpenditure: Record<string, number> = {};
    let totalCapex = 0;

    for (const item of capexItems) {
      if (month < item.startMonth || month > item.endMonth) {
        itemsExpenditure[item.id] = 0;
        continue;
      }

      const activeDuration = item.endMonth - item.startMonth + 1;
      const monthIdxInActive = month - item.startMonth + 1;
      const fraction = getSpendFraction(item.curve, activeDuration, monthIdxInActive, item.customWeights);
      const spend = item.amountIdrBillion * fraction;
      itemsExpenditure[item.id] = spend;
      totalCapex += spend;
    }

    cumulativeCapex += totalCapex;
    const cumulativeCapexPct = totalBaseCapex > 0 ? (cumulativeCapex / totalBaseCapex) * 100 : 0;

    let debtDrawdown = 0;
    let sponsorDrawdown = 0;

    if (drawdownOrder === 'equity_first') {
      const sponsorAlreadyFunded = cumulativeEquity + cumulativeShareholderLoan;
      const remainingSponsor = Math.max(0, totalTargetSponsor - sponsorAlreadyFunded);
      sponsorDrawdown = Math.min(totalCapex, remainingSponsor);
      debtDrawdown = totalCapex - sponsorDrawdown;
    } else if (drawdownOrder === 'debt_first') {
      const remainingDebt = Math.max(0, totalTargetDebt - cumulativeDebt);
      debtDrawdown = Math.min(totalCapex, remainingDebt);
      sponsorDrawdown = totalCapex - debtDrawdown;
    } else {
      debtDrawdown = totalCapex * debtPct;
      sponsorDrawdown = totalCapex * sponsorPct;
    }

    const equityDrawdown = sponsorDrawdown * sponsorEquityMix;
    const shareholderLoanDrawdown = sponsorDrawdown * sponsorShlMix;

    cumulativeDebt += debtDrawdown;
    cumulativeEquity += equityDrawdown;
    cumulativeShareholderLoan += shareholderLoanDrawdown;

    const totalDisbursement = debtDrawdown + equityDrawdown + shareholderLoanDrawdown;
    const cashVariance = Math.abs(totalDisbursement - totalCapex);
    const undrawnDebt = Math.max(0, totalTargetDebt - cumulativeDebt);
    const commitmentFee = undrawnDebt * ((funding.commitmentFeePct ?? 0) / 100 / 12);

    const openingDebt = runningDebt;
    const monthlyInterest = openingDebt * monthlyInterestRate;

    const idcCapitalized = funding.idcMode === 'capitalized' ? monthlyInterest : 0;
    const idcPaid = funding.idcMode === 'paid' ? monthlyInterest : 0;

    // Capitalized IDC is added once here. Paid IDC never increases debt outstanding.
    runningDebt = openingDebt + debtDrawdown + idcCapitalized;

    schedule.push({
      month,
      dateStr,
      itemsExpenditure,
      totalCapex,
      cumulativeCapex,
      cumulativeCapexPct,
      debtDrawdown,
      equityDrawdown,
      shareholderLoanDrawdown,
      totalDisbursement,
      cumulativeDebt,
      cumulativeEquity,
      cumulativeShareholderLoan,
      undrawnDebt,
      commitmentFee,
      openingDebt,
      monthlyInterest,
      idcCapitalized,
      idcPaid,
      closingDebt: runningDebt,
      cashVariance,
    });
  }

  return schedule;
}

export function calculateAuditedSourcesAndUses(
  assumptions: FullModelAssumptions,
  monthlySchedule: AuditedMonthlyCapexSchedule[]
): AuditedSourcesAndUses {
  const { funding, capexItems } = assumptions;

  let epcCivil = 0;
  let electroMechanical = 0;
  let transmission = 0;
  let developmentCost = 0;
  let preOperatingCost = 0;
  let ownersCost = 0;
  let contingency = 0;
  let initialWorkingCapital = 0;

  for (const item of capexItems) {
    switch (item.category) {
      case 'civil':
      case 'material_civil':
        epcCivil += item.amountIdrBillion;
        break;
      case 'em':
      case 'material_em':
        electroMechanical += item.amountIdrBillion;
        break;
      case 'transmission':
        transmission += item.amountIdrBillion;
        break;
      case 'dev':
        developmentCost += item.amountIdrBillion;
        break;
      case 'pre_op':
        preOperatingCost += item.amountIdrBillion;
        break;
      case 'owners':
        ownersCost += item.amountIdrBillion;
        break;
      case 'contingency':
        contingency += item.amountIdrBillion;
        break;
      case 'working_capital':
        initialWorkingCapital += item.amountIdrBillion;
        break;
      default:
        epcCivil += item.amountIdrBillion;
        break;
    }
  }

  const baseCapexTotal =
    epcCivil +
    electroMechanical +
    transmission +
    developmentCost +
    preOperatingCost +
    ownersCost +
    contingency +
    initialWorkingCapital;

  const scheduledBaseDebtDrawdown = monthlySchedule.reduce((sum, row) => sum + row.debtDrawdown, 0);
  const scheduledBaseEquityDrawdown = monthlySchedule.reduce((sum, row) => sum + row.equityDrawdown, 0);
  const scheduledBaseShareholderLoanDrawdown = monthlySchedule.reduce(
    (sum, row) => sum + row.shareholderLoanDrawdown,
    0
  );

  const commitmentFees = monthlySchedule.reduce((sum, row) => sum + row.commitmentFee, 0);
  const upfrontFee = scheduledBaseDebtDrawdown * (funding.upfrontFeePct / 100);
  const financingFees = upfrontFee + commitmentFees;

  const idcTotal = monthlySchedule.reduce(
    (sum, row) => sum + (funding.idcMode === 'capitalized' ? row.idcCapitalized : row.idcPaid),
    0
  );

  const dsraPreFunding = 0;
  const totalUses = baseCapexTotal + financingFees + idcTotal + dsraPreFunding;

  const debtPct = funding.bankDebtPct / 100;
  const sponsorPct = (funding.equityPct + funding.shareholderLoanPct) / 100;
  const sponsorEquityMix = sponsorPct > 0 ? (funding.equityPct / 100) / sponsorPct : 0;
  const sponsorShlMix = sponsorPct > 0 ? (funding.shareholderLoanPct / 100) / sponsorPct : 0;

  // Capitalized IDC is already debt by definition, so it is not multiplied by gearing again.
  // Paid IDC is an ordinary funding use and follows the selected funding ratio.
  const incrementalDebtFunding =
    funding.idcMode === 'capitalized'
      ? idcTotal + financingFees * debtPct
      : (idcTotal + financingFees) * debtPct;

  const bankLoanAmount = scheduledBaseDebtDrawdown + incrementalDebtFunding;
  const totalSponsorFunding = totalUses - bankLoanAmount;
  const equityAmount = totalSponsorFunding * sponsorEquityMix;
  const shareholderLoanAmount = totalSponsorFunding * sponsorShlMix;

  const totalSources = bankLoanAmount + equityAmount + shareholderLoanAmount;
  const variance = Math.abs(totalSources - totalUses);

  const constructionDebtBeforeFinancingAdjustment = monthlySchedule.length
    ? monthlySchedule[monthlySchedule.length - 1].closingDebt
    : 0;

  const debtFinancingAdjustmentAtCod = bankLoanAmount - constructionDebtBeforeFinancingAdjustment;
  const constructionDebtAtCod = constructionDebtBeforeFinancingAdjustment + debtFinancingAdjustmentAtCod;
  const debtAtCodReconciliationVariance = Math.abs(constructionDebtAtCod - bankLoanAmount);

  const scheduledSponsorFunding = scheduledBaseEquityDrawdown + scheduledBaseShareholderLoanDrawdown;
  const sponsorFundingAdjustmentAtCod = totalSponsorFunding - scheduledSponsorFunding;

  const scheduledBaseFunding =
    scheduledBaseDebtDrawdown + scheduledBaseEquityDrawdown + scheduledBaseShareholderLoanDrawdown;
  const baseCapexFundingVariance = Math.abs(scheduledBaseFunding - baseCapexTotal);

  return {
    epcCivil,
    electroMechanical,
    transmission,
    developmentCost,
    preOperatingCost,
    ownersCost,
    contingency,
    initialWorkingCapital,
    baseCapexTotal,
    financingFees,
    idcTotal,
    dsraPreFunding,
    totalUses,
    bankLoanAmount,
    equityAmount,
    shareholderLoanAmount,
    totalSources,
    variance,
    isBalanced:
      variance < 0.001 &&
      debtAtCodReconciliationVariance < 0.001 &&
      baseCapexFundingVariance < 0.001,

    upfrontFee,
    commitmentFees,
    scheduledBaseDebtDrawdown,
    scheduledBaseEquityDrawdown,
    scheduledBaseShareholderLoanDrawdown,
    constructionDebtBeforeFinancingAdjustment,
    debtFinancingAdjustmentAtCod,
    constructionDebtAtCod,
    debtAtCodReconciliationVariance,
    sponsorFundingAdjustmentAtCod,
    baseCapexFundingVariance,
  };
}

export interface ConstructionFundingChecks {
  sourcesUsesBalanced: boolean;
  baseCapexFullyFunded: boolean;
  debtAtCodReconciled: boolean;
  noMonthlyCapexFundingGap: boolean;
  maxMonthlyCapexFundingGap: number;
}

export function runConstructionFundingChecks(
  monthlySchedule: AuditedMonthlyCapexSchedule[],
  sourcesAndUses: AuditedSourcesAndUses
): ConstructionFundingChecks {
  const maxMonthlyCapexFundingGap = monthlySchedule.reduce(
    (maxGap, row) => Math.max(maxGap, Math.abs(row.totalDisbursement - row.totalCapex)),
    0
  );

  return {
    sourcesUsesBalanced: Math.abs(sourcesAndUses.totalSources - sourcesAndUses.totalUses) < 0.001,
    baseCapexFullyFunded: sourcesAndUses.baseCapexFundingVariance < 0.001,
    debtAtCodReconciled: sourcesAndUses.debtAtCodReconciliationVariance < 0.001,
    noMonthlyCapexFundingGap: maxMonthlyCapexFundingGap < 0.001,
    maxMonthlyCapexFundingGap,
  };
}
