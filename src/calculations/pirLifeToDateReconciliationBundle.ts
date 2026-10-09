import type {
  PirLifeToDateSummary,
  PirOperatingPeriodResult,
} from './investmentLifecycleEngine';
import {
  assessPirLifeToDateDiagnostics,
  type PirLifeToDateDiagnostics,
} from './pirLifeToDateDiagnostics';

export interface PirLifeToDateReconciliationBundle {
  periods: PirOperatingPeriodResult[];
  summary: PirLifeToDateSummary;
  diagnostics: PirLifeToDateDiagnostics;
  reconciled: boolean;
  blockingReasons: string[];
}

/**
 * Binds one exact PIR operating-period population to one supplied life-to-date
 * summary and its independently re-performed reconciliation diagnostics.
 *
 * This wrapper is intentionally read-only. It exists so downstream governance
 * and presentation layers cannot accidentally display a life-to-date summary
 * that was reconciled against a different period population.
 *
 * Governance boundaries:
 * - no Plan / Actual baseline is selected or approved;
 * - no reporting cutoff or missing operating period is inferred;
 * - no Actual provenance or Mapping Master evidence is created;
 * - no commercial, tariff, PPA or EBL term is inferred;
 * - no period or summary value is repaired or mutated;
 * - electricity-specific source governance remains in the Energy Sales module.
 */
export function buildPirLifeToDateReconciliationBundle(
  periods: PirOperatingPeriodResult[],
  summary: PirLifeToDateSummary
): PirLifeToDateReconciliationBundle {
  const diagnostics = assessPirLifeToDateDiagnostics(periods, summary);
  const blockingReasons = diagnostics.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);

  return {
    periods,
    summary,
    diagnostics,
    reconciled: diagnostics.passed && blockingReasons.length === 0,
    blockingReasons: Array.from(new Set(blockingReasons)),
  };
}
