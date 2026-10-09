import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type {
  ActualReleaseEvidenceManifest,
  ActualReleaseEvidenceMetadata,
} from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildControlledActualReleaseEvidenceWithRetainedManifest,
  type ControlledActualReleaseEvidenceWithRetainedManifest,
} from './controlledActualReleaseEvidenceWithRetainedManifest';
import type { MappingRule } from './investmentLifecycleEngine';
import {
  buildLifecycleGovernanceCheckBundle,
  type LifecycleGovernanceCheckBundle,
} from './lifecycleGovernanceChecks';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';

export interface ControlledActualLifecycleGovernanceWithRetainedManifest {
  passed: boolean;
  blockingReasons: string[];
  controlledEvidence: ControlledActualReleaseEvidenceWithRetainedManifest;
  lifecycleChecks: LifecycleGovernanceCheckBundle;
}

/**
 * Strongest asset-generic lifecycle/PIR Actual-governance handoff when the caller
 * has the exact Mapping Master rule population, a versioned Mapping Master
 * snapshot descriptor, and an independently retained Actual release manifest.
 *
 * This composes the retained-manifest evidence path before lifecycle governance
 * checks are evaluated. Downstream callers therefore do not need to pair a
 * lifecycle check bundle with a free-standing retained manifest themselves.
 * Readiness requires all of the following to pass for the same workflow:
 * 1. accepted-source -> released-population reconciliation;
 * 2. immutable source-lineage preservation;
 * 3. released-row -> Mapping Master rule-lineage reconciliation;
 * 4. Mapping Master version -> exact structural snapshot reconciliation;
 * 5. derived release manifest -> independently retained manifest identity; and
 * 6. lifecycle governance checks against the manifest emitted by that same
 *    controlled evidence chain.
 *
 * Boundary: this wrapper does not authenticate or persist the retained manifest,
 * import/map/repair/reclassify Actuals, approve evidence or baselines, supersede
 * versions, select PIR cases, calculate finance/electricity economics, infer
 * accounting/KPI semantics, or introduce commercial terms. A passing result is
 * structural governance evidence, not cryptographic attestation of the external
 * evidence store. Electricity-specific logic remains outside this core wrapper.
 */
export function buildControlledActualLifecycleGovernanceWithRetainedManifest(input: {
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  metadata: ActualReleaseEvidenceMetadata;
  mappingRules: MappingRule[];
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
  retainedManifest: ActualReleaseEvidenceManifest;
}): ControlledActualLifecycleGovernanceWithRetainedManifest {
  const controlledEvidence =
    buildControlledActualReleaseEvidenceWithRetainedManifest(input);
  const manifest =
    controlledEvidence.snapshotEvidence.mappingMasterEvidence.controlledEvidence.manifest;
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
