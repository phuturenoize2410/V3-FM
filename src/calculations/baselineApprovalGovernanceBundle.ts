import {
  approveBaselineSnapshot,
  type BaselineApprovalInput,
  type BaselineApprovalResult,
} from './baselineApprovalControl';
import {
  assessBaselineApprovalIdentity,
  type BaselineApprovalIdentityDiagnostics,
} from './baselineApprovalIdentityDiagnostics';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';

export interface BaselineApprovalMetadataDiagnostics {
  passed: boolean;
  blockingReasons: string[];
}

export interface BaselineApprovalGovernanceBundle {
  ready: boolean;
  /**
   * Immutable evidence snapshot of the exact draft supplied to this approval
   * run. Downstream consumers should use this retained snapshot when they need
   * to reconcile the transition to a registry entry rather than re-fetching or
   * reconstructing a draft by id.
   */
  draftSnapshot: Readonly<InvestmentBaselineSnapshot>;
  /**
   * Exact caller-supplied approval metadata retained as audit evidence. The
   * bundle does not authenticate authority or normalize this evidence into a
   * separate approval decision.
   */
  approvalRequest: Readonly<{
    approvedAt: string;
    approvedBy: string;
  }>;
  approval: BaselineApprovalResult;
  identity: BaselineApprovalIdentityDiagnostics | null;
  metadata: BaselineApprovalMetadataDiagnostics;
  approvedSnapshot: Readonly<InvestmentBaselineSnapshot> | null;
  blockingReasons: string[];
  warnings: string[];
}

function freezeBaselineEvidence(
  snapshot: InvestmentBaselineSnapshot
): InvestmentBaselineSnapshot {
  return Object.freeze({
    ...snapshot,
    sourceRefs: snapshot.sourceRefs
      ? Object.freeze(snapshot.sourceRefs.map((ref) => Object.freeze({ ...ref })))
      : undefined,
    metrics: Object.freeze({ ...snapshot.metrics }),
  }) as InvestmentBaselineSnapshot;
}

function assessApprovalMetadata(input: {
  requested: BaselineApprovalInput;
  approvedSnapshot: Readonly<InvestmentBaselineSnapshot> | null;
}): BaselineApprovalMetadataDiagnostics {
  const blockingReasons: string[] = [];
  const { requested, approvedSnapshot } = input;

  if (!approvedSnapshot) {
    blockingReasons.push(
      'Approval metadata cannot be reconciled because no approved baseline snapshot was produced.'
    );
    return { passed: false, blockingReasons };
  }

  if (approvedSnapshot.status !== 'approved') {
    blockingReasons.push(
      `Approval transition produced status ${approvedSnapshot.status}; expected approved.`
    );
  }

  if (approvedSnapshot.approvedBy !== requested.approvedBy.trim()) {
    blockingReasons.push(
      'Approved baseline approver does not reconcile to the explicit approval request.'
    );
  }

  if (approvedSnapshot.approvedAt !== requested.approvedAt) {
    blockingReasons.push(
      'Approved baseline timestamp does not reconcile to the explicit approval request.'
    );
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Asset-generic, read-only orchestration for an explicit baseline approval
 * transition. It binds the approval result to post-transition identity and
 * approval-metadata diagnostics so downstream consumers do not need to pair an
 * approved snapshot with separately reconstructed evidence.
 *
 * The exact draft population and caller-supplied approval metadata are retained
 * as immutable evidence in the returned bundle. This prevents downstream
 * lifecycle/registry handoffs from proving transition integrity against one
 * draft and then accidentally consuming another object with the same baseline
 * id.
 *
 * `ready` means only that the supplied draft passed the existing approval
 * control, the approved snapshot preserved every governed economic/provenance
 * field, and the resulting approval metadata reconciles to the explicit caller
 * request. It does not authenticate the approver, persist records, supersede a
 * predecessor, select a PIR comparison case, infer lifecycle order, calculate
 * economics, or introduce any asset-/electricity-specific commercial term.
 */
export function buildBaselineApprovalGovernanceBundle(
  input: BaselineApprovalInput
): BaselineApprovalGovernanceBundle {
  const draftSnapshot = freezeBaselineEvidence(input.snapshot);
  const approvalRequest = Object.freeze({
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
  });
  const governedInput: BaselineApprovalInput = {
    snapshot: draftSnapshot,
    approvedAt: approvalRequest.approvedAt,
    approvedBy: approvalRequest.approvedBy,
  };

  const approval = approveBaselineSnapshot(governedInput);
  const approvedSnapshot = approval.snapshot;
  const metadata = assessApprovalMetadata({
    requested: governedInput,
    approvedSnapshot,
  });

  const identity = approvedSnapshot
    ? assessBaselineApprovalIdentity({
        draft: draftSnapshot,
        approved: approvedSnapshot as InvestmentBaselineSnapshot,
      })
    : null;

  const blockingReasons = [
    ...approval.blockingReasons,
    ...metadata.blockingReasons,
    ...(identity?.blockingReasons ?? []),
  ];

  return Object.freeze({
    ready:
      approval.approved &&
      approvedSnapshot !== null &&
      metadata.passed &&
      identity?.passed === true,
    draftSnapshot,
    approvalRequest,
    approval,
    identity,
    metadata,
    approvedSnapshot,
    blockingReasons: [...new Set(blockingReasons)],
    warnings: [...new Set(approval.warnings)],
  });
}
