import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';
import {
  buildControlledActualReleaseEvidence,
  type ControlledActualReleaseEvidence,
} from './controlledActualReleaseEvidence';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildLifecycleGovernanceCheckBundle,
  type LifecycleGovernanceCheckBundle,
} from './lifecycleGovernanceChecks';

export interface ControlledActualLifecycleGovernance {
  passed: boolean;
  blockingReasons: string[];
  controlledEvidence: ControlledActualReleaseEvidence;
  lifecycleChecks: LifecycleGovernanceCheckBundle;
}

/**
 * Preferred asset-generic handoff from a controlled Actual workflow into
 * lifecycle/PIR governance checks.
 *
 * This wrapper deliberately composes existing controls instead of creating new
 * economics or approval logic. It first binds release evidence to the exact
 * accepted-source -> released-population trace, then evaluates lifecycle checks
 * against the controlled manifest produced by that same handoff.
 *
 * It does not import, map, classify or mutate Actual rows; invent evidence
 * metadata; approve an Actual-to-Date baseline; select a PIR comparison case;
 * infer accounting treatment; or introduce electricity-specific assumptions.
 */
export function buildControlledActualLifecycleGovernance(
  workflow: ActualWorkflowResult,
  diagnostics: ActualReleaseDiagnostics,
  metadata: ActualReleaseEvidenceMetadata
): ControlledActualLifecycleGovernance {
  const controlledEvidence = buildControlledActualReleaseEvidence(
    workflow,
    diagnostics,
    metadata
  );
  const lifecycleChecks = buildLifecycleGovernanceCheckBundle(
    controlledEvidence.manifest
  );

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
