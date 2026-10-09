import {
  type BaselineSourceRef,
  type BaselineValidationIssue,
  type InvestmentBaselineSnapshot,
  validateBaselineSnapshot,
} from './baselineVersioningEngine';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface BaselineGovernanceIssue extends BaselineValidationIssue {
  baselineId: string;
}

export interface BaselineGovernanceResult {
  valid: boolean;
  issues: BaselineGovernanceIssue[];
  errors: BaselineGovernanceIssue[];
  warnings: BaselineGovernanceIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function trimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function issueBaselineId(snapshot: unknown, index?: number): string {
  if (isRecord(snapshot)) {
    const id = trimmedString(snapshot.id);
    if (id) return id;
  }
  return index === undefined ? '[malformed-baseline]' : `[registry-row-${index + 1}]`;
}

function toGovernanceIssues(
  snapshot: InvestmentBaselineSnapshot,
  issues: BaselineValidationIssue[],
  index?: number
): BaselineGovernanceIssue[] {
  const baselineId = issueBaselineId(snapshot, index);
  return issues.map((issue) => ({
    ...issue,
    baselineId,
  }));
}

function hasMeaningfulSourceIdentity(sourceRef: unknown): boolean {
  if (!isRecord(sourceRef)) return false;
  return [
    sourceRef.sourceSystem,
    sourceRef.sourceFile,
    sourceRef.sourceVersion,
    sourceRef.sourceUrl,
  ].some((value) => trimmedString(value) !== null);
}

function detectPredecessorCycles(
  snapshots: InvestmentBaselineSnapshot[],
  byId: Map<string, InvestmentBaselineSnapshot>
): BaselineGovernanceIssue[] {
  const issues: BaselineGovernanceIssue[] = [];
  const reportedCycles = new Set<string>();

  for (const snapshot of snapshots) {
    const runtime = snapshot as unknown;
    if (!isRecord(runtime)) continue;

    const startId = trimmedString(runtime.id);
    if (!startId || !byId.has(startId)) continue;

    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let currentId: string | undefined = startId;

    while (currentId) {
      if (pathIndex.has(currentId)) {
        const cycleStart = pathIndex.get(currentId)!;
        const cycle = path.slice(cycleStart);
        const canonicalKey = [...cycle].sort().join('|');

        if (!reportedCycles.has(canonicalKey)) {
          reportedCycles.add(canonicalKey);
          const cyclePath = [...cycle, currentId].join(' -> ');

          for (const baselineId of cycle) {
            issues.push({
              baselineId,
              field: 'predecessorId',
              severity: 'error',
              message: `Baseline predecessor lineage contains a cycle: ${cyclePath}.`,
            });
          }
        }
        break;
      }

      pathIndex.set(currentId, path.length);
      path.push(currentId);

      const current = byId.get(currentId) as unknown;
      const predecessorId = isRecord(current)
        ? trimmedString(current.predecessorId) ?? undefined
        : undefined;
      if (!predecessorId || !byId.has(predecessorId)) break;
      currentId = predecessorId;
    }
  }

  return issues;
}

/**
 * Registry-level governance checks for investment lifecycle baselines.
 *
 * These controls deliberately avoid enforcing a commercial lifecycle sequence.
 * Projects may legitimately create IC, entry, FC, budget, actual and forecast
 * snapshots in different orders. The engine instead checks only auditable
 * integrity requirements that should hold regardless of asset type:
 * - baseline ids are unique;
 * - predecessor references resolve, cannot self-reference and cannot form cycles;
 * - predecessor project ids do not conflict when both are populated;
 * - predecessor creation timestamps cannot post-date their successor snapshots;
 * - approved snapshots carry explicit approver and approval timestamp;
 * - Actual-to-Date snapshots carry meaningful source provenance before approval;
 * - approved snapshots contain at least one KPI;
 * - the existing snapshot field validation remains authoritative.
 *
 * Retained/deserialized registry evidence may violate its compile-time shape.
 * Registry-level checks therefore fail closed on malformed identities and
 * containers instead of dereferencing invalid evidence or inventing repairs.
 */
export function validateBaselineRegistry(
  snapshots: InvestmentBaselineSnapshot[]
): BaselineGovernanceResult {
  const issues: BaselineGovernanceIssue[] = [];
  const byId = new Map<string, InvestmentBaselineSnapshot>();
  const duplicateIds = new Set<string>();

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index];
    const validationIssues = validateBaselineSnapshot(snapshot);
    issues.push(...toGovernanceIssues(snapshot, validationIssues, index));

    const runtime = snapshot as unknown;
    if (!isRecord(runtime)) continue;
    const normalizedId = trimmedString(runtime.id);
    if (!normalizedId) continue;

    if (byId.has(normalizedId)) {
      duplicateIds.add(normalizedId);
    } else {
      byId.set(normalizedId, snapshot);
    }
  }

  for (const duplicateId of duplicateIds) {
    issues.push({
      baselineId: duplicateId,
      field: 'id',
      severity: 'error',
      message: `Duplicate baseline id ${duplicateId} is not allowed in the version registry.`,
    });
  }

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index];
    const runtime = snapshot as unknown;
    if (!isRecord(runtime)) continue;

    const baselineId = issueBaselineId(snapshot, index);
    const snapshotId = trimmedString(runtime.id);
    const predecessorId = trimmedString(runtime.predecessorId);

    if (predecessorId) {
      if (snapshotId && predecessorId === snapshotId) {
        issues.push({
          baselineId,
          field: 'predecessorId',
          severity: 'error',
          message: 'A baseline cannot reference itself as predecessor.',
        });
      } else {
        const predecessor = byId.get(predecessorId);
        if (!predecessor) {
          issues.push({
            baselineId,
            field: 'predecessorId',
            severity: 'error',
            message: `Predecessor ${predecessorId} is not present in the supplied baseline registry.`,
          });
        } else {
          const predecessorRuntime = predecessor as unknown;
          const projectId = trimmedString(runtime.projectId);
          const predecessorProjectId = isRecord(predecessorRuntime)
            ? trimmedString(predecessorRuntime.projectId)
            : null;

          if (projectId && predecessorProjectId && projectId !== predecessorProjectId) {
            issues.push({
              baselineId,
              field: 'predecessorId',
              severity: 'error',
              message: 'Baseline and predecessor project ids do not match.',
            });
          }

          const snapshotCreatedAtValid = isValidDateEvidence(runtime.createdAt);
          const predecessorCreatedAtValid =
            isRecord(predecessorRuntime) && isValidDateEvidence(predecessorRuntime.createdAt);
          if (snapshotCreatedAtValid && predecessorCreatedAtValid && isRecord(predecessorRuntime)) {
            const snapshotCreatedAt = new Date(String(runtime.createdAt)).getTime();
            const predecessorCreatedAt = new Date(String(predecessorRuntime.createdAt)).getTime();
            if (predecessorCreatedAt > snapshotCreatedAt) {
              issues.push({
                baselineId,
                field: 'predecessorId',
                severity: 'error',
                message: `Predecessor ${predecessorId} was created after its successor baseline.`,
              });
            }
          }
        }
      }
    }

    if (runtime.status === 'approved') {
      if (runtime.approvedAt === undefined || runtime.approvedAt === null) {
        issues.push({
          baselineId,
          field: 'approvedAt',
          severity: 'error',
          message: 'Approved baseline requires an explicit approval timestamp.',
        });
      }

      if (!trimmedString(runtime.approvedBy)) {
        issues.push({
          baselineId,
          field: 'approvedBy',
          severity: 'error',
          message: 'Approved baseline requires an explicit approver.',
        });
      }

      const metrics = runtime.metrics;
      if (isRecord(metrics) && Object.keys(metrics).length === 0) {
        issues.push({
          baselineId,
          field: 'metrics',
          severity: 'error',
          message: 'Approved baseline must contain at least one controlled KPI.',
        });
      }

      if (runtime.kind === 'actual_to_date') {
        if (!Array.isArray(runtime.sourceRefs) || runtime.sourceRefs.length === 0) {
          issues.push({
            baselineId,
            field: 'sourceRefs',
            severity: 'error',
            message: 'Approved Actual-to-Date baseline requires source provenance.',
          });
        } else if (!runtime.sourceRefs.some(hasMeaningfulSourceIdentity)) {
          issues.push({
            baselineId,
            field: 'sourceRefs',
            severity: 'error',
            message:
              'Approved Actual-to-Date baseline requires at least one source reference with an explicit source system, file, version or URL.',
          });
        }
      }
    }
  }

  if (duplicateIds.size === 0) {
    issues.push(...detectPredecessorCycles(snapshots, byId));
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

/**
 * Approval-readiness view for one snapshot within its current registry.
 * The function does not approve or mutate the snapshot; governance remains an
 * explicit caller action and persistence concern.
 */
export function assessBaselineApprovalReadiness(
  snapshotId: string,
  snapshots: InvestmentBaselineSnapshot[]
): BaselineGovernanceResult {
  const target = snapshots.find((snapshot) => {
    const runtime = snapshot as unknown;
    return isRecord(runtime) && runtime.id === snapshotId;
  });

  if (!target) {
    const issue: BaselineGovernanceIssue = {
      baselineId: snapshotId,
      field: 'id',
      severity: 'error',
      message: 'Baseline is not present in the supplied registry.',
    };

    return {
      valid: false,
      issues: [issue],
      errors: [issue],
      warnings: [],
    };
  }

  // Re-perform governance using an approval candidate so missing approval
  // metadata is visible before a caller persists an approved state.
  const candidate: InvestmentBaselineSnapshot = {
    ...target,
    status: 'approved',
  };
  const candidateRegistry = snapshots.map((snapshot) => {
    const runtime = snapshot as unknown;
    return isRecord(runtime) && runtime.id === snapshotId ? candidate : snapshot;
  });
  const registryResult = validateBaselineRegistry(candidateRegistry);
  const relevantIssues = registryResult.issues.filter(
    (issue) => issue.baselineId === snapshotId || issue.field === 'id'
  );
  const errors = relevantIssues.filter((issue) => issue.severity === 'error');
  const warnings = relevantIssues.filter((issue) => issue.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues: relevantIssues,
    errors,
    warnings,
  };
}
