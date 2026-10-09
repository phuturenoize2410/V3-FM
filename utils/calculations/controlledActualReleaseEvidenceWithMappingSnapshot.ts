import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';
import {
  buildControlledActualReleaseEvidenceWithMappingMaster,
  type ControlledActualReleaseEvidenceWithMappingMaster,
} from './controlledActualReleaseEvidenceWithMappingMaster';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { MappingRule } from './investmentLifecycleEngine';
import {
  diagnoseMappingMasterSnapshot,
  type MappingMasterSnapshotDescriptor,
  type MappingMasterSnapshotDiagnostics,
} from './mappingMasterSnapshotDiagnostics';

export interface ControlledActualReleaseEvidenceWithMappingSnapshot {
  readonly evidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly mappingMasterEvidence: ControlledActualReleaseEvidenceWithMappingMaster;
  readonly snapshotDiagnostics: MappingMasterSnapshotDiagnostics;
}

/**
 * Preferred governed Actual-release evidence handoff when the caller has an
 * externally retained Mapping Master snapshot descriptor for the release.
 *
 * This composes:
 * 1. controlled Actual source/release evidence;
 * 2. released-row -> Mapping Master rule-lineage diagnostics; and
 * 3. exact structural rule-population reconciliation to the supplied snapshot.
 *
 * The snapshot version must also equal the explicit Mapping Master version
 * carried by release evidence metadata. No version id is inferred or repaired.
 * Wrapper-owned blockers and snapshot diagnostics are retained as frozen audit
 * snapshots before handoff so downstream consumers cannot mutate an already
 * evaluated Mapping Master governance decision in-memory. The Mapping Master
 * population is accepted through a read-only container contract so this layer
 * cannot reorder or replace externally governed rule evidence while evaluating
 * lineage and snapshot reconciliation.
 *
 * Boundary: this function does not persist or approve the snapshot, map Actual
 * rows, change classifications/economics, create baselines, select PIR cases or
 * claim cryptographic identity. Evidentiary strength depends on the snapshot
 * descriptor having been retained in a governed external repository/version
 * store rather than generated ad hoc from the same runtime rule population.
 */
export function buildControlledActualReleaseEvidenceWithMappingSnapshot(input: Readonly<{
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  metadata: ActualReleaseEvidenceMetadata;
  mappingRules: ReadonlyArray<MappingRule>;
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
}>): ControlledActualReleaseEvidenceWithMappingSnapshot {
  const mappingMasterEvidence = buildControlledActualReleaseEvidenceWithMappingMaster({
    workflow: input.workflow,
    diagnostics: input.diagnostics,
    metadata: input.metadata,
    mappingRules: input.mappingRules,
  });
  const snapshotDiagnostics = diagnoseMappingMasterSnapshot({
    snapshot: input.mappingMasterSnapshot,
    mappingRules: input.mappingRules,
  });
  const blockingReasons = [...mappingMasterEvidence.blockingReasons];

  const evidenceVersion = input.metadata.mappingMasterVersion.trim();
  const snapshotVersion = input.mappingMasterSnapshot.version.trim();

  if (evidenceVersion !== snapshotVersion) {
    blockingReasons.push(
      `Mapping Master evidence version "${evidenceVersion}" does not match snapshot version "${snapshotVersion}".`
    );
  }

  if (!snapshotDiagnostics.passed) {
    blockingReasons.push(
      'Supplied Mapping Master rule population does not reconcile to the expected versioned snapshot.'
    );
  }

  for (const issue of snapshotDiagnostics.issues) {
    blockingReasons.push(`Mapping Master snapshot ${issue.code}: ${issue.message}`);
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const immutableSnapshotDiagnostics = Object.freeze({
    ...snapshotDiagnostics,
    issues: Object.freeze(
      snapshotDiagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ),
  }) as MappingMasterSnapshotDiagnostics;

  return Object.freeze({
    evidenceReady:
      mappingMasterEvidence.evidenceReady &&
      immutableSnapshotDiagnostics.passed &&
      evidenceVersion === snapshotVersion &&
      uniqueBlockingReasons.length === 0,
    blockingReasons: uniqueBlockingReasons,
    mappingMasterEvidence,
    snapshotDiagnostics: immutableSnapshotDiagnostics,
  });
}
