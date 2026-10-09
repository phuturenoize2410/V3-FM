import {
  AnnualOperatingRow,
  DebtScheduleRow,
  FullModelAssumptions,
  ModelCheckItem,
  SourcesAndUses,
} from '../types';
import { AuditedSourcesAndUses } from './constructionFundingEngine';

const TOL = 0.001;
type AuditedSources = SourcesAndUses & Partial<AuditedSourcesAndUses>;

/**
 * Reconciliation checks for the audited live project-finance pipeline.
 *
 * These checks validate identities produced by the audited construction, tax,
 * CFADS, debt, DSRA and LLCR layers. They deliberately do not infer unresolved
 * commercial assumptions such as shareholder-loan debt/equity classification.
 */
export function runAuditedModelChecks(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  debtSchedule: DebtScheduleRow[],
  annualRows: AnnualOperatingRow[]
): ModelCheckItem[] {
  const checks: ModelCheckItem[] = [];
  const audited = sourcesAndUses as AuditedSources;
  const repaymentYears = Math.max(1, assumptions.funding.repaymentPeriodYears);
  const loanLife = Math.min(repaymentYears, annualRows.length, debtSchedule.length);

  const sourcesUsesDiff = Math.abs(sourcesAndUses.totalSources - sourcesAndUses.totalUses);
  checks.push({
    id: 'chk_sources_uses', name: 'Sources = Uses Balance', category: 'funding',
    passed: sourcesUsesDiff < TOL,
    valueDescription: `Difference: ${sourcesUsesDiff.toFixed(6)} IDR B`, tolerance: TOL, delta: sourcesUsesDiff,
    details: 'Audited total funding sources must equal total project uses.',
  });

  if (Number.isFinite(audited.baseCapexFundingVariance)) {
    const variance = Math.abs(audited.baseCapexFundingVariance as number);
    checks.push({
      id: 'chk_construction_base_funding', name: 'Construction Base CAPEX Fully Funded', category: 'funding',
      passed: variance < TOL, valueDescription: `Funding gap: ${variance.toFixed(6)} IDR B`, tolerance: TOL, delta: variance,
      details: 'Scheduled Debt + Equity + Shareholder Loan construction drawdowns must fund base CAPEX exactly.',
    });
  }

  if (Number.isFinite(audited.debtAtCodReconciliationVariance)) {
    const variance = Math.abs(audited.debtAtCodReconciliationVariance as number);
    checks.push({
      id: 'chk_debt_at_cod', name: 'Construction Debt at COD Reconciliation', category: 'debt',
      passed: variance < TOL, valueDescription: `COD debt variance: ${variance.toFixed(6)} IDR B`, tolerance: TOL, delta: variance,
      details: 'Construction closing debt plus explicit financing adjustment must reconcile to senior debt opening at COD.',
    });
  }

  const maxBsDiff = annualRows.reduce((max, row) => Math.max(max, Math.abs(row.bsDifference)), 0);
  checks.push({
    id: 'chk_balance_sheet', name: 'Balance Sheet Balance (Assets = Liab + Equity)', category: 'balance_sheet',
    passed: maxBsDiff < TOL, valueDescription: `Max difference: ${maxBsDiff.toFixed(6)} IDR B`, tolerance: TOL, delta: maxBsDiff,
    details: 'Any balance-sheet residual remains visible; unresolved Shareholder Loan classification is not hidden by this check.',
  });

  const maxDebtReconErr = debtSchedule.reduce((max, row) => {
    const expected = row.openingBalance + row.drawdown + row.capitalizedIdc - row.principalRepayment;
    return Math.max(max, Math.abs(row.closingBalance - expected));
  }, 0);
  checks.push({
    id: 'chk_debt_reconciliation', name: 'Senior Debt Roll-Forward', category: 'debt',
    passed: maxDebtReconErr < TOL, valueDescription: `Max roll-forward error: ${maxDebtReconErr.toFixed(6)} IDR B`, tolerance: TOL, delta: maxDebtReconErr,
    details: 'Opening Debt + Drawdown + Capitalized IDC - Principal Repayment = Closing Debt.',
  });

  const closingAtMaturity = debtSchedule[repaymentYears - 1]?.closingBalance ?? 0;
  checks.push({
    id: 'chk_debt_maturity_zero', name: 'Senior Debt at Contractual Maturity = 0', category: 'debt',
    passed: Math.abs(closingAtMaturity) < TOL,
    valueDescription: `Year ${repaymentYears} closing debt: ${closingAtMaturity.toFixed(6)} IDR B`, tolerance: TOL,
    delta: Math.abs(closingAtMaturity), details: 'The final contractual repayment year must clear the remaining senior debt balance.',
  });

  const minDebtBalance = debtSchedule.reduce((min, row) => Math.min(min, row.closingBalance), 0);
  checks.push({
    id: 'chk_no_negative_debt', name: 'No Negative Senior Debt Balance', category: 'debt',
    passed: minDebtBalance >= -TOL, valueDescription: `Minimum closing debt: ${minDebtBalance.toFixed(6)} IDR B`, tolerance: TOL,
    delta: Math.min(0, minDebtBalance), details: 'Senior debt outstanding cannot fall below zero.',
  });

  const fundingSum = assumptions.funding.bankDebtPct + assumptions.funding.equityPct + assumptions.funding.shareholderLoanPct;
  const fundingDiff = Math.abs(fundingSum - 100);
  checks.push({
    id: 'chk_funding_split_100', name: 'Funding Percentage Split = 100%', category: 'funding',
    passed: fundingDiff < TOL, valueDescription: `Debt + Equity + SHL = ${fundingSum.toFixed(3)}%`, tolerance: TOL, delta: fundingDiff,
    details: 'Funding percentages must sum to 100%; this does not decide the accounting classification of Shareholder Loan.',
  });

  const theoreticalMaxGwh = assumptions.project.installedCapacityMW * 8.76;
  const generationValues = annualRows.map((row) => row.netGenerationGWh);
  const minGeneration = generationValues.length ? Math.min(...generationValues) : 0;
  const maxGeneration = generationValues.length ? Math.max(...generationValues) : 0;
  const generationValid = generationValues.length > 0 && minGeneration > 0 && maxGeneration <= theoreticalMaxGwh + TOL;
  checks.push({
    id: 'chk_generation_valid', name: 'Net Generation Sanity Check', category: 'generation', passed: generationValid,
    valueDescription: `${minGeneration.toFixed(2)} - ${maxGeneration.toFixed(2)} GWh/year`, tolerance: TOL,
    delta: generationValid ? 0 : 1,
    details: 'Net generation must be positive and cannot exceed installed-capacity theoretical annual output.',
  });

  let maxDscrFormulaError = 0;
  const debtLifeDscrs: number[] = [];
  for (let i = 0; i < loanLife; i++) {
    const row = annualRows[i];
    const debtService = debtSchedule[i]?.totalDebtService ?? 0;
    if (debtService > 0.000001) {
      const expected = row.cfadsIdrBillion / debtService;
      if (row.dscr !== null) {
        maxDscrFormulaError = Math.max(maxDscrFormulaError, Math.abs(row.dscr - expected));
        debtLifeDscrs.push(row.dscr);
      } else {
        maxDscrFormulaError = Number.POSITIVE_INFINITY;
      }
    }
  }
  const minDscr = debtLifeDscrs.length ? Math.min(...debtLifeDscrs) : 0;
  checks.push({
    id: 'chk_dscr_formula', name: 'DSCR = CFADS / Senior Debt Service', category: 'debt',
    passed: debtLifeDscrs.length > 0 && maxDscrFormulaError < TOL,
    valueDescription: `Max formula error: ${Number.isFinite(maxDscrFormulaError) ? maxDscrFormulaError.toFixed(6) : 'N/A'} | Min DSCR: ${minDscr.toFixed(2)}x`,
    tolerance: TOL, delta: maxDscrFormulaError,
    details: 'DSCR is independently recomputed from audited CFADS and actual principal + interest debt service.',
  });

  if (assumptions.funding.amortizationType === 'sculpted') {
    const targetDscr = Math.max(0.01, assumptions.funding.targetDscrForSculpting ?? 1.30);
    let maxFixedPointResidual = 0;
    for (let i = 0; i < loanLife; i++) {
      const debt = debtSchedule[i];
      const cfads = Math.max(0, annualRows[i]?.cfadsIdrBillion ?? 0);
      if (!debt || debt.openingBalance <= 0.000001) continue;

      const isFinalRepaymentYear = i === repaymentYears - 1;
      const expectedPrincipal = isFinalRepaymentYear
        ? debt.openingBalance
        : Math.min(debt.openingBalance, Math.max(0, cfads / targetDscr - debt.interestExpense));
      const expectedDebtService = expectedPrincipal + debt.interestExpense;
      maxFixedPointResidual = Math.max(maxFixedPointResidual, Math.abs(debt.totalDebtService - expectedDebtService));
    }
    checks.push({
      id: 'chk_sculpting_convergence', name: 'Debt Sculpting Fixed-Point Convergence', category: 'debt',
      passed: maxFixedPointResidual < TOL,
      valueDescription: `Max fixed-point residual: ${maxFixedPointResidual.toFixed(6)} IDR B`,
      tolerance: TOL, delta: maxFixedPointResidual,
      details: 'Final sculpted debt service is independently re-applied to audited CFADS and target DSCR. A residual above tolerance means the debt-service / interest / tax / CFADS fixed point is not reconciled.',
    });
  } else {
    checks.push({
      id: 'chk_sculpting_convergence', name: 'Debt Sculpting Fixed-Point Convergence', category: 'debt', passed: true,
      valueDescription: 'Not applicable — amortization is not sculpted', tolerance: TOL, delta: 0,
      details: 'Equal-principal and annuity repayment do not require the CFADS-driven sculpting fixed-point iteration.',
    });
  }

  const hasNegativeTaxLoss = annualRows.some((row) => row.taxLossClosing < -TOL);
  checks.push({
    id: 'chk_tax_loss_non_negative', name: 'Tax Loss Carry-Forward Integrity', category: 'tax', passed: !hasNegativeTaxLoss,
    valueDescription: hasNegativeTaxLoss ? 'Negative tax-loss balance detected' : 'All closing tax-loss balances >= 0',
    tolerance: TOL, delta: hasNegativeTaxLoss ? -1 : 0,
    details: 'Tax-loss vintages may be utilized or expire, but aggregate closing tax losses cannot be negative.',
  });

  const citRate = assumptions.tax.corporateIncomeTaxRatePct / 100;
  const maxCashTaxError = annualRows.reduce((max, row) => {
    const expected = Math.max(0, row.taxableIncome) * citRate;
    return Math.max(max, Math.abs(row.corporateTax - expected));
  }, 0);
  checks.push({
    id: 'chk_cash_tax_formula', name: 'Cash Tax = Fiscal Taxable Income × CIT', category: 'tax',
    passed: maxCashTaxError < TOL, valueDescription: `Max cash-tax formula error: ${maxCashTaxError.toFixed(6)} IDR B`, tolerance: TOL,
    delta: maxCashTaxError,
    details: 'Cash tax is checked against fiscal taxable income after fiscal depreciation adjustments and tax-loss utilization.',
  });

  const maxCfadsError = annualRows.reduce((max, row) => {
    const expected = row.ebitdaIdrBillion - row.corporateTax - row.workingCapitalChange;
    return Math.max(max, Math.abs(row.cfadsIdrBillion - expected));
  }, 0);
  checks.push({
    id: 'chk_cfads_bridge', name: 'Explicit CFADS Bridge', category: 'cash_flow', passed: maxCfadsError < TOL,
    valueDescription: `Max CFADS bridge error: ${maxCfadsError.toFixed(6)} IDR B`, tolerance: TOL, delta: maxCfadsError,
    details: 'Current model CFADS = EBITDA - cash tax - change in working capital. No sustaining CAPEX is deducted because no explicit sustaining-CAPEX driver exists yet.',
  });

  let maxDsraRequirementError = 0;
  let maxDsraRollForwardError = 0;
  let minDsra = 0;
  for (let i = 0; i < annualRows.length; i++) {
    const row = annualRows[i];
    const nextDebtService = debtSchedule[i + 1]?.totalDebtService ?? 0;
    const expectedRequired = (nextDebtService * assumptions.funding.dsraRequirementMonths) / 12;
    maxDsraRequirementError = Math.max(maxDsraRequirementError, Math.abs(row.requiredDsra - expectedRequired));
    const expectedClosing = row.openingDsra + row.dsraFunding - row.dsraRelease;
    maxDsraRollForwardError = Math.max(maxDsraRollForwardError, Math.abs(row.closingDsra - expectedClosing));
    minDsra = Math.min(minDsra, row.closingDsra);
  }
  const dsraError = Math.max(maxDsraRequirementError, maxDsraRollForwardError, Math.max(0, -minDsra));
  checks.push({
    id: 'chk_dsra_forward_reconciliation', name: 'DSRA Forward Requirement & Roll-Forward', category: 'debt',
    passed: dsraError < TOL, valueDescription: `Max DSRA error: ${dsraError.toFixed(6)} IDR B`, tolerance: TOL, delta: dsraError,
    details: 'DSRA requirement is based on next-period senior debt service and reconciles Opening + Funding - Release = Closing.',
  });

  const maxCashReconciliationError = annualRows.reduce((max, row) => {
    const expectedEnding = row.cashBeginningBalance + row.cfadsIdrBillion - row.debtServiceIdrBillion - row.dsraFunding + row.dsraRelease - row.dividendsPaid;
    return Math.max(max, Math.abs(row.cashEndingBalance - expectedEnding), Math.abs(row.cashEndingBalance - row.bsCash));
  }, 0);
  checks.push({
    id: 'chk_cfs_reconciled', name: 'Cash Waterfall & Balance-Sheet Cash Reconciliation', category: 'cash_flow',
    passed: maxCashReconciliationError < TOL,
    valueDescription: `Max cash reconciliation error: ${maxCashReconciliationError.toFixed(6)} IDR B`, tolerance: TOL,
    delta: maxCashReconciliationError,
    details: 'Opening Cash + CFADS - Debt Service - DSRA Funding + DSRA Release - Dividends = Ending Cash = Balance-Sheet Cash.',
  });

  const sponsorSum = assumptions.project.epnParticipationPct + assumptions.project.otherSponsorParticipationPct;
  const sponsorDiff = Math.abs(sponsorSum - 100);
  checks.push({
    id: 'chk_consortium_100', name: 'Consortium Shareholding = 100%', category: 'funding', passed: sponsorDiff < TOL,
    valueDescription: `Total sponsor ownership: ${sponsorSum.toFixed(3)}%`, tolerance: TOL, delta: sponsorDiff,
    details: 'Sponsor ownership percentages must total 100%.',
  });

  const taxRateValid = assumptions.tax.corporateIncomeTaxRatePct > 0 && assumptions.tax.corporateIncomeTaxRatePct <= 50;
  checks.push({
    id: 'chk_central_tax_rate', name: 'Single Central CIT Assumption', category: 'tax', passed: taxRateValid,
    valueDescription: `CIT: ${assumptions.tax.corporateIncomeTaxRatePct.toFixed(2)}%`, tolerance: 0,
    delta: taxRateValid ? 0 : 1,
    details: 'Audited cash-tax calculations reference the central corporate income-tax assumption.',
  });

  const codDebt = audited.constructionDebtAtCod;
  const codDebtVariance = Number.isFinite(codDebt) ? Math.abs((codDebt as number) - sourcesAndUses.bankLoanAmount) : 0;
  const idcValid = sourcesAndUses.idcTotal >= -TOL &&
    (!Number.isFinite(codDebt) || codDebtVariance < TOL) &&
    (!Number.isFinite(audited.debtAtCodReconciliationVariance) || Math.abs(audited.debtAtCodReconciliationVariance as number) < TOL);
  checks.push({
    id: 'chk_idc_consistency', name: 'IDC & Senior Debt at COD Consistency', category: 'debt', passed: idcValid,
    valueDescription: `IDC mode: ${assumptions.funding.idcMode.toUpperCase()} | IDC: ${sourcesAndUses.idcTotal.toFixed(3)} IDR B | COD debt variance: ${codDebtVariance.toFixed(6)} IDR B`,
    tolerance: TOL, delta: Math.max(0, codDebtVariance),
    details: 'Capitalized IDC increases senior debt once; paid IDC is a funding use. The audited COD debt bridge must reconcile to the senior loan amount.',
  });

  const baseCapexTarget = assumptions.capexItems.reduce((sum, item) => sum + item.amountIdrBillion, 0);
  const capexDiff = Math.abs(sourcesAndUses.baseCapexTotal - baseCapexTarget);
  checks.push({
    id: 'chk_capex_sum', name: 'Base CAPEX Aggregation Integrity', category: 'funding', passed: capexDiff < TOL,
    valueDescription: `CAPEX aggregation difference: ${capexDiff.toFixed(6)} IDR B`, tolerance: TOL, delta: capexDiff,
    details: 'Categorized Sources & Uses base CAPEX must equal the sum of all CAPEX assumptions.',
  });

  const covenant = assumptions.funding.covenantDscrBenchmark ?? 1.2;
  const covenantMet = debtLifeDscrs.length > 0 && minDscr >= covenant;
  checks.push({
    id: 'chk_covenant_dscr', name: `Minimum DSCR Covenant >= ${covenant.toFixed(2)}x`, category: 'debt', passed: covenantMet,
    valueDescription: `Min DSCR: ${minDscr.toFixed(2)}x`, tolerance: 0, delta: minDscr - covenant,
    details: 'This is a transparent covenant test; a failure remains visible as a sizing/tenor issue and is not forced to pass by sculpting.',
  });

  const loanRate = Math.max(0, assumptions.funding.bankInterestRatePct / 100);
  let maxLlcrError = 0;
  let llcrObservations = 0;
  for (let i = 0; i < loanLife; i++) {
    const openingDebt = debtSchedule[i]?.openingBalance ?? 0;
    const reported = annualRows[i]?.llcr;
    if (openingDebt > 0.000001 && reported !== null && reported !== undefined) {
      let npvCfads = 0;
      for (let k = i; k < loanLife; k++) {
        npvCfads += annualRows[k].cfadsIdrBillion / Math.pow(1 + loanRate, k - i + 1);
      }
      const expected = (npvCfads + annualRows[i].openingDsra) / openingDebt;
      maxLlcrError = Math.max(maxLlcrError, Math.abs(reported - expected));
      llcrObservations += 1;
    }
  }
  checks.push({
    id: 'chk_llcr_formula', name: 'LLCR Uses Discounted Audited CFADS', category: 'debt',
    passed: llcrObservations > 0 && maxLlcrError < TOL,
    valueDescription: `Max LLCR formula error: ${maxLlcrError.toFixed(6)}x`, tolerance: TOL, delta: maxLlcrError,
    details: 'LLCR is independently recomputed as (NPV of remaining audited CFADS over loan life + opening DSRA) / opening senior debt.',
  });

  if (assumptions.workingInputs?.opex) {
    const master = assumptions.workingInputs.opex;
    const passed = annualRows.length === assumptions.project.operatingPeriodYears && annualRows.every(row =>
      row.workingOpexLines?.length === master.lines.length &&
      row.workingOpexLines.every((line, index) => line.id === master.lines[index].id && Number.isFinite(line.amount)) &&
      Math.abs(row.workingOpexLines.reduce((sum, line) => sum + line.amount, 0) - row.totalOpexIdrBillion) < TOL &&
      Math.abs(row.revenueIdrBillion - row.totalOpexIdrBillion - row.ebitdaIdrBillion) < TOL
    );
    checks.push({ tolerance: TOL, delta: passed ? 0 : Number.POSITIVE_INFINITY, id: 'chk_working_opex_to_ebitda', name: 'Working OPEX Master → EBITDA', category: 'cash_flow', passed,
      valueDescription: passed ? 'Exact working line population reconciles to annual OPEX and EBITDA.' : 'Working cost population or EBITDA bridge is missing/mismatched.',
      details: 'Calculation reconciliation only. DRAFT source declarations do not confer approval or persistence.' });
  }
  return checks;
}
