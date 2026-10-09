import type { ControlledActualApprovalPirHandoffBundle } from './controlledActualApprovalPirHandoffBundle';
import type { PirGovernanceBundle } from './pirGovernanceBundle';

export interface ControlledActualApprovalPirGovernanceDiagnostics {
  passed: boolean;
  blockingReasons: string[];
}

export interface ControlledActualApprovalPirGovernanceBundle {
  ready: boolean;
  approvalPirHandoff: ControlledActualApprovalPirHandoffBundle;
  pirGovernance: PirGovernanceBundle;
  continuity: ControlledActualApprovalPirGovernanceDiagnostics;
  blockingReasons: string[];
}

function assessContinuity(input: {
  approvalPirHandoff: ControlledActualApprovalPirHandoffBundle;
  pirGovernance: PirGovernanceBundle;
}): ControlledActualApprovalPirGovernanceDiagnostics {
  const { approvalPirHandoff, pirGovernance } = input;
  const blockingReasons: string[] = [];

  const handoffSelection = approvalPirHandoff.baselineSelection;
  const governanceSelection = pirGovernance.baselineSelection;

  if (handoffSelection !== governanceSelection) {
    blockingReasons.push(
      'Controlled Actual approval-to-PIR governance requires the exact PIR baseline-selection result already proven by the approval-to-PIR handoff; reconstructed or parallel selection evidence is not accepted at this boundary.'
    );
  }

  const evidencedDraft = pirGovernance.evidencedActualBaseline.snapshot;
  const controlledDraft =
    approvalPirHandoff.baselineApprovalHandoff.controlledBaseline.snapshot;

  if (evidencedDraft !== controlledDraft) {
    blockingReasons.push(
      'PIR governance requires the exact evidence-bound Actual-to-Date draft retained by the controlled Actual baseline approval handoff; a parallel or reconstructed draft is not accepted at this boundary.'
    );
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Asset-generic, read-only composition boundary that carries the governed
 * controlled Actual -> Actual-to-Date baseline -> explicit approval -> explicit
 * PIR selection chain into PIR governance without reconstructing provenance.
 *
 * Existing modules remain responsible for their own controls. This wrapper adds
 * only single-source continuity: PIR governance must consume the exact baseline
 * selection result already proven by the approval-to-PIR handoff and the exact
 * evidence-bound Actual-to-Date draft retained by the controlled baseline chain.
 *
 * Object identity is deliberate at this in-memory composition boundary. It does
 * not claim persisted-record identity across serialization or storage systems;
 * that requires an explicit persistence/registry contract and external authority
 * evidence.
 *
 * Boundary: this bundle does not import/map Actuals, approve/persist/supersede a
 * baseline, select a PIR case, infer KPI/accounting semantics, calculate project
 * economics, authenticate authority, or introduce electricity, tariff, PPA, EBL
 * or other commercial assumptions.
 */
export function buildControlledActualApprovalPirGovernanceBundle(input: {
  approvalPirHandoff: ControlledActualApprovalPirHandoffBundle;
  pirGovernance: PirGovernanceBundle;
}): ControlledActualApprovalPirGovernanceBundle {
  const { approvalPirHandoff, pirGovernance } = input;
  const continuity = assessContinuity({ approvalPirHandoff, pirGovernance });

  const blockingReasons = [
    ...approvalPirHandoff.blockingReasons,
    ...pirGovernance.blockingReasons,
    ...continuity.blockingReasons,
  ];
  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  return {
    ready:
      approvalPirHandoff.ready &&
      pirGovernance.ready &&
      continuity.passed &&
      uniqueBlockingReasons.length === 0,
    approvalPirHandoff,
    pirGovernance,
    continuity,
    blockingReasons: uniqueBlockingReasons,
  };
}
