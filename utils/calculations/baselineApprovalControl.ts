import {
  type InvestmentBaselineSnapshot,
  type BaselineValidationIssue,
  validateBaselineSnapshot,
  freezeApprovedBaseline,
} from './baselineVersioningEngine';

export interface BaselineApprovalInput {
  readonly snapshot: InvestmentBaselineSnapshot;
  readonly approvedAt: string;
  readonly approvedBy: string;
}

export interface BaselineApprovalResult {
  readonly approved: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly snapshot: Readonly<InvestmentBaselineSnapshot> | null;
}

function formatIssue(issue: BaselineValidationIssue): string {
  return `${issue.field}: ${issue.message}`;
}

function freezeApprovalResult(
  approved: boolean,
  blockingReasons: ReadonlyArray<string>,
  warnings: ReadonlyArray<string>,
  snapshot: Readonly<InvestmentBaselineSnapshot> | null
): BaselineApprovalResult {
  return Object.freeze({
    approved,
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze([...warnings]),
    snapshot,
  });
}

/**
 * Applies the explicit governance transition from draft to approved.
 *
 * This helper deliberately does not authenticate approvers, infer approval authority,
 * persist data, supersede prior baselines, or choose which lifecycle case should be
 * approved. Those responsibilities remain with the caller / governance layer.
 *
 * The function exists to prevent UI or state consumers from marking a baseline as
 * approved without an attributable approver and approval timestamp, while preserving
 * the append-only/versioned baseline convention. Returned decision evidence is immutable
 * so downstream handoff/persistence review cannot mutate the evaluated approval outcome.
 */
export function approveBaselineSnapshot(
  input: BaselineApprovalInput
): BaselineApprovalResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const { snapshot } = input;

  if (snapshot.status !== 'draft') {
    blockingReasons.push(
      `Only a draft baseline can enter the approval transition; current status is ${snapshot.status}.`
    );
  }

  const approvedBy = input.approvedBy.trim();
  if (!approvedBy) {
    blockingReasons.push('Approval requires an explicit approver identifier.');
  }

  const approvedAtMs = new Date(input.approvedAt).getTime();
  if (!Number.isFinite(approvedAtMs)) {
    blockingReasons.push('Approval requires a valid approval timestamp.');
  }

  const createdAtMs = new Date(snapshot.createdAt).getTime();
  if (Number.isFinite(approvedAtMs) && Number.isFinite(createdAtMs) && approvedAtMs < createdAtMs) {
    blockingReasons.push('Approval timestamp cannot precede baseline creation.');
  }

  const existingIssues = validateBaselineSnapshot(snapshot);
  for (const issue of existingIssues) {
    if (issue.severity === 'error') blockingReasons.push(formatIssue(issue));
    else warnings.push(formatIssue(issue));
  }

  if (blockingReasons.length > 0) {
    return freezeApprovalResult(false, blockingReasons, warnings, null);
  }

  const candidate: InvestmentBaselineSnapshot = {
    ...snapshot,
    status: 'approved',
    approvedAt: input.approvedAt,
    approvedBy,
  };

  const candidateIssues = validateBaselineSnapshot(candidate);
  for (const issue of candidateIssues) {
    if (issue.severity === 'error') blockingReasons.push(formatIssue(issue));
    else warnings.push(formatIssue(issue));
  }

  if (blockingReasons.length > 0) {
    return freezeApprovalResult(false, blockingReasons, warnings, null);
  }

  return freezeApprovalResult(
    true,
    [],
    warnings,
    freezeApprovedBaseline(candidate)
  );
}
