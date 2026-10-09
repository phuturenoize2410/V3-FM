import type { ControlledActualApprovalPirHandoffBundle } from './controlledActualApprovalPirHandoffBundle';
import type { ControlledActualLifecycleApprovalHandoffBundle } from './controlledActualLifecycleApprovalHandoffBundle';

export interface ControlledActualLifecycleApprovalPirHandoffBundle {
  readonly ready: boolean;
  readonly lifecycleApprovalReady: boolean;
  readonly approvalPirReady: boolean;
  readonly sameApprovalHandoff: boolean;
  readonly lifecycleApproval: ControlledActualLifecycleApprovalHandoffBundle;
  readonly approvalPir: ControlledActualApprovalPirHandoffBundle;
  readonly requestedRowIds: ReadonlyArray<string>;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Read-only continuity control carrying explicit lifecycle-phase Actual evidence
 * through baseline approval into explicit PIR baseline selection.
 *
 * The supplied lifecycle-to-approval chain and approval-to-PIR handoff must each
 * already be independently governed. This wrapper adds one narrow requirement:
 * both paths must retain the exact same in-memory controlled Actual baseline
 * approval handoff. That prevents lifecycle evidence from one controlled Actual
 * approval chain being paired with a PIR selection from another merely similar
 * approval chain.
 *
 * The exact caller-selected lifecycle source-row IDs are carried from the retained
 * lifecycle evidence bundle without reconstructing them from diagnostics, baseline
 * metrics or PIR summaries. They remain provenance evidence only. The row-ID list
 * is snapshotted at this handoff so downstream audit evidence cannot drift if an
 * upstream caller still owns a mutable array reference.
 *
 * Governance boundaries:
 * - proves in-memory continuity only; it does not claim persisted identity across
 *   serialization, registries, databases or external evidence stores;
 * - does not perform or authenticate approval, persist or supersede a baseline;
 * - does not select a PIR case or make an investment decision;
 * - does not promote lifecycle row selection into lifecycle-cost inclusion,
 *   capitalization, OPEX/CAPEX treatment, KPI or accounting semantics;
 * - does not authenticate source-system, Mapping Master or selector authority;
 * - does not alter Actual amounts, Mapping Master classifications or finance logic;
 * - remains asset-generic and introduces no electricity, tariff, PPA or EBL terms.
 */
export function buildControlledActualLifecycleApprovalPirHandoffBundle(
  lifecycleApproval: ControlledActualLifecycleApprovalHandoffBundle,
  approvalPir: ControlledActualApprovalPirHandoffBundle
): ControlledActualLifecycleApprovalPirHandoffBundle {
  const lifecycleApprovalReady =
    lifecycleApproval.ready &&
    lifecycleApproval.blockingReasons.length === 0;

  const approvalPirReady =
    approvalPir.ready &&
    approvalPir.blockingReasons.length === 0;

  const sameApprovalHandoff =
    lifecycleApproval.approvalHandoff === approvalPir.baselineApprovalHandoff;

  const blockingReasons = [
    ...lifecycleApproval.blockingReasons,
    ...approvalPir.blockingReasons,
  ];

  if (!sameApprovalHandoff) {
    blockingReasons.push(
      'Lifecycle approval evidence and approval-to-PIR handoff must retain the exact same controlled Actual baseline approval handoff.'
    );
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const requestedRowIds = Object.freeze([
    ...lifecycleApproval.lifecycleBaseline.lifecycleEvidence.requestedRowIds,
  ]);

  const ready =
    lifecycleApprovalReady &&
    approvalPirReady &&
    sameApprovalHandoff &&
    uniqueBlockingReasons.length === 0;

  return Object.freeze({
    ready,
    lifecycleApprovalReady,
    approvalPirReady,
    sameApprovalHandoff,
    lifecycleApproval,
    approvalPir,
    requestedRowIds,
    blockingReasons: uniqueBlockingReasons,
  });
}
