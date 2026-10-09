import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildControlledActualReleaseEvidenceWithMappingSnapshot,
  type ControlledActualReleaseEvidenceWithMappingSnapshot,
} from './controlledActualReleaseEvidenceWithMappingSnapshot';
import {
  buildEvidencedActualToDateBaseline,
  type EvidencedActualBaselineInput,
} from './evidencedActualBaselineBridge';
import type { MappingRule } from './investmentLifecycleEngine';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';
import type { VerifiedActualBaselineResult } from './verifiedActualBaselineBridge';

export interface ControlledActualBaselineInputWithMappingSnapshot
  extends Omit<EvidencedActualBaselineInput, 'workflow' | 'evidenceManifest'> {
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  metadata: ActualReleaseEvidenceMetadata;
  mappingRules: MappingRule[];
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
}

export interface ControlledActualBaselineResultWithMappingSnapshot
  extends VerifiedActualBaselineResult {
  controlledEvidence: ControlledActualReleaseEvidenceWithMappingSnapshot;
}

/**
 * Preferred asset-generic Actual -> Actual-to-Date baseline handoff when the
 * release has an exact Mapping Master rule population and an independently
 * retained versioned Mapping Master snapshot descriptor.
 *
 * This closes the provenance chain before any baseline metric builder is
 * allowed to execute:
 * 1. accepted source rows reconcile to the released population;
 * 2. immutable source lineage remains unchanged;
 * 3. released classifications reconcile to the supplied Mapping Master rules;
 * 4. the Mapping Master rule population reconciles to the expected snapshot;
 * 5. release evidence version matches the snapshot version; and
 * 6. the evidence-bound Actual-to-Date baseline bridge independently checks
 *    cutoff date, released-row count and released amount against the same
 *    workflow population.
 *
 * Boundary: this function does not import, map, repair or reclassify Actuals;
 * calculate or infer KPI semantics; approve/supersede/select baselines; persist
 * Mapping Master versions; or introduce electricity/commercial assumptions.
 * The resulting baseline remains draft. The structural Mapping Master snapshot
 * is not a cryptographic attestation and must be retained independently for an
 * evidentiary-grade workflow.
 */
export function buildControlledActualToDateBaselineWithMappingSnapshot(
  input: ControlledActualBaselineInputWithMappingSnapshot
): ControlledActualBaselineResultWithMappingSnapshot {
  const controlledEvidence = buildControlledActualReleaseEvidenceWithMappingSnapshot({
    workflow: input.workflow,
    diagnostics: input.diagnostics,
    metadata: input.metadata,
    mappingRules: input.mappingRules,
    mappingMasterSnapshot: input.mappingMasterSnapshot,
  });

  if (!controlledEvidence.evidenceReady) {
    return {
      releasable: false,
      snapshot: null,
      releaseDiagnostics: input.diagnostics,
      blockingReasons: [...new Set([
        ...controlledEvidence.blockingReasons,
        'Actual-to-Date baseline requires snapshot-bound controlled Actual release evidence.',
      ])],
      controlledEvidence,
    };
  }

  const evidenceManifest =
    controlledEvidence.mappingMasterEvidence.controlledEvidence.manifest;
  const {
    diagnostics: _diagnostics,
    metadata: _metadata,
    mappingRules: _mappingRules,
    mappingMasterSnapshot: _mappingMasterSnapshot,
    ...baselineInput
  } = input;

  const baselineResult = buildEvidencedActualToDateBaseline({
    ...baselineInput,
    evidenceManifest,
  });

  const blockingReasons = [...new Set([
    ...controlledEvidence.blockingReasons,
    ...baselineResult.blockingReasons,
  ])];

  return {
    ...baselineResult,
    releasable:
      controlledEvidence.evidenceReady &&
      baselineResult.releasable &&
      blockingReasons.length === 0,
    snapshot:
      controlledEvidence.evidenceReady &&
      baselineResult.releasable &&
      blockingReasons.length === 0
        ? baselineResult.snapshot
        : null,
    blockingReasons,
    controlledEvidence,
  };
}
