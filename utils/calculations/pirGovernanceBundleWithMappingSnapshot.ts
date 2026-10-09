import type { GovernedActualBaselineWithMappingSnapshotResult } from './governedActualBaselineBridgeWithMappingSnapshot';
import {
  assessPirActualBaselineIdentity,
  type PirActualBaselineIdentityDiagnostics,
} from './pirActualBaselineIdentityDiagnostics';
import type { PirBaselineSelectionResult } from './pirBaselineSelectionControl';

export interface PirGovernanceBundleWithMappingSnapshot {
  ready: boolean;
  blockingReasons: string[];
  governedActualBaseline: GovernedActualBaselineWithMappingSnapshotResult;
  baselineSelection: PirBaselineSelectionResult;
  actualBaselineIdentity: PirActualBaselineIdentityDiagnostics;
}

/**
 * Preferred asset-generic PIR governance handoff when controlled Actual evidence
 * is bound to an independently retained Mapping Master snapshot descriptor.
 *
 * This wrapper deliberately reuses already-owned controls rather than rebuilding
 * their logic. PIR readiness requires all of the following to be true together:
 * 1. the governed Actual-to-Date baseline handoff is releasable, including
 *    accepted-source, immutable lineage, Mapping Rule lineage and Mapping Master
 *    snapshot reconciliation;
 * 2. plan and Actual PIR baselines were selected explicitly and both pass the
 *    existing baseline-selection control; and
 * 3. the selected approved Actual baseline is the same economic/provenance
 *    snapshot as the evidence-bound draft candidate, with only approval metadata
 *    permitted to differ.
 *
 * Boundary: this is a read-only governance aggregation. It does not import/map
 * Actuals; create, approve, supersede or auto-select baselines; calculate PIR
 * economics; reinterpret baseline metrics; persist Mapping Master evidence; or
 * introduce electricity/commercial assumptions. Mapping Master structural
 * snapshots remain evidence descriptors rather than cryptographic attestations.
 */
export function buildPirGovernanceBundleWithMappingSnapshot(input: {
  governedActualBaseline: GovernedActualBaselineWithMappingSnapshotResult;
  baselineSelection: PirBaselineSelectionResult;
}): PirGovernanceBundleWithMappingSnapshot {
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
