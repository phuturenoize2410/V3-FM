import type { ControlledActualApprovalPirGovernanceBundle } from './controlledActualApprovalPirGovernanceBundle';
import type { ControlledActualLifecycleApprovalPirHandoffBundle } from './controlledActualLifecycleApprovalPirHandoffBundle';

export interface ControlledActualLifecyclePirGovernanceDiagnostics {
  readonly passed: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledActualLifecyclePirGovernanceBundle {
  readonly ready: boolean;
  readonly lifecyclePirHandoff: ControlledActualLifecycleApprovalPirHandoffBundle;
  readonly approvalPirGovernance: ControlledActualApprovalPirGovernanceBundle;
  readonly continuity: ControlledActualLifecyclePirGovernanceDiagnostics;
  readonly requestedRowIds: ReadonlyArray<string>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function assessContinuity(input: {
  lifecyclePirHandoff: ControlledActualLifecycleApprovalPirHandoffBundle;
  approvalPirGovernance: ControlledActualApprovalPirGovernanceBundle;
}): ControlledActualLifecyclePirGovernanceDiagnostics {
  const { lifecyclePirHandoff, approvalPirGovernance } = input;
  const blockingReasons: string[] = [];

  if (
    lifecyclePirHandoff.approvalPir !==
    approvalPirGovernance.approvalPirHandoff
  ) {
    blockingReasons.push(
      'Lifecycle-to-PIR governance requires the exact approval-to-PIR handoff already consumed by controlled Actual PIR governance; reconstructed or parallel handoff evidence is not accepted at this boundary.'
    );
  }

  if (
    lifecyclePirHandoff.approvalPir.baselineSelection !==
    approvalPirGovernance.pirGovernance.baselineSelection
  ) {
    blockingReasons.push(
      'Lifecycle-to-PIR governance requires PIR governance to consume the exact baseline-selection result retained by the lifecycle approval-to-PIR handoff.'
    );
  }

  return Object.freeze({
    passed: blockingReasons.length === 0,
    blockingReasons: Object.freeze(blockingReasons),
  });
}

/**
 * Asset-generic, read-only composition boundary that carries explicit lifecycle
 * Actual evidence into the already-governed controlled Actual PIR path without
 * reconstructing provenance or promoting lifecycle rows into accounting semantics.
 *
 * Existing modules remain responsible for their own controls. This wrapper adds
 * only continuity requirements: the lifecycle-to-PIR chain must retain the exact
 * approval-to-PIR handoff consumed by controlled Actual PIR governance, and PIR
 * governance must consume the exact baseline-selection result retained by that
 * lifecycle chain.
 *
 * The retained source-row IDs remain caller-selected provenance evidence only.
 * They are intentionally not interpreted as lifecycle cost, CAPEX, OPEX,
 * capitalization, KPI population, accounting treatment or investment-decision
 * evidence by this bundle. The row-ID population is snapshotted again at this
 * governance boundary so retained downstream evidence cannot drift if a runtime
 * handoff was reconstructed with a mutable nested array despite readonly typing.
 *
 * Object identity is deliberate at this in-memory composition boundary. It does
 * not claim persisted-record identity across serialization, registries, databases
 * or external evidence stores; those require explicit persistence contracts and
 * authority evidence.
 *
 * Boundary: this bundle does not import/map Actuals, approve/persist/supersede a
 * baseline, select a PIR case, infer KPI/accounting semantics, calculate project
 * economics, authenticate source/Mapping Master/selector/approver authority, or
 * introduce electricity, tariff, PPA, EBL or other commercial assumptions.
 */
export function buildControlledActualLifecyclePirGovernanceBundle(input: {
  lifecyclePirHandoff: ControlledActualLifecycleApprovalPirHandoffBundle;
  approvalPirGovernance: ControlledActualApprovalPirGovernanceBundle;
}): ControlledActualLifecyclePirGovernanceBundle {
  const { lifecyclePirHandoff, approvalPirGovernance } = input;
  const continuity = assessContinuity({
    lifecyclePirHandoff,
    approvalPirGovernance,
  });

  const blockingReasons = Object.freeze([
    ...new Set([
      ...lifecyclePirHandoff.blockingReasons,
      ...approvalPirGovernance.blockingReasons,
      ...continuity.blockingReasons,
    ]),
  ]);

  const requestedRowIds = Object.freeze([...lifecyclePirHandoff.requestedRowIds]);

  return Object.freeze({
    ready:
      lifecyclePirHandoff.ready &&
      approvalPirGovernance.ready &&
      continuity.passed &&
      blockingReasons.length === 0,
    lifecyclePirHandoff,
    approvalPirGovernance,
    continuity,
    requestedRowIds,
    blockingReasons,
  });
}
