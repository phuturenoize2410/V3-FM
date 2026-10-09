import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildControlledActualReleaseEvidenceWithMappingSnapshot,
  type ControlledActualReleaseEvidenceWithMappingSnapshot,
} from './controlledActualReleaseEvidenceWithMappingSnapshot';
import type { MappingRule } from './investmentLifecycleEngine';
import {
  buildLifecycleGovernanceCheckBundle,
  type LifecycleGovernanceCheckBundle,
} from './lifecycleGovernanceChecks';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';

export interface ControlledActualLifecycleGovernanceWithMappingSnapshot {
  passed: boolean;
  blockingReasons: string[];
  controlledEvidence: ControlledActualReleaseEvidenceWithMappingSnapshot;
  lifecycleChecks: LifecycleGovernanceCheckBundle;
}

/**
 * Preferred asset-generic lifecycle/PIR governance handoff when the caller has
 * both the exact Mapping Master rule population and an externally retained
 * versioned Mapping Master snapshot descriptor for the Actual release.
 *
 * This composes the strongest currently available controlled Actual evidence
 * chain before evaluating lifecycle governance checks:
 * 1. accepted-source -> released-population reconciliation;
 * 2. immutable source-lineage preservation;
 * 3. released-row -> Mapping Master rule-lineage reconciliation;
 * 4. Mapping Master version -> exact structural snapshot reconciliation; and
 * 5. lifecycle governance checks against the manifest produced by that same
 *    controlled evidence chain.
 *
 * Boundary: this wrapper does not import, map, classify or repair Actual rows;
 * calculate economics; persist/approve Mapping Master snapshots; approve or
 * supersede baselines; select PIR comparison cases; infer accounting semantics;
 * or introduce electricity-specific/commercial assumptions. A structural
 * Mapping Master snapshot is not a cryptographic attestation, and evidentiary
 * strength still depends on the descriptor being retained independently in a
 * governed external repository/version store rather than generated ad hoc from
 * the same runtime rule population.
 */
export function buildControlledActualLifecycleGovernanceWithMappingSnapshot(input: {
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  metadata: ActualReleaseEvidenceMetadata;
  mappingRules: MappingRule[];
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
}): ControlledActualLifecycleGovernanceWithMappingSnapshot {
  const controlledEvidence = buildControlledActualReleaseEvidenceWithMappingSnapshot(input);
  const manifest =
    controlledEvidence.mappingMasterEvidence.controlledEvidence.manifest;
  const lifecycleChecks = buildLifecycleGovernanceCheckBundle(manifest);

  const blockingReasons = [
    ...controlledEvidence.blockingReasons,
    ...lifecycleChecks.blockingReasons,
  ];
  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  return {
    passed:
      controlledEvidence.evidenceReady &&
      lifecycleChecks.passed &&
      uniqueBlockingReasons.length === 0,
    blockingReasons: uniqueBlockingReasons,
    controlledEvidence,
    lifecycleChecks,
  };
}
