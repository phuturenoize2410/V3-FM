import {
  AnnualOperatingRow,
  FullModelAssumptions,
  ModelCheckItem,
  ModelMetrics,
  MonthlyCapexSchedule,
} from '../types';
import { calculateXIRR, calculateXNPV, CashFlowDate } from './financialEngine';

const RETURN_TOL_PCT = 0.0001;
const NPV_TOL_IDR_B = 0.001;
const SHL_TOL_PCT = 0.000001;

function buildProjectCashFlows(
  monthlySchedule: MonthlyCapexSchedule[],
  annualRows: AnnualOperatingRow[]
): CashFlowDate[] {
  return [
    ...monthlySchedule.map((row) => ({
      date: new Date(row.dateStr),
      amount: -row.totalCapex,
    })),
    ...annualRows.map((row) => ({
      date: new Date(row.dateStr),
      amount: row.projectFreeCashFlow,
    })),
  ];
}

function buildEquityCashFlows(
  monthlySchedule: MonthlyCapexSchedule[],
  annualRows: AnnualOperatingRow[]
): CashFlowDate[] {
  return [
    ...monthlySchedule.map((row) => ({
      date: new Date(row.dateStr),
      amount: -row.equityDrawdown,
    })),
    ...annualRows.map((row) => ({
      date: new Date(row.dateStr),
      amount: row.dividendsPaid,
    })),
  ];
}

function buildReturnCashFlowPopulationCheck(
  id: string,
  name: string,
  cashFlows: CashFlowDate[],
  scope: string
): ModelCheckItem {
  let invalidDates = 0;
  let invalidAmounts = 0;
  let dateOrderErrors = 0;
  let hasNegative = false;
  let hasPositive = false;
  let previousTime = Number.NEGATIVE_INFINITY;

  for (const cashFlow of cashFlows) {
    const time = cashFlow.date.getTime();
    if (!Number.isFinite(time)) {
      invalidDates += 1;
    } else {
      if (time < previousTime) dateOrderErrors += 1;
      previousTime = time;
    }

    if (!Number.isFinite(cashFlow.amount)) {
      invalidAmounts += 1;
      continue;
    }
    if (cashFlow.amount < 0) hasNegative = true;
    if (cashFlow.amount > 0) hasPositive = true;
  }

  const missingSignPopulation = Number(!hasNegative) + Number(!hasPositive);
  const failures = invalidDates + invalidAmounts + dateOrderErrors + missingSignPopulation;
  const passed = cashFlows.length >= 2 && failures === 0;

  return {
    id,
    name,
    category: 'cash_flow',
    passed,
    valueDescription: passed
      ? `${cashFlows.length} dated cash flows | valid dates/amounts | negative + positive populations present`
      : `${cashFlows.length} rows | invalid dates ${invalidDates} | invalid amounts ${invalidAmounts} | date-order errors ${dateOrderErrors} | negative ${hasNegative ? 'yes' : 'no'} | positive ${hasPositive ? 'yes' : 'no'}`,
    tolerance: 0,
    delta: cashFlows.length >= 2 ? failures : failures + 1,
    details: passed
      ? `${scope} return cash flows are solver-ready: all dates and amounts are finite, dates are non-decreasing, and both investment outflows and return inflows are present.`
      : `${scope} IRR/NPV must not be relied on when its dated cash-flow population is malformed or lacks both negative and positive cash flows. This control validates the population only; it does not change timing, distributions, discount rates, or Shareholder Loan economics.`,
  };
}

/**
 * Independently re-performs the return metrics exposed by calculateModelMetrics.
 *
 * The purpose is auditability rather than alternate economics: the same dated
 * project/equity cash-flow definitions are rebuilt from the audited construction
 * and operating outputs, then IRR/NPV are independently recomputed and compared
 * with the live metric values. No unresolved Shareholder Loan classification is
 * inferred here; equity cash flow remains sponsor equity drawdown vs dividends,
 * matching the current live metric convention until SHL treatment is explicit.
 *
 * When SHL is present, explicit scope checks fail by design. They do not change
 * the live metrics; they prevent the current Equity IRR/NPV and WACC convention
 * from being interpreted as sponsor-final while SHL economics remain undefined.
 */
export function buildReturnReconciliationChecks(
  assumptions: FullModelAssumptions,
  monthlySchedule: MonthlyCapexSchedule[],
  annualRows: AnnualOperatingRow[],
  metrics: ModelMetrics
): ModelCheckItem[] {
  const projectCashFlows = buildProjectCashFlows(monthlySchedule, annualRows);
  const equityCashFlows = buildEquityCashFlows(monthlySchedule, annualRows);

  const projectPopulationCheck = buildReturnCashFlowPopulationCheck(
    'chk_project_return_cash_flow_population',
    'Project Return Cash-Flow Population',
    projectCashFlows,
    'Project'
  );
  const equityPopulationCheck = buildReturnCashFlowPopulationCheck(
    'chk_equity_return_cash_flow_population',
    'Equity Return Cash-Flow Population',
    equityCashFlows,
    'Equity'
  );

  const citRate = assumptions.tax.corporateIncomeTaxRatePct / 100;
  const debtShare = assumptions.funding.bankDebtPct / 100;
  const shareholderLoanPct = Math.max(0, assumptions.funding.shareholderLoanPct ?? 0);
  const equityShare = (assumptions.funding.equityPct + shareholderLoanPct) / 100;
  const kdPostTax = (assumptions.valuation.costOfDebtPreTaxPct / 100) * (1 - citRate);
  const ke = assumptions.valuation.costOfEquityPct / 100;
  const wacc = debtShare * kdPostTax + equityShare * ke;
  const hasUnresolvedShareholderLoan = shareholderLoanPct > SHL_TOL_PCT;

  const projectIrrPct = calculateXIRR(projectCashFlows, 0.10) * 100;
  const equityIrrPct = calculateXIRR(equityCashFlows, 0.12) * 100;
  const projectNpvIdrBillion = calculateXNPV(wacc, projectCashFlows);
  const equityNpvIdrBillion = calculateXNPV(ke, equityCashFlows);

  const projectIrrDelta = Math.abs(projectIrrPct - metrics.projectIrrPct);
  const equityIrrDelta = Math.abs(equityIrrPct - metrics.equityIrrPct);
  const projectNpvDelta = Math.abs(projectNpvIdrBillion - metrics.projectNpvIdrBillion);
  const equityNpvDelta = Math.abs(equityNpvIdrBillion - metrics.equityNpvIdrBillion);

  return [
    projectPopulationCheck,
    equityPopulationCheck,
    {
      id: 'chk_project_irr_reperformance',
      name: 'Project IRR Re-performance',
      category: 'cash_flow',
      passed: projectPopulationCheck.passed && projectIrrDelta < RETURN_TOL_PCT,
      valueDescription: `Re-performed ${projectIrrPct.toFixed(6)}% | Live ${metrics.projectIrrPct.toFixed(6)}%`,
      tolerance: RETURN_TOL_PCT,
      delta: projectPopulationCheck.passed ? projectIrrDelta : Number.POSITIVE_INFINITY,
      details: projectPopulationCheck.passed
        ? 'Project IRR is independently rebuilt from dated construction CAPEX outflows and audited project free cash flow inflows.'
        : 'Project IRR re-performance is not considered valid because the underlying dated project cash-flow population failed its independent validity control.',
    },
    {
      id: 'chk_equity_irr_reperformance',
      name: 'Equity IRR Re-performance',
      category: 'cash_flow',
      passed: equityPopulationCheck.passed && equityIrrDelta < RETURN_TOL_PCT,
      valueDescription: `Re-performed ${equityIrrPct.toFixed(6)}% | Live ${metrics.equityIrrPct.toFixed(6)}%`,
      tolerance: RETURN_TOL_PCT,
      delta: equityPopulationCheck.passed ? equityIrrDelta : Number.POSITIVE_INFINITY,
      details: equityPopulationCheck.passed
        ? 'Equity IRR is independently rebuilt from dated sponsor equity drawdowns and audited dividend distributions. Shareholder Loan treatment remains unresolved and is not inferred.'
        : 'Equity IRR re-performance is not considered valid because the underlying dated equity cash-flow population failed its independent validity control.',
    },
    {
      id: 'chk_project_npv_reperformance',
      name: 'Project NPV Re-performance',
      category: 'cash_flow',
      passed: projectPopulationCheck.passed && projectNpvDelta < NPV_TOL_IDR_B,
      valueDescription: `Re-performed ${projectNpvIdrBillion.toFixed(6)} IDR B | Live ${metrics.projectNpvIdrBillion.toFixed(6)} IDR B`,
      tolerance: NPV_TOL_IDR_B,
      delta: projectPopulationCheck.passed ? projectNpvDelta : Number.POSITIVE_INFINITY,
      details: projectPopulationCheck.passed
        ? 'Project NPV is independently recomputed from the audited dated project cash-flow series using the live WACC convention.'
        : 'Project NPV re-performance is not considered valid because the underlying dated project cash-flow population failed its independent validity control.',
    },
    {
      id: 'chk_equity_npv_reperformance',
      name: 'Equity NPV Re-performance',
      category: 'cash_flow',
      passed: equityPopulationCheck.passed && equityNpvDelta < NPV_TOL_IDR_B,
      valueDescription: `Re-performed ${equityNpvIdrBillion.toFixed(6)} IDR B | Live ${metrics.equityNpvIdrBillion.toFixed(6)} IDR B`,
      tolerance: NPV_TOL_IDR_B,
      delta: equityPopulationCheck.passed ? equityNpvDelta : Number.POSITIVE_INFINITY,
      details: equityPopulationCheck.passed
        ? 'Equity NPV is independently recomputed from the dated sponsor equity cash-flow series at the live cost of equity.'
        : 'Equity NPV re-performance is not considered valid because the underlying dated equity cash-flow population failed its independent validity control.',
    },
    {
      id: 'chk_equity_return_shl_scope',
      name: 'Equity Return SHL Scope',
      category: 'cash_flow',
      passed: !hasUnresolvedShareholderLoan,
      valueDescription: hasUnresolvedShareholderLoan
        ? `Shareholder Loan ${shareholderLoanPct.toFixed(4)}% of funding | sponsor return scope unresolved`
        : 'No Shareholder Loan funding in capital mix',
      tolerance: SHL_TOL_PCT,
      delta: hasUnresolvedShareholderLoan ? shareholderLoanPct : 0,
      details: hasUnresolvedShareholderLoan
        ? 'Current Equity IRR/NPV uses sponsor equity drawdowns and dividends only. Because Shareholder Loan coupon, repayment, subordination and debt/equity classification are not defined, these return metrics reconcile mechanically but must not be treated as sponsor-final.'
        : 'The current sponsor equity cash-flow definition is not exposed to an unresolved Shareholder Loan funding layer.',
    },
    {
      id: 'chk_wacc_shl_classification_scope',
      name: 'WACC SHL Classification Scope',
      category: 'cash_flow',
      passed: !hasUnresolvedShareholderLoan,
      valueDescription: hasUnresolvedShareholderLoan
        ? `Live WACC treats SHL within equity-weight share | SHL ${shareholderLoanPct.toFixed(4)}%`
        : 'No unresolved Shareholder Loan classification in WACC weights',
      tolerance: SHL_TOL_PCT,
      delta: hasUnresolvedShareholderLoan ? shareholderLoanPct : 0,
      details: hasUnresolvedShareholderLoan
        ? 'The live Project NPV convention weights Shareholder Loan with equity because no separate SHL required return or tax treatment exists. This is preserved for backward compatibility but remains a modelling blocker until SHL classification and pricing are explicitly supplied.'
        : 'The live WACC weighting does not depend on an unresolved Shareholder Loan classification.',
    },
  ];
}
