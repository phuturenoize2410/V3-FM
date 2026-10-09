import type { BaselineApprovalGovernanceBundle } from './baselineApprovalGovernanceBundle';
import {
  validateBaselineRegistry,
  type BaselineGovernanceResult,
} from './baselineGovernanceEngine';
import type {
  BaselineSourceRef,
  InvestmentBaselineSnapshot,
} from './baselineVersioningEngine';

export interface BaselineApprovalRegistryHandoffBundle {
  readonly ready: boolean;
  readonly targetBaselineId: string;
  readonly registrySnapshot: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
  readonly candidateRegistry: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>> | null;
  readonly registryGovernance: BaselineGovernanceResult | null;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

function sameOptional(left?: string, right?: string): boolean {
  return left === right;
}

function sameSourceRef(
  left: Readonly<BaselineSourceRef>,
  right: Readonly<BaselineSourceRef>
): boolean {
  return (
    sameOptional(left.sourceSystem, right.sourceSystem) &&
    sameOptional(left.sourceFile, right.sourceFile) &&
    sameOptional(left.sourceVersion, right.sourceVersion) &&
    sameOptional(left.sourceUrl, right.sourceUrl) &&
    sameOptional(left.importedAt, right.importedAt)
  );
}

function sameMetrics(
  left: Readonly<Record<string, number | null>>,
  right: Readonly<Record<string, number | null>>
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key, index) => key === rightKeys[index] && Object.is(left[key], right[key])
  );
}

function sameSnapshot(
  left: Readonly<InvestmentBaselineSnapshot>,
  right: Readonly<InvestmentBaselineSnapshot>
): boolean {
  const leftRefs = left.sourceRefs ?? [];
  const rightRefs = right.sourceRefs ?? [];

  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.name === right.name &&
    sameOptional(left.projectId, right.projectId) &&
    left.asOfDate === right.asOfDate &&
    left.createdAt === right.createdAt &&
    left.status === right.status &&
    sameOptional(left.approvedAt, right.approvedAt) &&
    sameOptional(left.approvedBy, right.approvedBy) &&
    sameOptional(left.predecessorId, right.predecessorId) &&
    sameOptional(left.modelVersion, right.modelVersion) &&
    sameOptional(left.notes, right.notes) &&
    leftRefs.length === rightRefs.length &&
    leftRefs.every((ref, index) => sameSourceRef(ref, rightRefs[index])) &&
    sameMetrics(left.metrics, right.metrics)
  );
}

function freezeSnapshot(
  snapshot: Readonly<InvestmentBaselineSnapshot>
): Readonly<InvestmentBaselineSnapshot> {
  return Object.freeze({
    ...snapshot,
    sourceRefs: snapshot.sourceRefs
      ? Object.freeze(snapshot.sourceRefs.map((ref) => Object.freeze({ ...ref })))
      : undefined,
    metrics: Object.freeze({ ...snapshot.metrics }),
  });
}

function freezeBaselineGovernanceResult(
  result: BaselineGovernanceResult
): BaselineGovernanceResult {
  result.issues.forEach((issue) => Object.freeze(issue));
  result.errors.forEach((issue) => Object.freeze(issue));
  result.warnings.forEach((issue) => Object.freeze(issue));
  Object.freeze(result.issues);
  Object.freeze(result.errors);
  Object.freeze(result.warnings);
  return Object.freeze(result);
}

/**
 * Builds a read-only registry handoff candidate from one authoritative baseline
 * approval governance bundle.
 *
 * This control closes the boundary between an individually governed approval
 * transition and registry-level lifecycle governance. It only becomes ready when:
 * - the approval bundle itself is ready and contains an approved snapshot;
 * - the supplied registry contains exactly one record with the retained draft id;
 * - that registry record is field-for-field identical to the draft snapshot retained
 *   by the approval bundle; and
 * - replacing that exact draft with the approved snapshot leaves the whole supplied
 *   registry valid under the existing baseline registry governance rules.
 *
 * The returned candidate registry is evidence only. The handoff envelope, nested
 * registry-governance result and blocker/warning populations are immutable after
 * evaluation so downstream persistence review cannot rewrite readiness or retained
 * diagnostic evidence. The registry-governance result remains the exact authoritative
 * result produced by the existing validator; this boundary does not reinterpret or
 * strengthen its logic.
 *
 * This function does not persist, overwrite, supersede or reorder any baseline;
 * authenticate approver authority; select a PIR comparison case; infer lifecycle
 * sequence; or add asset-specific economics. Callers remain responsible for an
 * explicit persistence action after reviewing the candidate and external authority
 * evidence.
 */
export function buildBaselineApprovalRegistryHandoffBundle(input: {
  readonly approval: BaselineApprovalGovernanceBundle;
  readonly registry: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
}): BaselineApprovalRegistryHandoffBundle {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const targetBaselineId = input.approval.draftSnapshot.id;
  const registrySnapshot = Object.freeze(input.registry.map(freezeSnapshot));

  if (!input.approval.ready || !input.approval.approval.snapshot) {
    blockingReasons.push(
      'Baseline approval governance bundle is not ready for registry handoff.'
    );
  }

  const targetMatches = registrySnapshot.filter(
    (snapshot) => snapshot.id === targetBaselineId
  );

  if (targetMatches.length !== 1) {
    blockingReasons.push(
      `Registry handoff requires exactly one baseline with id ${targetBaselineId}; found ${targetMatches.length}.`
    );
  } else if (!sameSnapshot(targetMatches[0], input.approval.draftSnapshot)) {
    blockingReasons.push(
      'Registry baseline does not exactly match the draft evidence retained by the approval bundle.'
    );
  }

  if (blockingReasons.length > 0 || !input.approval.approval.snapshot) {
    return Object.freeze({
      ready: false,
      targetBaselineId,
      registrySnapshot,
      candidateRegistry: null,
      registryGovernance: null,
      blockingReasons: Object.freeze([...blockingReasons]),
      warnings: Object.freeze([...warnings]),
    });
  }

  const approvedSnapshot = freezeSnapshot(input.approval.approval.snapshot);
  const candidateRegistry = Object.freeze(
    registrySnapshot.map((snapshot) =>
      snapshot.id === targetBaselineId ? approvedSnapshot : snapshot
    )
  );
  const registryGovernance = freezeBaselineGovernanceResult(
    validateBaselineRegistry(
      candidateRegistry.map((snapshot) => snapshot as InvestmentBaselineSnapshot)
    )
  );

  blockingReasons.push(
    ...registryGovernance.errors.map(
      (issue) => `${issue.baselineId}.${issue.field}: ${issue.message}`
    )
  );
  warnings.push(
    ...input.approval.warnings,
    ...registryGovernance.warnings.map(
      (issue) => `${issue.baselineId}.${issue.field}: ${issue.message}`
    )
  );

  return Object.freeze({
    ready: blockingReasons.length === 0,
    targetBaselineId,
    registrySnapshot,
    candidateRegistry,
    registryGovernance,
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze(Array.from(new Set(warnings))),
  });
}
