import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';
import {
  attachControlledActualWorkflowBundle,
  type ControlledActualAttachmentResult,
} from './actualProvenanceController';
import {
  buildPlanVsActualGovernanceViewModel,
  type PlanVsActualGovernanceViewModel,
} from './planVsActualPresentationBridge';
import {
  buildPlanVsActualMigrationControl,
  type PlanVsActualMigrationControlResult,
} from './planVsActualMigrationControl';
import type { PlanVsActualFieldReconciliationInput } from './planVsActualFieldReconciliationDiagnostics';
import {
  buildPlanVsActualMigrationPresentation,
  type PlanVsActualMigrationPresentationViewModel,
} from './planVsActualMigrationPresentation';

export interface PlanVsActualControlledReviewBundle {
  attachment: ControlledActualAttachmentResult;
  diagnostics: ActualReleaseDiagnostics;
  governance: PlanVsActualGovernanceViewModel | null;
  migrationControl: PlanVsActualMigrationControlResult;
  migrationPresentation: PlanVsActualMigrationPresentationViewModel;
  reviewReady: boolean;
  blockingReasons: string[];
}

/**
 * Single-source review bundle for the controlled Plan vs Actual migration path.
 *
 * This is deliberately a review/read-only orchestration layer. It binds the
 * provenance session, release diagnostics, Mapping Master governed evidence and
 * field-level reconciliation to the same ControlledActualWorkflowBundle so a UI
 * cannot accidentally combine lifecycle eligibility from one Actual run with
 * migration candidates from another.
 *
 * The authoritative release diagnostics are retained on the review bundle rather
 * than requiring downstream UI to re-supply a diagnostics object independently.
 * This keeps presentation, handoff eligibility and migration reconciliation tied
 * to the same controlled Actual population.
 *
 * The returned review shell and its blocking-reason population are runtime-frozen
 * so downstream consumers cannot mutate the SSOT readiness snapshot after build.
 * Exact nested objects are retained rather than cloned; this preserves the object
 * continuity required by the controlled migration handoff without inventing a
 * persisted-record identity or changing any governed financial evidence.
 *
 * Governance boundaries:
 * - no legacy Plan vs Actual value is mutated;
 * - no Mapping Master selector, accounting classification or FX treatment is inferred;
 * - a blocked controlled attachment remains blocked rather than being downgraded
 *   to a raw-workflow session;
 * - the reconciliation-input population must remain an array at runtime; malformed
 *   retained/deserialized UI evidence fails closed before the migration control is
 *   allowed to treat the review as ready;
 * - baseline approval and PIR case selection remain separate explicit actions;
 * - electricity-specific concepts are absent so the finance lifecycle remains
 *   asset-generic.
 */
export function buildPlanVsActualControlledReviewBundle(
  bundle: ControlledActualWorkflowBundle,
  inputs: PlanVsActualFieldReconciliationInput[]
): PlanVsActualControlledReviewBundle {
  const runtimeInputs = Array.isArray(inputs)
    ? (inputs as PlanVsActualFieldReconciliationInput[])
    : [];
  const inputEnvelopeBlockers = Array.isArray(inputs)
    ? []
    : [
        'Plan vs Actual reconciliation evidence is malformed; expected an array of explicit field reconciliation inputs.',
      ];

  const attachment = attachControlledActualWorkflowBundle(bundle);
  const migrationControl = buildPlanVsActualMigrationControl(bundle, runtimeInputs);
  const migrationPresentation = buildPlanVsActualMigrationPresentation(migrationControl);

  const governance =
    attachment.attached && attachment.session
      ? buildPlanVsActualGovernanceViewModel(attachment.session, bundle.diagnostics)
      : null;

  const blockingReasons = Array.from(
    new Set([
      ...inputEnvelopeBlockers,
      ...attachment.blockingReasons,
      ...migrationControl.blockingReasons,
      ...(governance &&
      governance.baselineHandoffLabel === 'Eligible' &&
      governance.pirHandoffLabel === 'Eligible'
        ? []
        : ['Controlled Actual provenance is not eligible for lifecycle/PIR handoff.']),
    ])
  );

  const reviewReady =
    inputEnvelopeBlockers.length === 0 &&
    attachment.attached &&
    governance !== null &&
    governance.baselineHandoffLabel === 'Eligible' &&
    governance.pirHandoffLabel === 'Eligible' &&
    migrationControl.migrationEligible &&
    migrationPresentation.migrationEligible &&
    blockingReasons.length === 0;

  Object.freeze(blockingReasons);

  return Object.freeze({
    attachment,
    diagnostics: bundle.diagnostics,
    governance,
    migrationControl,
    migrationPresentation,
    reviewReady,
    blockingReasons,
  });
}
