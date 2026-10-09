import type { ControlledActualBaselineApprovalHandoffBundle } from './controlledActualBaselineApprovalHandoffBundle';
import type { ControlledActualLifecycleBaselineHandoffBundle } from './controlledActualLifecycleBaselineHandoffBundle';

export interface ControlledActualLifecycleApprovalHandoffBundle {
  readonly ready: boolean;
  readonly lifecycleBaselineReady: boolean;
  readonly approvalHandoffReady: boolean;
  readonly sameControlledBaseline: boolean;
  readonly lifecycleBaseline: ControlledActualLifecycleBaselineHandoffBundle;
  readonly approvalHandoff: ControlledActualBaselineApprovalHandoffBundle;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Read-only continuity control carrying explicit lifecycle-phase Actual evidence
 * through the Actual-to-Date baseline boundary into explicit approval governance.
 *
 * Both supplied handoffs must already be independently governed. This wrapper adds
 * one narrow requirement: the baseline retained by the lifecycle-to-baseline
 * handoff must be the exact same in-memory controlled Actual baseline consumed by
 * the baseline-to-approval handoff. Together with the upstream workflow identity
 * check, this preserves one structural evidence chain from controlled Actual and
 * its explicit lifecycle row selection into approval without reconstructing
 * provenance from IDs, summaries or similar-looking snapshots.
 *
 * The retained lifecycle row selection remains provenance evidence only. It is not
 * promoted into baseline metrics and does not authorize lifecycle-cost inclusion,
 * capitalization, OPEX/CAPEX treatment, KPI semantics or investment decisions.
 *
 * Governance boundaries:
 * - proves in-memory object continuity only; it does not claim persisted identity
 *   across serialization, registries, databases or external evidence stores;
 * - does not perform or authenticate approval, persist or supersede a baseline;
 * - does not select a PIR case or make an investment decision;
 * - does not authenticate source-system or Mapping Master authority;
 * - does not alter Actual amounts, Mapping Master classifications or finance logic;
 * - remains asset-generic and introduces no electricity, tariff, PPA or EBL terms.
 */
export function buildControlledActualLifecycleApprovalHandoffBundle(
  lifecycleBaseline: ControlledActualLifecycleBaselineHandoffBundle,
  approvalHandoff: ControlledActualBaselineApprovalHandoffBundle
): ControlledActualLifecycleApprovalHandoffBundle {
  const lifecycleBaselineReady =
    lifecycleBaseline.ready &&
    lifecycleBaseline.blockingReasons.length === 0;

  const approvalHandoffReady =
    approvalHandoff.ready &&
    approvalHandoff.blockingReasons.length === 0;

  const sameControlledBaseline =
    lifecycleBaseline.baselineHandoff.baseline === approvalHandoff.controlledBaseline;

  const blockingReasons = [
    ...lifecycleBaseline.blockingReasons,
    ...approvalHandoff.blockingReasons,
  ];

  if (!sameControlledBaseline) {
    blockingReasons.push(
      'Lifecycle-to-baseline evidence and baseline approval handoff must retain the exact same controlled Actual baseline result.'
    );
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);

  const ready =
    lifecycleBaselineReady &&
    approvalHandoffReady &&
    sameControlledBaseline &&
    uniqueBlockingReasons.length === 0;

  return Object.freeze({
    ready,
    lifecycleBaselineReady,
    approvalHandoffReady,
    sameControlledBaseline,
    lifecycleBaseline,
    approvalHandoff,
    blockingReasons: uniqueBlockingReasons,
  });
}
