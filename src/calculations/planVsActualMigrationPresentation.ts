import type {
  PlanVsActualMigrationCandidate,
  PlanVsActualMigrationControlResult,
  PlanVsActualMigrationEvidenceIdentity,
} from './planVsActualMigrationControl';
import type { PlanVsActualFieldSelector } from './planVsActualFieldReconciliationDiagnostics';

export type PlanVsActualMigrationPresentationState =
  | 'BLOCKED'
  | 'RECONCILED_READ_ONLY';

export interface PlanVsActualMigrationEvidenceSummary {
  readonly importBatchId: string;
  readonly sourceReference: string;
  readonly mappingMasterVersion: string;
  readonly cutoffDate: string;
  readonly releasedRows: number;
  readonly actualRows: number;
  readonly nonActualRows: number;
  readonly releasedAmount: number;
}

export interface PlanVsActualMigrationCandidateView {
  readonly fieldId: string;
  readonly displayLabel: string;
  readonly governedActualAmount: number;
  readonly matchedRowCount: number;
  readonly matchedRowIds: ReadonlyArray<string>;
  readonly selector: Readonly<PlanVsActualFieldSelector>;
}

export interface PlanVsActualMigrationPresentationViewModel {
  readonly state: PlanVsActualMigrationPresentationState;
  readonly statusLabel: 'Migration blocked' | 'Reconciled — read only';
  readonly migrationEligible: boolean;
  readonly evidence: PlanVsActualMigrationEvidenceSummary | null;
  readonly candidates: ReadonlyArray<PlanVsActualMigrationCandidateView>;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly boundaryNote: string;
}

function toEvidenceSummary(
  evidence: PlanVsActualMigrationEvidenceIdentity | null
): PlanVsActualMigrationEvidenceSummary | null {
  if (!evidence) return null;

  return Object.freeze({
    importBatchId: evidence.importBatchId,
    sourceReference: evidence.sourceReference,
    mappingMasterVersion: evidence.mappingMasterVersion,
    cutoffDate: evidence.cutoffDate,
    releasedRows: evidence.releasedRows,
    actualRows: evidence.actualRows,
    nonActualRows: evidence.nonActualRows,
    releasedAmount: evidence.releasedAmount,
  });
}

function toCandidateView(
  candidate: PlanVsActualMigrationCandidate
): PlanVsActualMigrationCandidateView {
  return Object.freeze({
    fieldId: candidate.fieldId,
    displayLabel: candidate.displayLabel,
    governedActualAmount: candidate.governedActualAmount,
    matchedRowCount: candidate.matchedRowIds.length,
    matchedRowIds: Object.freeze([...candidate.matchedRowIds]),
    selector: candidate.selector,
  });
}

/**
 * Calculation-free presentation adapter for the controlled Plan vs Actual
 * migration gate.
 *
 * The adapter deliberately mirrors the domain control instead of rebuilding any
 * finance or governance logic in the UI layer. A consumer can therefore show
 * whether governed Actual values are reconciled and review their retained
 * evidence identity without implying that those values have already replaced the
 * legacy realization dataset.
 *
 * The Actual/non-Actual row composition is copied from the authoritative migration
 * evidence identity. Presentation does not inspect released rows or independently
 * decide whether a population qualifies as Actual-to-Date.
 *
 * Eligible candidate views retain the exact immutable selector evidence already
 * governed by the migration control and an immutable ordered copy of the exact
 * matched source-row identities. This allows institutional review surfaces and
 * downstream handoff checks to prove which governed Actual rows support each
 * candidate instead of relying on population count alone. Row identities are
 * presentation provenance only; they are not remapped, normalized or treated as
 * authenticated source-system identity.
 *
 * The returned presentation shell and its owned evidence/candidate/reason
 * populations are immutable at runtime. This prevents downstream UI/reporting
 * consumers from mutating presentation evidence after migration eligibility has
 * already been determined. The authoritative migration-control objects remain
 * owned by the control layer and are not recalculated or replaced here.
 *
 * Boundaries:
 * - does not recalculate, map, translate currency or mutate Actual values;
 * - does not normalize, broaden or reapply retained selector evidence;
 * - does not reclassify or recount released rows;
 * - does not infer, sort, deduplicate or rewrite matched source-row identities;
 * - does not approve an Actual-to-Date baseline or select a PIR case;
 * - does not weaken an all-fields reconciliation failure into partial migration;
 * - remains asset-generic and contains no electricity-specific commercial terms.
 */
export function buildPlanVsActualMigrationPresentation(
  control: PlanVsActualMigrationControlResult
): PlanVsActualMigrationPresentationViewModel {
  const eligible =
    control.state === 'RECONCILED_READ_ONLY' && control.migrationEligible;

  const candidates = Object.freeze(
    eligible ? control.candidates.map(toCandidateView) : []
  );
  const blockingReasons = Object.freeze([...control.blockingReasons]);

  return Object.freeze({
    state: eligible ? 'RECONCILED_READ_ONLY' : 'BLOCKED',
    statusLabel: eligible ? 'Reconciled — read only' : 'Migration blocked',
    migrationEligible: eligible,
    evidence: toEvidenceSummary(control.evidenceIdentity),
    candidates,
    blockingReasons,
    boundaryNote: eligible
      ? 'Governed Actual values reconcile to an Actual-only retained controlled population, but legacy Plan vs Actual values remain unchanged until an explicit migration action is implemented and reviewed.'
      : 'Legacy Plan vs Actual values remain isolated. Resolve the controlled Actual and field-reconciliation blockers before any replacement is considered.',
  });
}
