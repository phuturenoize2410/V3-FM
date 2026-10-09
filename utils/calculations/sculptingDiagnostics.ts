import { AnnualOperatingRow, DebtScheduleRow, FullModelAssumptions, ModelCheckItem } from '../types';
import { AuditedOperatingResult } from './auditedOperatingEngine';

export interface SculptingDiagnosticSummary {
  iterations: number;
  engineConverged: boolean;
  engineMaxDebtServiceDelta: number;
  independentFixedPointResidual: number;
  passed: boolean;
}

/**
 * Independently re-applies the sculpting rule to the final audited debt schedule.
 *
 * This deliberately does not rerun the operating engine. It checks whether the
 * returned principal + interest schedule is a fixed point of audited CFADS and
 * target DSCR. The contractual final repayment year clears residual debt.
 */
export function calculateSculptingFixedPointResidual(
  assumptions: FullModelAssumptions,
  debtSchedule: DebtScheduleRow[],
  annualRows: AnnualOperatingRow[]
): number {
  if (assumptions.funding.amortizationType !== 'sculpted') return 0;

  const repaymentYears = Math.max(1, assumptions.funding.repaymentPeriodYears);
  const loanLife = Math.min(repaymentYears, debtSchedule.length, annualRows.length);
  const targetDscr = Math.max(0.01, assumptions.funding.targetDscrForSculpting ?? 1.30);
  let maxResidual = 0;

  for (let i = 0; i < loanLife; i++) {
    const debt = debtSchedule[i];
    const cfads = Math.max(0, annualRows[i]?.cfadsIdrBillion ?? 0);
    if (!debt || debt.openingBalance <= 0.000001) continue;

    const isFinalRepaymentYear = i === repaymentYears - 1;
    const expectedPrincipal = isFinalRepaymentYear
      ? debt.openingBalance
      : Math.min(
          debt.openingBalance,
          Math.max(0, cfads / targetDscr - debt.interestExpense)
        );
    const expectedDebtService = expectedPrincipal + debt.interestExpense;
    maxResidual = Math.max(maxResidual, Math.abs(debt.totalDebtService - expectedDebtService));
  }

  return maxResidual;
}

/**
 * Produces a single audited summary combining the operating engine's own
 * convergence metadata with an independent fixed-point re-performance.
 */
export function summarizeSculptingDiagnostics(
  assumptions: FullModelAssumptions,
  result: Pick<AuditedOperatingResult, 'iterations' | 'converged' | 'maxDebtServiceDelta' | 'debtSchedule' | 'annualRows'>,
  tolerance = 0.001
): SculptingDiagnosticSummary {
  const isSculpted = assumptions.funding.amortizationType === 'sculpted';
  const engineDelta = Number.isFinite(result.maxDebtServiceDelta)
    ? Math.abs(result.maxDebtServiceDelta)
    : Number.POSITIVE_INFINITY;
  const fixedPointResidual = calculateSculptingFixedPointResidual(
    assumptions,
    result.debtSchedule,
    result.annualRows
  );

  return {
    iterations: result.iterations,
    engineConverged: isSculpted ? result.converged : true,
    engineMaxDebtServiceDelta: isSculpted ? engineDelta : 0,
    independentFixedPointResidual: fixedPointResidual,
    passed: !isSculpted || (
      result.converged &&
      engineDelta < tolerance &&
      fixedPointResidual < tolerance
    ),
  };
}

/**
 * Produces an explicit audited diagnostic for the debt-sculpting fixed-point iteration.
 *
 * The operating engine already returns iteration metadata. This helper converts that
 * metadata into the same ModelCheckItem contract used by the live model checks so a
 * failed / non-converged sculpting run cannot be presented as silently healthy.
 */
export function buildSculptingConvergenceCheck(
  amortizationType: string,
  result: Pick<AuditedOperatingResult, 'iterations' | 'converged' | 'maxDebtServiceDelta'>,
  tolerance = 0.0001
): ModelCheckItem {
  const isSculpted = amortizationType === 'sculpted';
  const delta = Number.isFinite(result.maxDebtServiceDelta)
    ? Math.abs(result.maxDebtServiceDelta)
    : Number.POSITIVE_INFINITY;

  if (!isSculpted) {
    return {
      id: 'chk_sculpting_convergence',
      name: 'Debt Sculpting Convergence',
      category: 'debt',
      passed: true,
      valueDescription: 'Not applicable — amortization is not sculpted',
      tolerance,
      delta: 0,
      details:
        'Convergence is only required for sculpted debt because equal-principal and annuity repayment do not iterate debt service against CFADS.',
    };
  }

  const passed = result.converged && delta < tolerance;
  return {
    id: 'chk_sculpting_convergence',
    name: 'Debt Sculpting Convergence',
    category: 'debt',
    passed,
    valueDescription: `Iterations: ${result.iterations} | Max debt-service delta: ${
      Number.isFinite(delta) ? delta.toFixed(6) : 'N/A'
    } IDR B`,
    tolerance,
    delta,
    details: passed
      ? 'Sculpted debt service converged against audited CFADS within the configured tolerance.'
      : 'Sculpted debt service did not converge within tolerance. DSCR, interest, cash tax, CFADS and downstream equity-return outputs must not be treated as fully reconciled until this check passes.',
  };
}
