import type {
  AnnualOperatingRow,
  DebtScheduleRow,
  ModelCheckItem,
} from '../types';
import type {
  AuditedCalculationScheduleControlGroup,
  AuditedCalculationScheduleGovernanceBundle,
} from './auditedCalculationScheduleGovernanceBundle';
import {
  buildAuditedCalculationScheduleGovernancePresentation,
  type AuditedCalculationScheduleGovernancePresentation,
} from './auditedCalculationScheduleGovernancePresentation';

export interface AuditedCalculationScheduleReportingHandoffBundle {
  /**
   * Exact authoritative calculation-governance bundle used to build this handoff.
   * Downstream audit/reporting consumers can retain one canonical SSOT reference
   * instead of reconstructing governance identity from copied scalar/array fields.
   */
  readonly governanceBundle: AuditedCalculationScheduleGovernanceBundle;
  /**
   * Mirrors the fail-closed presentation gate derived from the authoritative
   * calculation-governance bundle. Reporting readiness is evidence readiness only;
   * it is not a baseline, PIR or investment approval.
   */
  readonly governanceReady: boolean;
  readonly presentation: AuditedCalculationScheduleGovernancePresentation;
  /**
   * Exact retained schedule populations from the same authoritative governance
   * bundle used to build `presentation`. No second schedule input is accepted.
   */
  readonly operatingRows: ReadonlyArray<Readonly<AnnualOperatingRow>>;
  readonly debtSchedule: ReadonlyArray<Readonly<DebtScheduleRow>>;
  readonly solver: Readonly<{
    iterations: number;
    converged: boolean;
    maxDebtServiceDelta: number;
  }>;
  readonly controlGroups: ReadonlyArray<AuditedCalculationScheduleControlGroup>;
  readonly checks: ReadonlyArray<Readonly<ModelCheckItem>>;
  readonly failedCheckIds: ReadonlyArray<string>;
}

/**
 * Single-source reporting handoff for reconciled audited calculation schedules.
 *
 * The status presentation and row-level reporting evidence are deliberately built
 * from one exact `AuditedCalculationScheduleGovernanceBundle`. Consumers therefore
 * do not need to pass a presentation object and a separate schedule population,
 * eliminating the avoidable risk of pairing controls from one audited run with rows
 * from another. The handoff also retains that exact authoritative bundle so future
 * audit/reporting layers can preserve object continuity instead of inferring SSOT
 * identity from equivalent-looking schedule/control populations.
 *
 * This handoff is intentionally calculation-free:
 * - no schedule row, solver result, control or financial amount is recalculated;
 * - no failed check is waived and no missing/reordered period is repaired;
 * - no debt, tax, tariff, PPA/EBL or other commercial term is inferred;
 * - no electricity-specific assumption is introduced into the asset-generic core;
 * - no baseline approval, PIR selection, persistence or investment decision occurs.
 *
 * The retained arrays/control evidence are already frozen by the authoritative
 * governance bundle. The handoff contract mirrors that immutability at compile time,
 * while this wrapper freezes the container at runtime and reuses those exact retained
 * references rather than reconstructing another population.
 */
export function buildAuditedCalculationScheduleReportingHandoffBundle(
  bundle: AuditedCalculationScheduleGovernanceBundle
): AuditedCalculationScheduleReportingHandoffBundle {
  const presentation = buildAuditedCalculationScheduleGovernancePresentation(bundle);

  return Object.freeze({
    governanceBundle: bundle,
    governanceReady: presentation.governanceReady,
    presentation,
    operatingRows: bundle.operatingRows,
    debtSchedule: bundle.debtSchedule,
    solver: bundle.solver,
    controlGroups: bundle.controlGroups,
    checks: bundle.checks,
    failedCheckIds: bundle.failedCheckIds,
  });
}
