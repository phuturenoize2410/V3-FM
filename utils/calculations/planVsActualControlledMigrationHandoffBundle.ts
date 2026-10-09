import type { PlanVsActualControlledReviewBundle } from './planVsActualControlledReviewBundle';
import type {
  PlanVsActualMigrationCandidate,
  PlanVsActualMigrationControlResult,
  PlanVsActualMigrationEvidenceIdentity,
} from './planVsActualMigrationControl';
import type { PlanVsActualFieldSelector } from './planVsActualFieldReconciliationDiagnostics';
import type {
  PlanVsActualMigrationCandidateView,
  PlanVsActualMigrationEvidenceSummary,
  PlanVsActualMigrationPresentationViewModel,
} from './planVsActualMigrationPresentation';

export interface PlanVsActualControlledMigrationHandoffBundle {
  readonly reviewBundle: PlanVsActualControlledReviewBundle;
  readonly migrationControl: PlanVsActualMigrationControlResult;
  readonly migrationPresentation: PlanVsActualMigrationPresentationViewModel;
  readonly handoffReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function evidenceMatches(
  control: PlanVsActualMigrationEvidenceIdentity | null,
  presentation: PlanVsActualMigrationEvidenceSummary | null
): boolean {
  if (control === null || presentation === null) {
    return control === null && presentation === null;
  }

  if (!isRecord(control) || !isRecord(presentation)) {
    return false;
  }

  return (
    control.importBatchId === presentation.importBatchId &&
    control.sourceReference === presentation.sourceReference &&
    control.mappingMasterVersion === presentation.mappingMasterVersion &&
    control.cutoffDate === presentation.cutoffDate &&
    control.releasedRows === presentation.releasedRows &&
    control.actualRows === presentation.actualRows &&
    control.nonActualRows === presentation.nonActualRows &&
    control.releasedAmount === presentation.releasedAmount
  );
}

const SELECTOR_KEYS: ReadonlyArray<keyof PlanVsActualFieldSelector> = Object.freeze([
  'finmodLineItem',
  'finmodCategory',
  'finmodSubcategory',
  'projectId',
  'phase',
  'dataClass',
  'accountingTreatment',
  'currency',
]);

function selectorMatches(
  control: Readonly<PlanVsActualFieldSelector>,
  presentation: Readonly<PlanVsActualFieldSelector>
): boolean {
  if (!isRecord(control) || !isRecord(presentation)) return false;

  const controlKeys = Object.keys(control).sort();
  const presentationKeys = Object.keys(presentation).sort();
  const allowedKeys = new Set<string>(SELECTOR_KEYS);

  if (
    controlKeys.some((key) => !allowedKeys.has(key)) ||
    presentationKeys.some((key) => !allowedKeys.has(key)) ||
    controlKeys.length !== presentationKeys.length ||
    controlKeys.some((key, index) => key !== presentationKeys[index])
  ) {
    return false;
  }

  return SELECTOR_KEYS.every((key) => control[key] === presentation[key]);
}

function matchedRowIdsMatch(
  control: ReadonlyArray<string>,
  presentation: ReadonlyArray<string>
): boolean {
  return (
    control.length === presentation.length &&
    control.every((rowId, index) => rowId === presentation[index])
  );
}

function candidateMatches(
  control: PlanVsActualMigrationCandidate,
  presentation: PlanVsActualMigrationCandidateView
): boolean {
  if (
    !isRecord(control) ||
    !isRecord(presentation) ||
    !Array.isArray(control.matchedRowIds) ||
    !Array.isArray(presentation.matchedRowIds) ||
    !isRecord(control.selector) ||
    !isRecord(presentation.selector)
  ) {
    return false;
  }

  return (
    control.fieldId === presentation.fieldId &&
    control.displayLabel === presentation.displayLabel &&
    control.governedActualAmount === presentation.governedActualAmount &&
    control.matchedRowIds.length === presentation.matchedRowCount &&
    matchedRowIdsMatch(control.matchedRowIds, presentation.matchedRowIds) &&
    selectorMatches(control.selector, presentation.selector)
  );
}

/**
 * Calculation-free handoff for a governed Plan vs Actual migration review.
 *
 * The handoff deliberately retains the exact authoritative review bundle and the
 * exact migration-control/presentation objects already produced by that review.
 * A downstream UI or reporting adapter can therefore consume one SSOT boundary
 * without reconstructing selector populations, release identity, Mapping Master
 * evidence or governed Actual amounts from parallel inputs.
 *
 * The boundary also re-performs structural continuity between the retained
 * migration control and its presentation projection. This is intentionally not a
 * second financial calculation: it only proves that state, evidence identity,
 * governed selector dimensions, exact ordered matched-row identities and candidate
 * summaries still represent the same governed migration result after a retained/
 * deserialized object crosses into the handoff. Matching scalar amounts and row
 * counts cannot mask selector or source-row population drift. Matching values do
 * not repair or rewrite either object; an inconsistency blocks handoff.
 *
 * Governance boundaries:
 * - no legacy Plan vs Actual value is mutated or promoted here;
 * - no selector, Mapping Master classification, currency/FX treatment, baseline,
 *   PIR decision or finance calculation is inferred;
 * - readiness mirrors the existing controlled review and migration objects rather
 *   than recalculating financial evidence;
 * - a blocked review stays blocked and is never downgraded to partial migration;
 * - exact in-memory continuity is structural provenance only and does not claim
 *   durable-store identity, authentication or approval authority;
 * - retained/deserialized presentation evidence must still reconcile to the
 *   authoritative migration control before downstream handoff can be ready;
 * - selector continuity is exact across the governed selector dimensions and
 *   rejects malformed/extra retained keys rather than normalizing or broadening
 *   the selector at the handoff boundary;
 * - matched source-row continuity compares exact retained ordered identities and
 *   never sorts, deduplicates, normalizes or substitutes population count alone;
 * - malformed retained evidence populations fail closed rather than being coerced
 *   into apparently valid migration evidence;
 * - electricity-specific concepts remain outside this asset-generic boundary.
 */
export function buildPlanVsActualControlledMigrationHandoffBundle(
  reviewBundle: PlanVsActualControlledReviewBundle
): PlanVsActualControlledMigrationHandoffBundle {
  const control = reviewBundle.migrationControl;
  const presentation = reviewBundle.migrationPresentation;

  const stateConsistent =
    control.state === presentation.state &&
    control.migrationEligible === presentation.migrationEligible;
  const evidenceConsistent = evidenceMatches(
    control.evidenceIdentity,
    presentation.evidence
  );
  const controlCandidates = Array.isArray(control.candidates)
    ? control.candidates
    : null;
  const presentationCandidates = Array.isArray(presentation.candidates)
    ? presentation.candidates
    : null;
  const candidatePopulationConsistent =
    controlCandidates !== null &&
    presentationCandidates !== null &&
    controlCandidates.length === presentationCandidates.length &&
    controlCandidates.every((candidate, index) =>
      candidateMatches(candidate, presentationCandidates[index])
    );
  const reviewBlockingReasons = Array.isArray(reviewBundle.blockingReasons)
    ? reviewBundle.blockingReasons
    : null;

  const continuityBlockers = [
    ...(stateConsistent
      ? []
      : [
          'Controlled Plan vs Actual migration state is inconsistent between authoritative control and retained presentation evidence.',
        ]),
    ...(evidenceConsistent
      ? []
      : [
          'Controlled Plan vs Actual migration evidence identity is inconsistent between authoritative control and retained presentation evidence.',
        ]),
    ...(candidatePopulationConsistent
      ? []
      : [
          'Controlled Plan vs Actual migration candidate population, matched source-row identity or governed selector evidence is inconsistent between authoritative control and retained presentation evidence.',
        ]),
    ...(reviewBlockingReasons !== null
      ? []
      : [
          'Controlled Plan vs Actual review blocking-reason population is malformed retained evidence.',
        ]),
  ];

  const blockingReasons = Object.freeze(
    Array.from(
      new Set([
        ...(reviewBlockingReasons ?? []),
        ...continuityBlockers,
        ...(reviewBundle.reviewReady
          ? []
          : ['Controlled Plan vs Actual review is not ready for governed migration handoff.']),
        ...(control.migrationEligible
          ? []
          : ['Controlled Plan vs Actual migration control is not eligible for handoff.']),
        ...(presentation.migrationEligible
          ? []
          : ['Controlled Plan vs Actual migration presentation is not eligible for handoff.']),
      ])
    )
  );

  const handoffReady =
    reviewBundle.reviewReady &&
    control.state === 'RECONCILED_READ_ONLY' &&
    presentation.state === 'RECONCILED_READ_ONLY' &&
    control.migrationEligible &&
    presentation.migrationEligible &&
    stateConsistent &&
    evidenceConsistent &&
    candidatePopulationConsistent &&
    reviewBlockingReasons !== null &&
    blockingReasons.length === 0;

  return Object.freeze({
    reviewBundle,
    migrationControl: control,
    migrationPresentation: presentation,
    handoffReady,
    blockingReasons,
  });
}
