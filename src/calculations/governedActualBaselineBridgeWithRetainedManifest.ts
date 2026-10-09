import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type {
  ActualReleaseEvidenceManifest,
  ActualReleaseEvidenceMetadata,
} from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildControlledActualLifecycleGovernanceWithRetainedManifest,
  type ControlledActualLifecycleGovernanceWithRetainedManifest,
} from './controlledActualLifecycleGovernanceWithRetainedManifest';
import { buildEvidencedActualToDateBaseline } from './evidencedActualBaselineBridge';
import type { MappingRule } from './investmentLifecycleEngine';
import type { MappingMasterSnapshotDescriptor } from './mappingMasterSnapshotDiagnostics';
import type {
  VerifiedActualBaselineInput,
  VerifiedActualBaselineResult,
} from './verifiedActualBaselineBridge';

export interface GovernedActualBaselineWithRetainedManifestInput
  extends Omit<VerifiedActualBaselineInput, 'workflow'> {
  workflow: ActualWorkflowResult;
  diagnostics: ActualReleaseDiagnostics;
  evidenceMetadata: ActualReleaseEvidenceMetadata;
  mappingRules: MappingRule[];
  mappingMasterSnapshot: MappingMasterSnapshotDescriptor;
  retainedManifest: ActualReleaseEvidenceManifest;
}

export interface GovernedActualBaselineWithRetainedManifestResult {
  releasable: boolean;
  blockingReasons: string[];
  lifecycleGovernance: ControlledActualLifecycleGovernanceWithRetainedManifest;
  baseline: VerifiedActualBaselineResult;
}

/**
 * Strongest asset-generic Actual-to-Date baseline governance handoff when the
 * caller has both an exact Mapping Master snapshot descriptor and an
 * independently retained Actual release manifest.
 *
 * The same workflow instance is used for the retained-manifest-bound lifecycle
 * governance chain and for the evidence-bound draft baseline candidate. This
 * prevents downstream PIR callers from combining a governed lifecycle result
 * with a baseline derived from a different Actual release population.
 *
 * Readiness requires all of the following to pass together:
 * 1. accepted-source -> released-population reconciliation;
 * 2. immutable source-lineage preservation;
 * 3. released-row -> Mapping Master rule-lineage reconciliation;
 * 4. Mapping Master version -> exact structural snapshot reconciliation;
 * 5. derived release manifest -> independently retained manifest identity;
 * 6. lifecycle governance checks against the manifest emitted by that same
 *    controlled evidence chain; and
 * 7. evidence-bound Actual-to-Date baseline checks for cutoff date, released
 *    row count and released amount against the same workflow population.
 *
 * Boundary: this wrapper does not authenticate or persist the retained manifest,
 * import/map/repair/reclassify Actuals, infer KPI/accounting semantics, approve
 * or supersede baselines, select PIR cases, calculate finance/electricity
 * economics, or introduce commercial terms. The resulting baseline remains
 * draft. Passing this structural control is not cryptographic attestation of an
 * external evidence store.
 */
export function buildGovernedActualToDateBaselineWithRetainedManifest(
  input: GovernedActualBaselineWithRetainedManifestInput
): GovernedActualBaselineWithRetainedManifestResult {
  const {
    workflow,
    diagnostics,
    evidenceMetadata,
    mappingRules,
    mappingMasterSnapshot,
    retainedManifest,
    ...baselineInput
  } = input;

  const lifecycleGovernance =
    buildControlledActualLifecycleGovernanceWithRetainedManifest({
      workflow,
      diagnostics,
      metadata: evidenceMetadata,
      mappingRules,
      mappingMasterSnapshot,
      retainedManifest,
    });

  const evidenceManifest =
    lifecycleGovernance.controlledEvidence.snapshotEvidence.mappingMasterEvidence
      .controlledEvidence.manifest;

  const baseline = buildEvidencedActualToDateBaseline({
    ...baselineInput,
    workflow,
    evidenceManifest,
  });

  const blockingReasons = [...new Set([
    ...lifecycleGovernance.blockingReasons,
    ...baseline.blockingReasons,
  ])];

  const releasable =
    lifecycleGovernance.passed &&
    baseline.releasable &&
    baseline.snapshot !== null &&
    blockingReasons.length === 0;

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
    blockingReasons,
    lifecycleGovernance,
    baseline:
      baseline.snapshot === null
        ? baseline
        : {
            ...baseline,
            releasable: false,
            snapshot: null,
            blockingReasons,
          },
  };
}
