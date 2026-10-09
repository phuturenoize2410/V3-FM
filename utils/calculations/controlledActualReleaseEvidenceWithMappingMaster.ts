import {
  diagnoseActualMappingReleaseEvidence,
  type ActualMappingReleaseEvidenceDiagnostics,
} from './actualMappingReleaseEvidenceDiagnostics';
import {
  diagnoseActualMappingRuleLineage,
  type ActualMappingRuleLineageDiagnostics,
} from './actualMappingRuleLineageDiagnostics';
import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';
import {
  buildControlledActualReleaseEvidence,
  type ControlledActualReleaseEvidence,
} from './controlledActualReleaseEvidence';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { MappingRule } from './investmentLifecycleEngine';

export interface ControlledActualReleaseEvidenceWithMappingMaster {
  readonly evidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly controlledEvidence: ControlledActualReleaseEvidence;
  readonly mappingReleaseEvidenceDiagnostics: ActualMappingReleaseEvidenceDiagnostics;
  readonly mappingRuleLineageDiagnostics: ActualMappingRuleLineageDiagnostics;
}

/**
 * Preferred governed Actual-release evidence handoff when the exact Mapping Master
 * rule population used for release is available to the caller.
 *
 * It composes the existing controlled Actual evidence controls with independent
 * mapped-row release-evidence diagnostics and released-row -> Mapping Master
 * rule-lineage diagnostics. This prevents a release from being represented as
 * fully controlled when mapped rows no longer carry exact, population-unique
 * source identity or complete Mapping Master output evidence, or when those
 * outputs no longer agree with the explicitly supplied rule population.
 *
 * The wrapper-owned blocker list and Mapping Master diagnostics are retained as
 * frozen snapshots before handoff. This keeps downstream consumers from mutating
 * a previously evaluated governance decision in-memory while leaving the
 * diagnostic builders themselves as the authoritative sources of meaning. The
 * Mapping Master population is accepted through a read-only container contract
 * because this governance layer only observes externally governed rule evidence;
 * it does not own, reorder, repair or mutate the supplied population.
 *
 * Important boundary: `metadata.mappingMasterVersion` remains an external
 * governance identifier supplied by the caller. This wrapper does not hash,
 * version, persist or approve Mapping Master rules and therefore does not claim
 * cryptographic/version-store identity between the string version id and the
 * supplied rule population. A future repository/version-store layer may bind
 * those two artifacts explicitly without changing classification economics.
 */
export function buildControlledActualReleaseEvidenceWithMappingMaster(input: Readonly<{
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  metadata: ActualReleaseEvidenceMetadata;
  mappingRules: ReadonlyArray<MappingRule>;
}>): ControlledActualReleaseEvidenceWithMappingMaster {
  const controlledEvidence = buildControlledActualReleaseEvidence(
    input.workflow,
    input.diagnostics,
    input.metadata
  );
  const mappingReleaseEvidenceDiagnostics = diagnoseActualMappingReleaseEvidence(
    input.workflow.releasedRows
  );
  const mappingRuleLineageDiagnostics = diagnoseActualMappingRuleLineage({
    workflow: input.workflow,
    mappingRules: input.mappingRules,
  });
  const blockingReasons = [...controlledEvidence.blockingReasons];

  if (!mappingReleaseEvidenceDiagnostics.releaseReady) {
    blockingReasons.push(
      'Released Actual rows do not satisfy exact Mapping Master release-evidence requirements.'
    );
  }

  for (const issue of mappingReleaseEvidenceDiagnostics.issues) {
    blockingReasons.push(`Mapping release evidence ${issue.code}: ${issue.message}`);
  }

  if (!mappingRuleLineageDiagnostics.passed) {
    blockingReasons.push(
      'Released Actual classification does not reconcile to the supplied Mapping Master rule population.'
    );
  }

  for (const issue of mappingRuleLineageDiagnostics.issues) {
    blockingReasons.push(`Mapping Master lineage ${issue.code}: ${issue.message}`);
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const immutableMappingReleaseEvidenceDiagnostics = Object.freeze({
    ...mappingReleaseEvidenceDiagnostics,
    retainedRows: Object.freeze([...mappingReleaseEvidenceDiagnostics.retainedRows]),
    issues: Object.freeze(
      mappingReleaseEvidenceDiagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ),
  }) as ActualMappingReleaseEvidenceDiagnostics;
  const immutableMappingRuleLineageDiagnostics = Object.freeze({
    ...mappingRuleLineageDiagnostics,
    referencedRuleIds: Object.freeze([
      ...mappingRuleLineageDiagnostics.referencedRuleIds,
    ]),
    issues: Object.freeze(
      mappingRuleLineageDiagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ),
  }) as ActualMappingRuleLineageDiagnostics;

  return Object.freeze({
    evidenceReady:
      controlledEvidence.evidenceReady &&
      immutableMappingReleaseEvidenceDiagnostics.releaseReady &&
      immutableMappingRuleLineageDiagnostics.passed &&
      uniqueBlockingReasons.length === 0,
    blockingReasons: uniqueBlockingReasons,
    controlledEvidence,
    mappingReleaseEvidenceDiagnostics: immutableMappingReleaseEvidenceDiagnostics,
    mappingRuleLineageDiagnostics: immutableMappingRuleLineageDiagnostics,
  });
}
