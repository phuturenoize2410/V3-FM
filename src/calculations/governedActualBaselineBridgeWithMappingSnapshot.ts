import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildControlledActualLifecycleGovernanceWithMappingSnapshot,
  type ControlledActualLifecycleGovernanceWithMappingSnapshot,
} from './controlledActualLifecycleGovernanceWithMappingSnapshot';
import {
  buildEvidencedActualToDateBaseline,
} from './evidencedActualBaselineBridge';
import type { MappingRule } from './investmentLifecycleEngine';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';
import type {
  VerifiedActualBaselineInput,
  VerifiedActualBaselineResult,
} from './verifiedActualBaselineBridge';

export interface GovernedActualBaselineWithMappingSnapshotInput
  extends Omit<VerifiedActualBaselineInput, 'workflow'> {
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  evidenceMetadata: ActualReleaseEvidenceMetadata;
  mappingRules: MappingRule[];
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
}

export interface GovernedActualBaselineWithMappingSnapshotResult {
  releasable: boolean;
  blockingReasons: string[];
  lifecycleGovernance: ControlledActualLifecycleGovernanceWithMappingSnapshot;
  baseline: VerifiedActualBaselineResult;
}

/**
 * Preferred asset-generic Actual-to-Date baseline handoff when the caller has
 * a controlled Actual Import + Mapping Master workflow and an independently
 * retained Mapping Master snapshot descriptor.
 *
 * The same workflow instance is used to build the strongest available Actual
 * lifecycle-governance chain and the evidence-bound baseline candidate. This
 * prevents downstream callers from pairing a free-standing evidence manifest
 * with a different workflow population before baseline creation.
 *
 * Readiness requires both:
 * 1. controlled Actual lifecycle governance, including accepted-source,
 *    immutable-source-lineage, Mapping Rule lineage and Mapping Master snapshot
 *    reconciliation; and
 * 2. the existing evidence-bound Actual-to-Date baseline bridge.
 *
 * Boundary: this wrapper does not import, map, classify or repair Actual rows;
 * infer KPI/accounting semantics; approve or supersede a baseline; choose a PIR
 * comparison case; calculate PIR economics; persist Mapping Master snapshots;
 * or introduce electricity/commercial assumptions. The resulting baseline
 * remains draft. The Mapping Master snapshot descriptor is structural evidence,
 * not a cryptographic attestation, and should be retained independently by a
 * governed external repository/version store for evidentiary use.
 */
export function buildGovernedActualToDateBaselineWithMappingSnapshot(
  input: GovernedActualBaselineWithMappingSnapshotInput
): GovernedActualBaselineWithMappingSnapshotResult {
  const {
    workflow,
    diagnostics,
    evidenceMetadata,
    mappingRules,
    mappingMasterSnapshot,
    ...baselineInput
  } = input;

  const lifecycleGovernance =
    buildControlledActualLifecycleGovernanceWithMappingSnapshot({
      workflow,
      diagnostics,
      metadata: evidenceMetadata,
      mappingRules,
      mappingMasterSnapshot,
    });

  const evidenceManifest =
    lifecycleGovernance.controlledEvidence.mappingMasterEvidence.controlledEvidence.manifest;

  const baseline = buildEvidencedActualToDateBaseline({
    ...baselineInput,
    workflow,
    evidenceManifest,
  });

  const blockingReasons = [
    ...lifecycleGovernance.blockingReasons,
    ...baseline.blockingReasons,
  ];
  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  const releasable =
    lifecycleGovernance.passed &&
    baseline.releasable &&
    baseline.snapshot !== null &&
    uniqueBlockingReasons.length === 0;

  if (releasable) {
    return {
      releasable: true,
      blockingReasons: [],
      lifecycleGovernance,
      baseline,
    };
  }

  return {
    releasable: false,
    blockingReasons: uniqueBlockingReasons,
    lifecycleGovernance,
    baseline:
      baseline.snapshot === null
        ? baseline
        : {
            ...baseline,
            releasable: false,
            snapshot: null,
            blockingReasons: uniqueBlockingReasons,
          },
  };
}
