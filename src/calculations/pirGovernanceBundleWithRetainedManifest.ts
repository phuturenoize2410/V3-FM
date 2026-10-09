import type { GovernedActualBaselineWithRetainedManifestResult } from './governedActualBaselineBridgeWithRetainedManifest';
import {
  assessPirActualBaselineIdentity,
  type PirActualBaselineIdentityDiagnostics,
} from './pirActualBaselineIdentityDiagnostics';
import type { PirBaselineSelectionResult } from './pirBaselineSelectionControl';

export interface PirGovernanceBundleWithRetainedManifest {
  ready: boolean;
  blockingReasons: string[];
  governedActualBaseline: GovernedActualBaselineWithRetainedManifestResult;
  baselineSelection: PirBaselineSelectionResult;
  actualBaselineIdentity: PirActualBaselineIdentityDiagnostics;
}

/**
 * Strongest asset-generic PIR governance handoff when the Actual-to-Date baseline
 * is bound to both an exact Mapping Master snapshot and an independently retained
 * Actual release manifest.
 *
 * This wrapper intentionally composes already-owned controls rather than
 * re-performing their logic. PIR readiness requires all of the following to pass
 * together:
 * 1. accepted-source -> released-population reconciliation;
 * 2. immutable source-lineage preservation;
 * 3. released-row -> Mapping Master rule-lineage reconciliation;
 * 4. Mapping Master version -> exact structural snapshot reconciliation;
 * 5. derived release manifest -> independently retained manifest identity;
 * 6. lifecycle governance checks against the same controlled Actual chain;
 * 7. evidence-bound Actual-to-Date baseline checks against that same workflow;
 * 8. explicit approved Plan and Actual baseline selection; and
 * 9. exact draft-to-approved Actual baseline economic/provenance identity, with
 *    only approval metadata permitted to differ.
 *
 * Boundary: this is a read-only governance aggregation. It does not authenticate
 * or persist external evidence, import/map/repair/reclassify Actuals, create,
 * approve, supersede or auto-select baselines, calculate PIR economics, infer
 * KPI/accounting semantics, calculate finance/electricity economics, or introduce
 * PPA, tariff, EBL or other commercial assumptions. Passing this structural
 * control is not cryptographic attestation of an external evidence store.
 */
export function buildPirGovernanceBundleWithRetainedManifest(input: {
  governedActualBaseline: GovernedActualBaselineWithRetainedManifestResult;
  baselineSelection: PirBaselineSelectionResult;
}): PirGovernanceBundleWithRetainedManifest {
  const { governedActualBaseline, baselineSelection } = input;

  const actualBaselineIdentity = assessPirActualBaselineIdentity({
    evidencedDraft: governedActualBaseline.baseline.snapshot,
    selectedApprovedActual: baselineSelection.actualBaseline,
  });

  const blockingReasons = [
    ...governedActualBaseline.blockingReasons,
    ...baselineSelection.errors.map((issue) => issue.message),
    ...actualBaselineIdentity.blockingReasons,
  ];
  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  const ready =
    governedActualBaseline.releasable &&
    governedActualBaseline.baseline.snapshot !== null &&
    governedActualBaseline.lifecycleGovernance.passed &&
    baselineSelection.ready &&
    baselineSelection.planBaseline !== null &&
    baselineSelection.actualBaseline !== null &&
    actualBaselineIdentity.passed &&
    uniqueBlockingReasons.length === 0;

  return {
    ready,
    blockingReasons: uniqueBlockingReasons,
    governedActualBaseline,
    baselineSelection,
    actualBaselineIdentity,
  };
}
