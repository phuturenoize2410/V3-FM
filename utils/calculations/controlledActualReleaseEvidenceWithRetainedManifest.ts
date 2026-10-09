import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type {
  ActualReleaseEvidenceManifest,
  ActualReleaseEvidenceMetadata,
} from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildControlledActualReleaseEvidenceWithMappingSnapshot,
  type ControlledActualReleaseEvidenceWithMappingSnapshot,
} from './controlledActualReleaseEvidenceWithMappingSnapshot';
import type { MappingRule } from './investmentLifecycleEngine';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';
import {
  diagnoseRetainedActualReleaseManifest,
  type RetainedActualReleaseManifestDiagnostics,
} from './retainedActualReleaseManifestDiagnostics';

export interface ControlledActualReleaseEvidenceWithRetainedManifest {
  readonly evidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly snapshotEvidence: ControlledActualReleaseEvidenceWithMappingSnapshot;
  readonly retainedManifestDiagnostics: RetainedActualReleaseManifestDiagnostics;
}

/**
 * Strongest asset-generic Actual release evidence handoff when both a governed
 * Mapping Master snapshot descriptor and an independently retained Actual release
 * manifest are available.
 *
 * The lower-level controlled evidence path proves source/release reconciliation,
 * immutable source lineage, Mapping Rule lineage and exact Mapping Master snapshot
 * identity. This wrapper additionally proves that the freshly derived release
 * identity matches the externally retained manifest for the same release.
 *
 * The wrapper accepts its composition inputs through read-only contracts. This
 * layer may inspect retained workflow, Mapping Master and manifest evidence, but
 * it must not reorder or replace caller-owned evidence while evaluating release
 * identity continuity.
 *
 * Boundary: this function does not persist/authenticate the retained manifest,
 * import/map/repair/reclassify Actuals, approve evidence or baselines, select PIR
 * cases, calculate finance/electricity economics, or infer commercial terms. A
 * passing result remains structural control evidence rather than a cryptographic
 * attestation of the external store.
 */
export function buildControlledActualReleaseEvidenceWithRetainedManifest(input: Readonly<{
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  metadata: ActualReleaseEvidenceMetadata;
  mappingRules: ReadonlyArray<MappingRule>;
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
  retainedManifest: ActualReleaseEvidenceManifest;
}>): ControlledActualReleaseEvidenceWithRetainedManifest {
  const snapshotEvidence = buildControlledActualReleaseEvidenceWithMappingSnapshot({
    workflow: input.workflow,
    diagnostics: input.diagnostics,
    metadata: input.metadata,
    mappingRules: input.mappingRules,
    mappingMasterSnapshot: input.mappingMasterSnapshot,
  });

  const derivedManifest =
    snapshotEvidence.mappingMasterEvidence.controlledEvidence.manifest;
  const retainedManifestDiagnostics = diagnoseRetainedActualReleaseManifest({
    derived: derivedManifest,
    retained: input.retainedManifest,
  });

  const blockingReasons = [...snapshotEvidence.blockingReasons];

  if (!retainedManifestDiagnostics.passed) {
    blockingReasons.push(
      'Controlled Actual release identity does not reconcile to the independently retained evidence manifest.'
    );
  }

  for (const issue of retainedManifestDiagnostics.issues) {
    blockingReasons.push(`Retained Actual manifest ${issue.code}: ${issue.message}`);
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);

  return Object.freeze({
    evidenceReady:
      snapshotEvidence.evidenceReady &&
      retainedManifestDiagnostics.passed &&
      uniqueBlockingReasons.length === 0,
    blockingReasons: uniqueBlockingReasons,
    snapshotEvidence,
    retainedManifestDiagnostics,
  });
}
