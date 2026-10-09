import {
  buildActualLifecyclePhaseEvidenceDiagnostics,
  type LifecyclePhaseEvidenceDiagnostics,
} from './actualLifecyclePhaseEvidenceDiagnostics';
import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';

export interface ControlledActualLifecyclePhaseEvidenceBundle {
  readonly ready: boolean;
  readonly workflowReady: boolean;
  readonly phaseEvidenceReady: boolean;
  readonly workflow: ControlledActualWorkflowBundle;
  readonly requestedRowIds: ReadonlyArray<string>;
  readonly diagnostics: LifecyclePhaseEvidenceDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Single-source governance handoff from a controlled Actual workflow into
 * lifecycle-phase evidence.
 *
 * The phase diagnostic is always built from the exact released-row population
 * retained by the supplied ControlledActualWorkflowBundle. Callers therefore do
 * not provide a second released Actual population that could be paired with
 * provenance, Mapping Master or release evidence from a different workflow run.
 *
 * The requested source-row IDs remain an explicit caller selection. The exact
 * caller-supplied selection is retained as an immutable read-only snapshot so
 * downstream Actual-to-Date/PIR governance can consume the same row-selection
 * evidence without reconstructing it from diagnostic summaries.
 *
 * This bundle does not infer which GL/WBS/cost rows belong to lifecycle
 * monitoring and does not derive lifecycle phase from dates, project schedules,
 * account codes or model timing.
 *
 * Governance boundaries:
 * - requires the controlled Actual workflow to be lifecycle-evidence ready;
 * - preserves Mapping Master classifications and Actual amounts unchanged;
 * - retains requested row IDs as provenance evidence only; it does not validate
 *   business ownership or authorize lifecycle-cost inclusion beyond the existing
 *   diagnostics;
 * - does not approve, persist or supersede an Actual-to-Date baseline;
 * - does not select a PIR case or define KPI/accounting semantics;
 * - does not infer lifecycle-cost inclusion or accounting treatment from phase;
 * - remains asset-generic; electricity-specific operating and commercial logic
 *   stays outside this finance/lifecycle governance boundary.
 */
export function buildControlledActualLifecyclePhaseEvidenceBundle(
  workflow: ControlledActualWorkflowBundle,
  requestedRowIds: ReadonlyArray<string>
): ControlledActualLifecyclePhaseEvidenceBundle {
  const retainedRequestedRowIds = Object.freeze([...requestedRowIds]);
  const diagnostics = buildActualLifecyclePhaseEvidenceDiagnostics(
    workflow.workflow.releasedRows,
    retainedRequestedRowIds
  );

  const workflowReady =
    workflow.lifecycleEvidenceReady &&
    workflow.blockingReasons.length === 0;

  const phaseEvidenceReady =
    diagnostics.ready &&
    diagnostics.issues.length === 0;

  const blockingReasons = Array.from(
    new Set([
      ...workflow.blockingReasons,
      ...diagnostics.issues.map((issue) => issue.message),
    ])
  );

  const ready =
    workflowReady &&
    phaseEvidenceReady &&
    blockingReasons.length === 0;

  return Object.freeze({
    ready,
    workflowReady,
    phaseEvidenceReady,
    workflow,
    requestedRowIds: retainedRequestedRowIds,
    diagnostics,
    blockingReasons: Object.freeze(blockingReasons),
  });
}
