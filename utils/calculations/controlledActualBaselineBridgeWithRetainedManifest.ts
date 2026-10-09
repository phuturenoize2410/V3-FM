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
import {
  buildEvidencedActualToDateBaseline,
  type EvidencedActualBaselineInput,
} from './evidencedActualBaselineBridge';
import type { MappingRule } from './investmentLifecycleEngine';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';
import type { VerifiedActualBaselineResult } from './verifiedActualBaselineBridge';

export interface ControlledActualBaselineInputWithRetainedManifest
  extends Omit<EvidencedActualBaselineInput, 'workflow' | 'evidenceManifest'> {
  readonly workflow: ActualWorkflowResult;
  readonly diagnostics: ActualReleaseDiagnostics;
  readonly metadata: ActualReleaseEvidenceMetadata;
  readonly mappingRules: ReadonlyArray<MappingRule>;
  readonly mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
  readonly retainedManifest: ActualReleaseEvidenceManifest;
}

export type ControlledActualBaselineResultWithRetainedManifest = Omit<
  VerifiedActualBaselineResult,
  'blockingReasons'
> & {
  readonly blockingReasons: ReadonlyArray<string>;
  readonly controlledEvidence: ControlledActualReleaseEvidenceWithRetainedManifest;
};

/**
 * Strongest asset-generic Actual -> Actual-to-Date baseline handoff when the
 * release is bound to both an exact Mapping Master snapshot and an independently
 * retained Actual release manifest.
 *
 * This closes the retained-evidence chain before any baseline metric builder is
 * allowed to execute:
 * 1. accepted source rows reconcile to the released population;
 * 2. immutable source lineage remains unchanged;
 * 3. released classifications reconcile to the supplied Mapping Master rules;
 * 4. the Mapping Master rule population reconciles to the expected snapshot;
 * 5. release evidence version matches the Mapping Master snapshot version;
 * 6. the freshly derived release manifest reconciles to the independently
 *    retained manifest; and
 * 7. the evidence-bound Actual-to-Date baseline bridge independently checks
 *    cutoff date, released-row count and released amount against the same
 *    workflow population.
 *
 * Composition inputs are read-only at this boundary. The bridge may inspect the
 * governed workflow, Mapping Master population/snapshot and retained manifest,
 * but it must not reorder or replace caller-owned evidence while establishing
 * release-to-baseline continuity. The returned handoff envelope and blocker
 * population are also immutable so downstream consumers cannot create a second
 * apparent release-readiness state by mutating this governed result in place.
 *
 * Boundary: this function does not authenticate or persist external evidence,
 * import/map/repair/reclassify Actuals, calculate or infer KPI semantics,
 * approve/supersede/select baselines, or introduce electricity/commercial
 * assumptions. The resulting baseline remains draft. Passing this structural
 * control is not cryptographic attestation of the retained evidence store.
 */
export function buildControlledActualToDateBaselineWithRetainedManifest(
  input: Readonly<ControlledActualBaselineInputWithRetainedManifest>
): ControlledActualBaselineResultWithRetainedManifest {
  const controlledEvidence =
    buildControlledActualReleaseEvidenceWithRetainedManifest({
      workflow: input.workflow,
      diagnostics: input.diagnostics,
      metadata: input.metadata,
      mappingRules: input.mappingRules,
      mappingMasterSnapshot: input.mappingMasterSnapshot,
      retainedManifest: input.retainedManifest,
    });

  if (!controlledEvidence.evidenceReady) {
    const blockingReasons = Object.freeze([...new Set([
      ...controlledEvidence.blockingReasons,
      'Actual-to-Date baseline requires retained-manifest-bound controlled Actual release evidence.',
    ])]);

    return Object.freeze({
      releasable: false,
      snapshot: null,
      releaseDiagnostics: input.diagnostics,
      blockingReasons,
      controlledEvidence,
    });
  }

  const evidenceManifest =
    controlledEvidence.snapshotEvidence.mappingMasterEvidence.controlledEvidence.manifest;
  const {
    diagnostics: _diagnostics,
    metadata: _metadata,
    mappingRules: _mappingRules,
    mappingMasterSnapshot: _mappingMasterSnapshot,
    retainedManifest: _retainedManifest,
    ...baselineInput
  } = input;

  const baselineResult = buildEvidencedActualToDateBaseline({
    ...baselineInput,
    evidenceManifest,
  });

  const blockingReasons = Object.freeze([...new Set([
    ...controlledEvidence.blockingReasons,
    ...baselineResult.blockingReasons,
  ])]);
  const releasable =
    controlledEvidence.evidenceReady &&
    baselineResult.releasable &&
    blockingReasons.length === 0;

  return Object.freeze({
    ...baselineResult,
    releasable,
    snapshot: releasable ? baselineResult.snapshot : null,
    blockingReasons,
    controlledEvidence,
  });
}
