import {
  FullModelAssumptions,
  ModelCheckItem,
  ModelMetrics,
  MonthlyCapexSchedule,
  SourcesAndUses,
} from '../types';
import { AuditedOperatingResult } from './auditedOperatingEngine';
import { AuditedSourcesAndUses } from './constructionFundingEngine';
import { runAuditedModelChecks } from './auditedModelChecks';
import { buildCashFlowReconciliationChecks } from './cashFlowReconciliationDiagnostics';
import { buildDebtLiquidityDiagnostics } from './debtLiquidityDiagnostics';
import { buildReturnReconciliationChecks } from './returnReconciliationDiagnostics';
import { buildAuditedScheduleAliasDiagnostics } from './auditedScheduleAliasDiagnostics';
import { summarizeSculptingDiagnostics } from './sculptingDiagnostics';

const SCULPTING_TOL_IDR_B = 0.001;
const DSCR_TOL_X = 0.001;

export function buildCheckIdIntegrityControl(checks: readonly ModelCheckItem[]): ModelCheckItem {
  let malformedIdCount = 0;
  let blankIdCount = 0;
  const counts: Record<string, number> = {};

  for (const check of checks) {
    const rawId = (check as { id?: unknown }).id;
    if (typeof rawId !== 'string') {
      malformedIdCount += 1;
      continue;
    }

    const comparisonId = rawId.trim();
    if (comparisonId.length === 0) {
      blankIdCount += 1;
      continue;
    }

    counts[comparisonId] = (counts[comparisonId] ?? 0) + 1;
  }

  const duplicateIds = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const passed = malformedIdCount === 0 && blankIdCount === 0 && duplicateIds.length === 0;
  const issueCount = malformedIdCount + blankIdCount + duplicateIds.length;

  return {
    id: 'chk_audit_bundle_unique_ids',
    name: 'Audited Check Bundle ID Integrity',
    category: 'cash_flow',
    passed,
    valueDescription: passed
      ? `${checks.length} audited checks | all IDs non-blank and unique`
      : `Malformed IDs: ${malformedIdCount} | Blank IDs: ${blankIdCount} | Duplicate IDs: ${duplicateIds.length > 0 ? duplicateIds.join(', ') : 'none'}`,
    tolerance: 0,
    delta: issueCount,
    details: passed
      ? 'Each audited control has a non-blank unique stable ID, so UI aggregation and retained audit evidence cannot silently overwrite, collapse or lose separate finance checks.'
      : 'Malformed, blank or duplicate model-check IDs, including identities that only differ by leading or trailing whitespace, can make audit controls unaddressable or indistinguishable in UI/state consumers. Resolve identifier integrity before relying on the bundled check set.',
  };
}

function buildConstructionToOperationsDebtBridgeCheck(
  sourcesAndUses: SourcesAndUses,
  operatingResult: AuditedOperatingResult
): ModelCheckItem {
  const auditedSources = sourcesAndUses as SourcesAndUses & Partial<AuditedSourcesAndUses>;
  const constructionDebtAtCod = auditedSources.constructionDebtAtCod;
  const operatingOpeningDebt = operatingResult.debtSchedule[0]?.openingBalance;
  const hasAuditedCodDebt = Number.isFinite(constructionDebtAtCod);
  const hasOperatingOpeningDebt = Number.isFinite(operatingOpeningDebt);
  const delta = hasAuditedCodDebt && hasOperatingOpeningDebt
    ? Math.abs((constructionDebtAtCod as number) - (operatingOpeningDebt as number))
    : Number.POSITIVE_INFINITY;

  return {
    id: 'chk_construction_to_operations_debt_bridge',
    name: 'Construction-to-Operations Senior Debt Bridge',
    category: 'debt',
    passed: hasAuditedCodDebt && hasOperatingOpeningDebt && delta < SCULPTING_TOL_IDR_B,
    valueDescription: hasAuditedCodDebt && hasOperatingOpeningDebt
      ? `COD debt: ${(constructionDebtAtCod as number).toFixed(6)} | Operating opening debt: ${(operatingOpeningDebt as number).toFixed(6)} IDR B`
      : 'Audited COD debt or operating opening debt is unavailable',
    tolerance: SCULPTING_TOL_IDR_B,
    delta,
    details: 'The first operating-period senior debt opening balance must equal audited construction debt at COD. This independently verifies that the central operating/debt pipeline is using the construction funding engine output rather than a separate debt estimate.',
  };
}

function buildDebtServiceBridgeCheck(
  operatingResult: AuditedOperatingResult
): ModelCheckItem {
  const rowCount = Math.min(
    operatingResult.debtSchedule.length,
    operatingResult.annualRows.length
  );
  let maxScheduleIdentityError = 0;
  let maxOperatingBridgeError = 0;

  for (let i = 0; i < rowCount; i++) {
    const debt = operatingResult.debtSchedule[i];
    const row = operatingResult.annualRows[i];
    const expectedDebtService = debt.principalRepayment + debt.interestExpense;

    maxScheduleIdentityError = Math.max(
      maxScheduleIdentityError,
      Math.abs(debt.totalDebtService - expectedDebtService)
    );
    maxOperatingBridgeError = Math.max(
      maxOperatingBridgeError,
      Math.abs(row.debtServiceIdrBillion - debt.totalDebtService)
    );
  }

  const delta = Math.max(maxScheduleIdentityError, maxOperatingBridgeError);
  return {
    id: 'chk_debt_service_source_bridge',
    name: 'Senior Debt Service Source Bridge',
    category: 'debt',
    passed: rowCount > 0 && delta < SCULPTING_TOL_IDR_B,
    valueDescription: `Schedule identity: ${maxScheduleIdentityError.toFixed(6)} | Operating bridge: ${maxOperatingBridgeError.toFixed(6)} IDR B`,
    tolerance: SCULPTING_TOL_IDR_B,
    delta,
    details: 'Senior debt service is independently checked as principal repayment + cash interest, then reconciled to the debt-service field used by the operating cash waterfall. This is an arithmetic/source bridge only and does not infer fees, sweeps, default interest, refinancing or Shareholder Loan debt service.',
  };
}

function buildSculptedTargetDscrCheck(
  assumptions: FullModelAssumptions,
  operatingResult: AuditedOperatingResult
): ModelCheckItem {
  if (assumptions.funding.amortizationType !== 'sculpted') {
    return {
      id: 'chk_sculpted_target_dscr',
      name: 'Sculpted Debt Target DSCR Adherence',
      category: 'debt',
      passed: true,
      valueDescription: 'Not applicable — amortization is not sculpted',
      tolerance: DSCR_TOL_X,
      delta: 0,
      details: 'Target-DSCR adherence is only applicable when senior debt is sculpted against CFADS.',
    };
  }

  const targetDscr = Math.max(0.01, assumptions.funding.targetDscrForSculpting ?? 1.30);
  const repaymentYears = Math.max(1, assumptions.funding.repaymentPeriodYears);
  const loanLife = Math.min(
    repaymentYears,
    operatingResult.debtSchedule.length,
    operatingResult.annualRows.length
  );

  let minDscr = Number.POSITIVE_INFINITY;
  let maxShortfall = 0;
  let testedPeriods = 0;
  let finalYearShortfall = 0;

  for (let i = 0; i < loanLife; i++) {
    const debt = operatingResult.debtSchedule[i];
    const row = operatingResult.annualRows[i];
    if (!debt || !row || debt.openingBalance <= 0.000001 || debt.totalDebtService <= 0.000001) continue;

    const reperformDscr = row.cfadsIdrBillion / debt.totalDebtService;
    const shortfall = Math.max(0, targetDscr - reperformDscr);
    minDscr = Math.min(minDscr, reperformDscr);
    maxShortfall = Math.max(maxShortfall, shortfall);
    testedPeriods += 1;

    if (i === repaymentYears - 1) {
      finalYearShortfall = shortfall;
    }
  }

  const hasTestPopulation = testedPeriods > 0 && Number.isFinite(minDscr);
  const passed = hasTestPopulation && maxShortfall <= DSCR_TOL_X;
  const finalYearNote = finalYearShortfall > DSCR_TOL_X
    ? ' Contractual maturity cleanup is causing a final-period DSCR below target; this is a financing-feasibility result, not a convergence error.'
    : '';

  return {
    id: 'chk_sculpted_target_dscr',
    name: 'Sculpted Debt Target DSCR Adherence',
    category: 'debt',
    passed,
    valueDescription: hasTestPopulation
      ? `Target: ${targetDscr.toFixed(3)}x | Min re-performed DSCR: ${minDscr.toFixed(3)}x | Max shortfall: ${maxShortfall.toFixed(3)}x`
      : 'No debt-service periods available for target-DSCR testing',
    tolerance: DSCR_TOL_X,
    delta: hasTestPopulation ? maxShortfall : Number.POSITIVE_INFINITY,
    details: passed
      ? 'Every tested sculpted-debt period meets or exceeds the configured target DSCR when independently re-performed from audited CFADS and actual senior debt service.'
      : `The sculpting engine may be mathematically converged while one or more debt-service periods still fall below the configured target DSCR. This check separates financing adequacy from fixed-point convergence.${finalYearNote}`,
  };
}

/**
 * Consolidates the audited model checks that can be derived without inventing
 * unresolved commercial assumptions.
 *
 * This wrapper is intentionally side-effect free. It does not change the
 * construction funding, tax, CFADS, debt, return or Shareholder Loan economics;
 * it only brings their independently calculated controls into one check bundle
 * that can be wired into the live UI atomically.
 */
export function buildAuditedModelCheckBundle(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  monthlyCapexSchedule: MonthlyCapexSchedule[],
  operatingResult: AuditedOperatingResult,
  metrics: ModelMetrics
): ModelCheckItem[] {
  const baseChecks = runAuditedModelChecks(
    assumptions,
    sourcesAndUses,
    operatingResult.debtSchedule,
    operatingResult.annualRows
  );

  const sculpting = summarizeSculptingDiagnostics(
    assumptions,
    operatingResult,
    SCULPTING_TOL_IDR_B
  );
  const isSculpted = assumptions.funding.amortizationType === 'sculpted';

  const sculptingEngineCheck: ModelCheckItem = {
    id: 'chk_sculpting_engine_convergence',
    name: 'Debt Sculpting Engine Convergence',
    category: 'debt',
    passed: sculpting.passed,
    valueDescription: isSculpted
      ? `Iterations: ${sculpting.iterations} | Engine delta: ${
          Number.isFinite(sculpting.engineMaxDebtServiceDelta)
            ? sculpting.engineMaxDebtServiceDelta.toFixed(6)
            : 'N/A'
        } IDR B | Independent residual: ${sculpting.independentFixedPointResidual.toFixed(6)} IDR B`
      : 'Not applicable — amortization is not sculpted',
    tolerance: SCULPTING_TOL_IDR_B,
    delta: isSculpted
      ? Math.max(
          sculpting.engineMaxDebtServiceDelta,
          sculpting.independentFixedPointResidual
        )
      : 0,
    details: isSculpted
      ? sculpting.passed
        ? 'The operating engine converged and the returned debt schedule independently re-performs against audited CFADS and target DSCR within tolerance.'
        : 'Either the operating engine did not converge or the returned debt schedule failed independent fixed-point re-performance. DSCR, interest, cash tax, CFADS and downstream equity returns must not be treated as fully reconciled.'
      : 'Engine convergence metadata is only relevant for CFADS-driven sculpted debt.',
  };

  const constructionToOperationsDebtBridgeCheck = buildConstructionToOperationsDebtBridgeCheck(
    sourcesAndUses,
    operatingResult
  );
  const debtServiceBridgeCheck = buildDebtServiceBridgeCheck(operatingResult);
  const sculptedTargetDscrCheck = buildSculptedTargetDscrCheck(
    assumptions,
    operatingResult
  );

  const cashFlowChecks = buildCashFlowReconciliationChecks(
    assumptions,
    operatingResult.debtSchedule,
    operatingResult.annualRows
  );

  const debtLiquidityChecks = buildDebtLiquidityDiagnostics(
    assumptions,
    sourcesAndUses,
    operatingResult.debtSchedule,
    operatingResult.annualRows
  );

  const returnChecks = buildReturnReconciliationChecks(
    assumptions,
    monthlyCapexSchedule,
    operatingResult.annualRows,
    metrics
  );

  const scheduleAliasChecks = buildAuditedScheduleAliasDiagnostics(
    operatingResult.annualRows
  );

  const auditedChecks = [
    ...baseChecks,
    constructionToOperationsDebtBridgeCheck,
    debtServiceBridgeCheck,
    sculptingEngineCheck,
    sculptedTargetDscrCheck,
    ...cashFlowChecks,
    ...debtLiquidityChecks,
    ...returnChecks,
    ...scheduleAliasChecks,
  ];
  const bundleIntegrityCheck = buildCheckIdIntegrityControl(auditedChecks);

  return [
    ...auditedChecks,
    bundleIntegrityCheck,
  ];
}
