import type { ActualReleaseEvidenceManifest } from './actualReleaseEvidenceManifest';
import {
  buildControlledActualToDateBaselineWithRetainedManifest,
  type ControlledActualBaselineResultWithRetainedManifest,
} from './controlledActualBaselineBridgeWithRetainedManifest';
import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';
import type { MappedActualRow } from './investmentLifecycleEngine';

export interface ControlledActualWorkflowBaselineHandoffInput {
  workflowBundle: ControlledActualWorkflowBundle;
  retainedManifest: ActualReleaseEvidenceManifest;
  baselineId: string;
  baselineName: string;
  createdAt: string;
  projectId?: string;
  modelVersion?: string;
  predecessorId?: string;
  notes?: string;
  buildMetrics: (releasedRows: MappedActualRow[]) => Record<string, number | null>;
}

export interface ControlledActualWorkflowBaselineHandoffBundle {
  readonly ready: boolean;
  readonly workflowBundle: ControlledActualWorkflowBundle;
  readonly baseline: ControlledActualBaselineResultWithRetainedManifest;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Asset-generic SSOT handoff from a governed Actual workflow bundle into an
 * Actual-to-Date baseline candidate.
 *
 * Unlike the lower-level retained-manifest bridge, callers do not resupply the
 * Actual workflow diagnostics, release metadata, Mapping Master rules or Mapping
 * Master snapshot descriptor. Those inputs are taken only from the retained
 * `ControlledActualWorkflowBundle` evidence that produced the governed release.
 * This prevents a downstream caller from accidentally pairing one governed
 * Actual run with a second, merely similar Mapping Master/input population.
 *
 * The independently retained release manifest remains caller supplied because it
 * is intentionally external evidence. Baseline identity fields and the metric
 * builder also remain explicit caller governance inputs; KPI semantics are not
 * inferred from mapped categories.
 *
 * This handoff requires the workflow bundle's stricter
 * `actualToDateEvidenceReady` gate, not merely generic lifecycle release
 * readiness. Explicit commitment / ETC / budget / model-baseline rows may remain
 * valid controlled lifecycle evidence, but they cannot be promoted into an
 * Actual-to-Date baseline candidate by this boundary.
 *
 * `ready` means structural evidence continuity into a releasable draft baseline
 * only. It does not authenticate the source system, preparer, Mapping Master or
 * retained evidence store; approve/persist/supersede a baseline; select a PIR
 * case; calculate commercial economics; or introduce electricity, tariff, PPA or
 * EBL assumptions.
 */
export function buildControlledActualWorkflowBaselineHandoffBundle(
  input: ControlledActualWorkflowBaselineHandoffInput
): ControlledActualWorkflowBaselineHandoffBundle {
  const { workflowBundle } = input;

  const baseline = buildControlledActualToDateBaselineWithRetainedManifest({
    workflow: workflowBundle.workflow,
    diagnostics: workflowBundle.diagnostics,
    metadata: { ...workflowBundle.inputEvidence.metadata },
    mappingRules: workflowBundle.inputEvidence.mappingRules.map((rule) => ({ ...rule })),
    mappingMasterSnapshot: {
      version: workflowBundle.inputEvidence.mappingMasterSnapshot.version,
      ruleSignatures: [...workflowBundle.inputEvidence.mappingMasterSnapshot.ruleSignatures],
    },
    retainedManifest: input.retainedManifest,
    baselineId: input.baselineId,
    baselineName: input.baselineName,
    createdAt: input.createdAt,
    projectId: input.projectId,
    modelVersion: input.modelVersion,
    predecessorId: input.predecessorId,
    notes: input.notes,
    buildMetrics: input.buildMetrics,
  });

  const blockingReasons = [
    ...workflowBundle.blockingReasons,
    ...baseline.blockingReasons,
  ];

  if (!workflowBundle.lifecycleEvidenceReady) {
    blockingReasons.push(
      'Actual-to-Date baseline handoff requires a lifecycle-ready controlled Actual workflow bundle.'
    );
  }

  if (!workflowBundle.actualToDateEvidenceReady) {
    blockingReasons.push(
      'Actual-to-Date baseline handoff requires an explicitly Actual-only controlled release; non-Actual lifecycle data classes cannot be promoted into Actual-to-Date evidence.'
    );
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const ready =
    workflowBundle.actualToDateEvidenceReady &&
    baseline.releasable &&
    baseline.snapshot !== null &&
    baseline.controlledEvidence.evidenceReady &&
    uniqueBlockingReasons.length === 0;

  return Object.freeze({
    ready,
    workflowBundle,
    baseline,
    blockingReasons: uniqueBlockingReasons,
  });
}
