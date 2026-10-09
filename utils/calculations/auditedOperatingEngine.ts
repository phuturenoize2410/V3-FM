import {
  AnnualOperatingRow,
  DebtScheduleRow,
  FullModelAssumptions,
  SourcesAndUses,
} from '../types';
import { calculateAnnualOperatingModel } from './financialEngine';
import { calculateAuditedTaxSchedule, TaxYearInput } from './taxEngine';

/**
 * Audited operating/debt layer.
 *
 * This module resolves the key circular dependency in project finance sculpting:
 * debt service -> interest -> cash tax -> CFADS -> sculpted debt service.
 * It does so by iterating the debt schedule and operating model until debt service
 * converges. Non-sculpted debt does not require iteration.
 */

export interface AuditedOperatingResult {
  debtSchedule: DebtScheduleRow[];
  annualRows: AnnualOperatingRow[];
  iterations: number;
  converged: boolean;
  maxDebtServiceDelta: number;
}

function buildDebtSchedule(
  assumptions: FullModelAssumptions,
  initialDebt: number,
  cfadsForSculpting?: number[]
): DebtScheduleRow[] {
  const { project, funding } = assumptions;
  const repaymentYears = Math.max(1, funding.repaymentPeriodYears);
  const rate = Math.max(0, funding.bankInterestRatePct / 100);
  const startYear = new Date(project.codDate).getFullYear();
  const targetDscr = Math.max(0.01, funding.targetDscrForSculpting ?? 1.30);
  const schedule: DebtScheduleRow[] = [];

  const annuityAnnualPayment =
    funding.amortizationType === 'annuity'
      ? rate > 0
        ? initialDebt * (rate / (1 - Math.pow(1 + rate, -repaymentYears)))
        : initialDebt / repaymentYears
      : 0;

  let balance = initialDebt;

  for (let yr = 1; yr <= project.operatingPeriodYears; yr++) {
    const openingBalance = balance;
    const isUnderLoanLife = yr <= repaymentYears && openingBalance > 0.000001;
    const interestExpense = isUnderLoanLife ? openingBalance * rate : 0;
    let principalRepayment = 0;

    if (isUnderLoanLife) {
      if (funding.amortizationType === 'equal_principal') {
        principalRepayment = Math.min(openingBalance, initialDebt / repaymentYears);
      } else if (funding.amortizationType === 'annuity') {
        principalRepayment = Math.min(
          openingBalance,
          Math.max(0, annuityAnnualPayment - interestExpense)
        );
      } else {
        const cfads = Math.max(0, cfadsForSculpting?.[yr - 1] ?? 0);
        const targetDebtService = cfads / targetDscr;
        principalRepayment = Math.min(
          openingBalance,
          Math.max(0, targetDebtService - interestExpense)
        );
      }
      if (yr === repaymentYears) principalRepayment = openingBalance;
    }

    const totalDebtService = principalRepayment + interestExpense;
    balance = Math.max(0, openingBalance - principalRepayment);

    schedule.push({
      year: yr,
      dateStr: `${startYear + yr - 1}-06-30`,
      isOperating: true,
      openingBalance,
      drawdown: 0,
      capitalizedIdc: 0,
      interestExpense,
      principalRepayment,
      totalDebtService,
      closingBalance: balance,
    });
  }

  return schedule;
}

function applyAuditedTaxAndCashFlow(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  debtSchedule: DebtScheduleRow[]
): AnnualOperatingRow[] {
  const baseRows = calculateAnnualOperatingModel(assumptions, sourcesAndUses, debtSchedule);

  // The base operating engine already derives PBT as EBIT less the supplied debt
  // schedule interest. Feed that PBT directly into the fiscal bridge; do not deduct
  // interest a second time in either the tax schedule or the displayed audited P&L.
  const taxInputs: TaxYearInput[] = baseRows.map((row) => ({
    year: row.year,
    accountingPbt: row.ebtIdrBillion,
    accountingDepreciation: row.accountingDepreciation,
    fiscalDepreciation: row.fiscalDepreciation,
  }));
  const auditedTax = calculateAuditedTaxSchedule(assumptions, taxInputs);

  const rows: AnnualOperatingRow[] = [];
  let currentDsra = sourcesAndUses.dsraPreFunding;
  let currentCash = 0;
  let retainedEarnings = 0;
  let currentWorkingCapital = sourcesAndUses.initialWorkingCapital;
  const cashBuffer = assumptions.funding.minimumCashBufferBillion;

  for (let i = 0; i < baseRows.length; i++) {
    const base = baseRows[i];
    const tax = auditedTax[i];
    const debt = debtSchedule[i];

    const workingCapitalChange =
      i === 0 ? 0 : (base.revenueIdrBillion - baseRows[i - 1].revenueIdrBillion) * 0.05;
    currentWorkingCapital += workingCapitalChange;

    const cashTax = tax.cashTax;
    const cfads = base.ebitdaIdrBillion - cashTax - workingCapitalChange;
    const debtService = debt.totalDebtService;
    const dscr = debtService > 0.000001 ? cfads / debtService : null;

    const nextDebtService = debtSchedule[i + 1]?.totalDebtService ?? 0;
    const requiredDsra = (nextDebtService * assumptions.funding.dsraRequirementMonths) / 12;
    const openingDsra = currentDsra;
    const dsraFunding = Math.max(0, requiredDsra - openingDsra);
    const dsraRelease = Math.max(0, openingDsra - requiredDsra);
    currentDsra = openingDsra + dsraFunding - dsraRelease;
    const dsraMovement = dsraFunding - dsraRelease;

    const cashBeginningBalance = currentCash;
    const cashBeforeDistribution =
      cashBeginningBalance + cfads - debtService - dsraFunding + dsraRelease;
    const dividendsPaid = Math.max(0, cashBeforeDistribution - cashBuffer);
    currentCash = cashBeforeDistribution - dividendsPaid;
    const cashEndingBalance = currentCash;
    const netChangeInCash = cashEndingBalance - cashBeginningBalance;

    const netIncome = base.ebtIdrBillion - cashTax;
    retainedEarnings += netIncome - dividendsPaid;

    const bsCash = cashEndingBalance;
    const bsDsra = currentDsra;
    const bsWorkingCapital = currentWorkingCapital;
    const bsPpeNbv = base.bsPpeNbv;
    const bsTotalAssets = bsCash + bsDsra + bsWorkingCapital + bsPpeNbv;
    const bsDebt = debt.closingBalance;
    const bsShareCapital = sourcesAndUses.equityAmount + sourcesAndUses.shareholderLoanAmount;
    const bsRetainedEarnings = retainedEarnings;
    const bsTotalLiabEquity = bsDebt + bsShareCapital + bsRetainedEarnings;
    const bsDifference = Math.abs(bsTotalAssets - bsTotalLiabEquity);

    rows.push({
      ...base,
      interestExpense: debt.interestExpense,
      ebtIdrBillion: base.ebtIdrBillion,
      taxLossOpening: tax.openingTaxLosses,
      taxLossGenerated: tax.taxLossGenerated,
      taxLossUtilized: tax.taxLossUtilized,
      taxLossClosing: tax.closingTaxLosses,
      taxableIncome: tax.taxableIncome,
      corporateTax: cashTax,
      effectiveTaxRatePct: tax.effectiveCashTaxRatePct,
      netIncomeIdrBillion: netIncome,
      cfadsIdrBillion: cfads,
      principalRepayment: debt.principalRepayment,
      interestPayment: debt.interestExpense,
      debtServiceIdrBillion: debtService,
      dscr,
      requiredDsra,
      openingDsra,
      dsraFunding,
      dsraRelease,
      closingDsra: currentDsra,
      workingCapitalChange,
      workingCapitalClosing: bsWorkingCapital,
      cashBeforeDistribution,
      dividendsPaid,
      closingCashBuffer: bsCash,
      equityCashFlow: dividendsPaid,
      projectFreeCashFlow: cfads,
      bsCash,
      bsDsra,
      bsWorkingCapital,
      bsTotalAssets,
      bsDebt,
      bsRetainedEarnings,
      bsShareCapital,
      bsTotalLiabEquity,
      bsDifference,
      cfads,
      debtPrincipalRepayment: debt.principalRepayment,
      debtInterestExpense: debt.interestExpense,
      debtOpeningBalance: debt.openingBalance,
      taxLossCarriedForward: tax.closingTaxLosses,
      openingDebt: debt.openingBalance,
      closingDebt: debt.closingBalance,
      incomeTaxIdrBillion: cashTax,
      bsCashAndCashEquivalents: bsCash,
      bsDsraBalance: bsDsra,
      bsWorkingCapitalReceivables: bsWorkingCapital,
      totalAssets: bsTotalAssets,
      closingDebtBalance: bsDebt,
      totalLiabilities: bsDebt,
      retainedEarningsEnding: bsRetainedEarnings,
      totalEquity: bsShareCapital + bsRetainedEarnings,
      totalLiabilitiesAndEquity: bsTotalLiabEquity,
      balanceSheetDifference: bsDifference,
      operatingCashFlow: cfads,
      totalDebtService: debtService,
      dsraMovement,
      dividendsDistributed: dividendsPaid,
      fcffIdrBillion: cfads,
      fcfeIdrBillion: dividendsPaid,
      financingCashFlow: -(debt.principalRepayment + debt.interestExpense + dividendsPaid),
      netChangeInCash,
      cashBeginningBalance,
      cashEndingBalance,
    });
  }

  const loanRate = Math.max(0, assumptions.funding.bankInterestRatePct / 100);
  const loanLife = Math.min(assumptions.funding.repaymentPeriodYears, rows.length);
  for (let i = 0; i < rows.length; i++) {
    const openingDebt = debtSchedule[i].openingBalance;
    if (i < loanLife && openingDebt > 0.000001) {
      let npvCfads = 0;
      for (let k = i; k < loanLife; k++) {
        npvCfads += rows[k].cfadsIdrBillion / Math.pow(1 + loanRate, k - i + 1);
      }
      rows[i].llcr = (npvCfads + rows[i].openingDsra) / openingDebt;
    } else {
      rows[i].llcr = null;
    }
  }

  return rows;
}

export function calculateAuditedDebtAndOperations(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  maxIterations = 30,
  tolerance = 0.0001
): AuditedOperatingResult {
  const auditedSourcesAndUses = sourcesAndUses as SourcesAndUses & {
    constructionDebtAtCod?: number;
  };
  const initialDebt = Number.isFinite(auditedSourcesAndUses.constructionDebtAtCod)
    ? (auditedSourcesAndUses.constructionDebtAtCod as number)
    : sourcesAndUses.bankLoanAmount;

  if (assumptions.funding.amortizationType !== 'sculpted') {
    const debtSchedule = buildDebtSchedule(assumptions, initialDebt);
    const annualRows = applyAuditedTaxAndCashFlow(assumptions, sourcesAndUses, debtSchedule);
    return {
      debtSchedule,
      annualRows,
      iterations: 1,
      converged: true,
      maxDebtServiceDelta: 0,
    };
  }

  let debtSchedule = buildDebtSchedule(assumptions, initialDebt);
  let annualRows = applyAuditedTaxAndCashFlow(assumptions, sourcesAndUses, debtSchedule);
  let maxDebtServiceDelta = Number.POSITIVE_INFINITY;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const cfads = annualRows.map((row) => row.cfadsIdrBillion);
    const nextDebt = buildDebtSchedule(assumptions, initialDebt, cfads);
    const nextAnnual = applyAuditedTaxAndCashFlow(assumptions, sourcesAndUses, nextDebt);

    maxDebtServiceDelta = nextDebt.reduce(
      (maxDelta, row, index) =>
        Math.max(maxDelta, Math.abs(row.totalDebtService - debtSchedule[index].totalDebtService)),
      0
    );

    debtSchedule = nextDebt;
    annualRows = nextAnnual;

    if (maxDebtServiceDelta < tolerance) {
      return {
        debtSchedule,
        annualRows,
        iterations: iteration,
        converged: true,
        maxDebtServiceDelta,
      };
    }
  }

  return {
    debtSchedule,
    annualRows,
    iterations: maxIterations,
    converged: false,
    maxDebtServiceDelta,
  };
}
