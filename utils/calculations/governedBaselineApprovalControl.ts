import {
  approveBaselineSnapshot,
  type BaselineApprovalInput,
  type BaselineApprovalResult,
} from './baselineApprovalControl';
import {
  assessBaselineApprovalIdentity,
  type BaselineApprovalIdentityDiagnostics,
} from './baselineApprovalIdentityDiagnostics';

export interface GovernedBaselineApprovalResult extends BaselineApprovalResult {
  identity: BaselineApprovalIdentityDiagnostics;
  governanceReady: boolean;
}

/**
 * Preferred asset-generic baseline approval handoff.
 *
 * Runs the existing explicit draft -> approved transition and then independently
 * verifies that approval changed governance metadata only. The resulting approval
 * is governance-ready only when both the transition control and the identity
 * diagnostic pass.
 *
 * This wrapper does not authenticate approver authority, persist records,
 * supersede prior baselines, select PIR cases, infer lifecycle ordering, calculate
 * economics, repair provenance, or introduce asset-specific/commercial terms.
 */
export function approveBaselineSnapshotWithIdentity(
  input: BaselineApprovalInput
): GovernedBaselineApprovalResult {
  const approval = approveBaselineSnapshot(input);

  const identity = assessBaselineApprovalIdentity({
    draft: input.snapshot,
    approved: approval.snapshot ? { ...approval.snapshot } : null,
  });

  const blockingReasons = [
    ...approval.blockingReasons,
    ...identity.blockingReasons,
  ];

  return {
    ...approval,
    approved: approval.approved && identity.passed,
    blockingReasons: [...new Set(blockingReasons)],
    identity,
    governanceReady: approval.approved && identity.passed,
    snapshot: approval.approved && identity.passed ? approval.snapshot : null,
  };
}
