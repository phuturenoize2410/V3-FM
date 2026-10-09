import {
  buildActualReleaseDiagnostics,
  type ActualReleaseDiagnostics,
} from './actualReleaseDiagnostics';
import type {
  ActualReleaseEvidenceMetadata,
} from './actualReleaseEvidenceManifest';
import {
  diagnoseActualMappingReleaseEvidence,
  type ActualMappingReleaseEvidenceDiagnostics,
} from './actualMappingReleaseEvidenceDiagnostics';
import {
  buildControlledActualReleaseEvidenceWithMappingSnapshot,
  type ControlledActualReleaseEvidenceWithMappingSnapshot,
} from './controlledActualReleaseEvidenceWithMappingSnapshot';
import {
  runActualWorkflow,
  type ActualWorkflowInput,
  type ActualWorkflowResult,
} from './actualWorkflowEngine';
import type {
  ActualSourceRow,
  MappingRule,
} from './investmentLifecycleEngine';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';

export interface ControlledActualWorkflowBundleInput extends ActualWorkflowInput {
  metadata: ActualReleaseEvidenceMetadata;
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
}

export interface ControlledActualWorkflowInputEvidence {
  readonly sourceRows: ReadonlyArray<Readonly<ActualSourceRow>>;
  readonly mappingRules: ReadonlyArray<Readonly<MappingRule>>;
  readonly cutoffDate: string;
  readonly metadata: Readonly<ActualReleaseEvidenceMetadata>;
  readonly mappingMasterSnapshot: Readonly<{
    version: string;
    ruleSignatures: ReadonlyArray<string>;
  }>;
}

export interface ControlledActualWorkflowBundle {
  readonly inputEvidence: ControlledActualWorkflowInputEvidence;
  readonly workflow: ActualWorkflowResult;
  readonly diagnostics: ActualReleaseDiagnostics;
  readonly mappingReleaseEvidenceDiagnostics: ActualMappingReleaseEvidenceDiagnostics;
  readonly governedEvidence: ControlledActualReleaseEvidenceWithMappingSnapshot;
  readonly lifecycleEvidenceReady: boolean;
  readonly actualToDateEvidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

function retainInputEvidence(
  input: ControlledActualWorkflowBundleInput
): ControlledActualWorkflowInputEvidence {
  const sourceRows = Object.freeze(
    input.rows.map((row) => Object.freeze({ ...row }))
  );
  const mappingRules = Object.freeze(
    input.mappingRules.map((rule) => Object.freeze({ ...rule }))
  );
  const metadata = Object.freeze({ ...input.metadata });
  const mappingMasterSnapshot = Object.freeze({
    version: input.mappingMasterSnapshot.version,
    ruleSignatures: Object.freeze([...input.mappingMasterSnapshot.ruleSignatures]),
  });

  return Object.freeze({
    sourceRows,
    mappingRules,
    cutoffDate: input.cutoffDate,
    metadata,
    mappingMasterSnapshot,
  });
}

function freezeEvidenceGraph<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value as Record<string, unknown>).forEach((nestedValue) => {
    freezeEvidenceGraph(nestedValue);
  });

  return Object.freeze(value);
}

/**
 * Single-source orchestrator for a controlled Actual release candidate.
 *
 * The purpose of this bundle is to stop callers from independently constructing
 * workflow, release diagnostics and Mapping Master snapshot evidence from
 * different populations or rule sets. All layers are derived in sequence from
 * the same explicit rows, Mapping Master rules and cutoff supplied here.
 *
 * The exact caller-supplied source population, Mapping Master population,
 * cutoff, metadata and expected Mapping Master snapshot are also retained as
 * immutable read-only evidence. Downstream baseline/PIR/reporting consumers can
 * therefore reference the same governed run without re-fetching or
 * reconstructing its input population from loose identifiers.
 *
 * The workflow result and release diagnostics retained by this authoritative
 * bundle are frozen as complete evidence graphs before downstream governance is
 * constructed. This preserves the exact evaluated validation, Mapping Master,
 * cutoff, release and diagnostic populations in-memory rather than exposing a
 * mutable parallel path beside the already-frozen governed evidence wrappers.
 * Freezing changes no calculation, classification, amount or release decision.
 *
 * Final Mapping Master release evidence is also evaluated from the exact released
 * population. This composes the existing exact-string release boundary into the
 * authoritative workflow bundle instead of leaving it as an optional standalone
 * diagnostic. Mapped category, subcategory, line-item, accounting-treatment and
 * debt-eligibility evidence is never trimmed, repaired or reclassified here: if
 * the supplied Mapping Master output does not satisfy that boundary, lifecycle
 * readiness fails closed while the original evidence remains retained.
 *
 * `lifecycleEvidenceReady` remains the generic controlled-release gate. It may
 * legitimately govern explicit non-Actual lifecycle classes where a downstream
 * use case is designed for them. `actualToDateEvidenceReady` is deliberately
 * stricter: it additionally requires the released population itself to be
 * explicitly Actual-only before an Actual-to-Date consumer can proceed.
 *
 * Governance boundaries remain unchanged:
 * - source rows, Mapping Master rules, metadata and retained snapshot descriptor
 *   are caller-supplied evidence and are never invented or repaired;
 * - retained input evidence is structural provenance only; freezing it does not
 *   authenticate the source system, preparer or Mapping Master authority;
 * - mapping/classification is performed only by the existing Actual workflow;
 * - this bundle does not approve an Actual-to-Date baseline or select a PIR case;
 * - no accounting, project-finance or commercial economics are calculated here;
 * - electricity-specific logic is deliberately absent from this asset-generic
 *   lifecycle control.
 */
export function buildControlledActualWorkflowBundle(
  input: ControlledActualWorkflowBundleInput
): ControlledActualWorkflowBundle {
  const inputEvidence = retainInputEvidence(input);

  const workflow = freezeEvidenceGraph(
    runActualWorkflow({
      rows: inputEvidence.sourceRows.map((row) => ({ ...row })),
      mappingRules: inputEvidence.mappingRules.map((rule) => ({ ...rule })),
      cutoffDate: inputEvidence.cutoffDate,
    })
  );

  const diagnostics = freezeEvidenceGraph(buildActualReleaseDiagnostics(workflow));
  const mappingReleaseEvidenceDiagnostics = diagnoseActualMappingReleaseEvidence(
    workflow.releasedRows
  );

  const governedEvidence = buildControlledActualReleaseEvidenceWithMappingSnapshot({
    workflow,
    diagnostics,
    metadata: { ...inputEvidence.metadata },
    mappingRules: inputEvidence.mappingRules.map((rule) => ({ ...rule })),
    mappingMasterSnapshot: {
      version: inputEvidence.mappingMasterSnapshot.version,
      ruleSignatures: [...inputEvidence.mappingMasterSnapshot.ruleSignatures],
    },
  });

  const blockingReasons = Array.from(
    new Set([
      ...workflow.blockingReasons,
      ...mappingReleaseEvidenceDiagnostics.issues.map(
        (issue) => `Mapping Master release evidence ${issue.code}: ${issue.message}`
      ),
      ...governedEvidence.blockingReasons,
    ])
  );

  const lifecycleEvidenceReady =
    workflow.releasableToLifecycle &&
    diagnostics.releaseReady &&
    mappingReleaseEvidenceDiagnostics.releaseReady &&
    governedEvidence.evidenceReady &&
    blockingReasons.length === 0;

  const actualToDateEvidenceReady =
    lifecycleEvidenceReady && diagnostics.actualOnlyReleaseReady;

  return Object.freeze({
    inputEvidence,
    workflow,
    diagnostics,
    mappingReleaseEvidenceDiagnostics,
    governedEvidence,
    lifecycleEvidenceReady,
    actualToDateEvidenceReady,
    blockingReasons: Object.freeze(blockingReasons),
  });
}
