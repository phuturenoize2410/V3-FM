import type {
  InvestmentBaselineSnapshot,
  BaselineValidationIssue,
} from './baselineVersioningEngine';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface BaselineLineageDiagnostic extends BaselineValidationIssue {
  readonly baselineId?: string;
  readonly predecessorId?: string;
}

export interface BaselineLineageDiagnosticsResult {
  readonly diagnostics: ReadonlyArray<BaselineLineageDiagnostic>;
  readonly lineageReady: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function trimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function diagnosticBaselineId(snapshot: unknown, index: number): string {
  if (isRecord(snapshot)) {
    return trimmedString(snapshot.id) ?? `[registry-row-${index + 1}]`;
  }
  return `[registry-row-${index + 1}]`;
}

/**
 * Independent, calculation-free integrity checks for baseline version lineage.
 *
 * These diagnostics deliberately validate only graph and record integrity. They do
 * not infer lifecycle ordering between baseline kinds, approve/supersede records,
 * choose a preferred case, or mutate the supplied snapshots.
 *
 * Retained/deserialized registry evidence may violate its TypeScript shape. This
 * boundary therefore fails closed on malformed rows and lineage identifiers rather
 * than dereferencing invalid evidence or normalizing it into a usable baseline.
 */
export function diagnoseBaselineLineage(
  snapshots: ReadonlyArray<InvestmentBaselineSnapshot>
): BaselineLineageDiagnosticsResult {
  const diagnostics: BaselineLineageDiagnostic[] = [];
  const byId = new Map<string, InvestmentBaselineSnapshot>();
  const duplicateIds = new Set<string>();

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index] as unknown;
    const auditId = diagnosticBaselineId(snapshot, index);

    if (!isRecord(snapshot)) {
      diagnostics.push({
        baselineId: auditId,
        field: 'snapshot',
        severity: 'error',
        message: 'Baseline lineage evidence must be a record.',
      });
      continue;
    }

    const rawId = snapshot.id;
    const baselineId = trimmedString(rawId);
    if (!baselineId) {
      diagnostics.push({
        baselineId: auditId,
        field: 'id',
        severity: 'error',
        message: 'Baseline lineage requires a non-blank string id.',
      });
      continue;
    }

    if (byId.has(baselineId)) {
      duplicateIds.add(baselineId);
      continue;
    }
    byId.set(baselineId, snapshots[index]);
  }

  for (const duplicateId of duplicateIds) {
    diagnostics.push({
      baselineId: duplicateId,
      field: 'id',
      severity: 'error',
      message: `Baseline id ${duplicateId} is duplicated; lineage cannot be resolved deterministically.`,
    });
  }

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index] as unknown;
    if (!isRecord(snapshot)) continue;

    const baselineId = trimmedString(snapshot.id);
    if (!baselineId) continue;

    const rawPredecessorId = snapshot.predecessorId;
    if (
      rawPredecessorId !== undefined &&
      rawPredecessorId !== null &&
      typeof rawPredecessorId !== 'string'
    ) {
      diagnostics.push({
        baselineId,
        field: 'predecessorId',
        severity: 'error',
        message: 'Baseline predecessor id must be a string when supplied.',
      });
      continue;
    }

    const predecessorId = trimmedString(rawPredecessorId);
    if (!predecessorId) continue;

    if (predecessorId === baselineId) {
      diagnostics.push({
        baselineId,
        predecessorId,
        field: 'predecessorId',
        severity: 'error',
        message: 'A baseline cannot identify itself as its predecessor.',
      });
      continue;
    }

    const predecessor = byId.get(predecessorId) as unknown;
    if (!predecessor || !isRecord(predecessor)) {
      diagnostics.push({
        baselineId,
        predecessorId,
        field: 'predecessorId',
        severity: 'error',
        message: `Predecessor ${predecessorId} is not present in the supplied baseline population.`,
      });
      continue;
    }

    const projectId = trimmedString(snapshot.projectId);
    const predecessorProjectId = trimmedString(predecessor.projectId);
    if (projectId && predecessorProjectId && projectId !== predecessorProjectId) {
      diagnostics.push({
        baselineId,
        predecessorId,
        field: 'projectId',
        severity: 'error',
        message: 'A baseline predecessor cannot belong to a different project.',
      });
    }

    const snapshotCreatedAtValid = isValidDateEvidence(snapshot.createdAt);
    const predecessorCreatedAtValid = isValidDateEvidence(predecessor.createdAt);
    if (snapshotCreatedAtValid && predecessorCreatedAtValid) {
      const snapshotCreatedAt = new Date(String(snapshot.createdAt)).getTime();
      const predecessorCreatedAt = new Date(String(predecessor.createdAt)).getTime();
      if (predecessorCreatedAt > snapshotCreatedAt) {
        diagnostics.push({
          baselineId,
          predecessorId,
          field: 'createdAt',
          severity: 'error',
          message: 'A predecessor cannot have been created after its successor baseline.',
        });
      }
    }
  }

  // Detect predecessor cycles without assuming any lifecycle-kind ordering. Only
  // rows with usable string identities participate in traversal; malformed rows
  // remain explicit diagnostics above and cannot be normalized into the graph.
  const globallyVisited = new Set<string>();
  const cycleSignatures = new Set<string>();

  for (const snapshot of snapshots) {
    const runtime = snapshot as unknown;
    if (!isRecord(runtime)) continue;

    const baselineId = trimmedString(runtime.id);
    if (!baselineId || duplicateIds.has(baselineId) || globallyVisited.has(baselineId)) continue;

    const path: string[] = [];
    const pathIndex = new Map<string, number>();
    let currentId: string | undefined = baselineId;

    while (currentId) {
      if (pathIndex.has(currentId)) {
        const cycleStart = pathIndex.get(currentId)!;
        const cycle = path.slice(cycleStart);
        const signature = [...cycle].sort().join('|');
        if (!cycleSignatures.has(signature)) {
          cycleSignatures.add(signature);
          diagnostics.push({
            baselineId: currentId,
            field: 'predecessorId',
            severity: 'error',
            message: `Baseline predecessor cycle detected: ${cycle.join(' -> ')} -> ${currentId}.`,
          });
        }
        break;
      }

      if (globallyVisited.has(currentId)) break;

      pathIndex.set(currentId, path.length);
      path.push(currentId);

      const current = byId.get(currentId) as unknown;
      const predecessorId = isRecord(current)
        ? trimmedString(current.predecessorId) ?? undefined
        : undefined;
      if (!predecessorId || !byId.has(predecessorId)) break;
      currentId = predecessorId;
    }

    path.forEach((id) => globallyVisited.add(id));
  }

  diagnostics.forEach((diagnostic) => Object.freeze(diagnostic));
  Object.freeze(diagnostics);

  return Object.freeze({
    diagnostics,
    lineageReady: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  });
}
