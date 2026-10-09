import {
  latestBaselineByKind,
  validateBaselineSnapshot,
  type BaselineKind,
  type BaselineValidationIssue,
  type InvestmentBaselineSnapshot,
} from './baselineVersioningEngine';

export interface BaselineLatestSelectionIssue {
  readonly baselineId: string;
  readonly field: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface BaselineLatestSelectionGovernanceBundle {
  readonly ready: boolean;
  readonly registrySnapshot: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
  readonly latestByKind: Readonly<
    Partial<Record<BaselineKind, Readonly<InvestmentBaselineSnapshot>>>
  > | null;
  readonly issues: ReadonlyArray<Readonly<BaselineLatestSelectionIssue>>;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

function isRecordEnvelope(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function freezeRuntimeContainer(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) =>
        isRecordEnvelope(item)
          ? Object.freeze({ ...item })
          : item
      )
    );
  }
  if (isRecordEnvelope(value)) {
    return Object.freeze({ ...value });
  }
  return value;
}

function freezeSnapshotEvidence(snapshot: unknown): unknown {
  if (!isRecordEnvelope(snapshot)) {
    return freezeRuntimeContainer(snapshot);
  }

  return Object.freeze({
    ...snapshot,
    sourceRefs: freezeRuntimeContainer(snapshot.sourceRefs),
    metrics: freezeRuntimeContainer(snapshot.metrics),
  });
}

function normalizeRuntimeIdentityToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function blockedMalformedRegistryBundle(): BaselineLatestSelectionGovernanceBundle {
  const issue = Object.freeze({
    baselineId: '<registry>',
    field: 'registrySnapshot',
    severity: 'error' as const,
    message: 'Latest baseline selection requires the registry snapshot to be an array.',
  });

  return Object.freeze({
    ready: false,
    registrySnapshot: Object.freeze([]),
    latestByKind: null,
    issues: Object.freeze([issue]),
    blockingReasons: Object.freeze([
      'Latest baseline selection is blocked because the baseline registry envelope is malformed.',
    ]),
    warnings: Object.freeze([]),
  });
}

/**
 * Fail-closed governance boundary for selecting the latest baseline by lifecycle kind.
 *
 * The legacy selector intentionally remains unchanged for compatibility. This wrapper
 * first validates the exact caller-supplied registry population, rejects malformed or
 * duplicate baseline identities, ambiguous latest-selection ties and ambiguous project
 * scope, and only delegates to the existing deterministic selector when the population
 * is structurally valid. Runtime freezing preserves malformed row/container shape instead
 * of normalizing retained evidence before validation.
 *
 * No lifecycle ordering, approval preference, as-of monotonicity, project economics,
 * commercial terms, persistence semantics or sector-specific logic is inferred here.
 */
export function buildBaselineLatestSelectionGovernanceBundle(input: {
  readonly registrySnapshot: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
}): BaselineLatestSelectionGovernanceBundle {
  const runtimeInput = input as unknown;
  const runtimeRegistry = isRecordEnvelope(runtimeInput)
    ? runtimeInput.registrySnapshot
    : undefined;

  if (!Array.isArray(runtimeRegistry)) {
    return blockedMalformedRegistryBundle();
  }

  const registrySnapshot = Object.freeze(
    runtimeRegistry.map(freezeSnapshotEvidence)
  ) as unknown as ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
  const issues: BaselineLatestSelectionIssue[] = [];
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const selectionKeys = new Map<string, string>();
  const projectScopeIds = new Set<string>();
  let hasUnscopedProject = false;

  registrySnapshot.forEach((snapshot, index) => {
    const runtimeSnapshot = snapshot as unknown;
    const baselineId = `<index:${index}>`;

    if (!isRecordEnvelope(runtimeSnapshot)) {
      issues.push({
        baselineId,
        field: 'snapshot',
        severity: 'error',
        message: 'Baseline snapshot must be an object for deterministic latest-case selection.',
      });
      return;
    }

    const runtimeBaselineId = runtimeSnapshot.id;
    const normalizedBaselineId = normalizeRuntimeIdentityToken(runtimeBaselineId);
    const governedBaselineId = normalizedBaselineId ?? baselineId;

    if (!normalizedBaselineId) {
      issues.push({
        baselineId: governedBaselineId,
        field: 'id',
        severity: 'error',
        message: 'Baseline id must be a non-blank string for deterministic latest-case selection.',
      });
    } else {
      if (typeof runtimeBaselineId === 'string' && runtimeBaselineId !== normalizedBaselineId) {
        issues.push({
          baselineId: governedBaselineId,
          field: 'id',
          severity: 'error',
          message:
            'Baseline id contains leading or trailing whitespace; latest baseline selection will not normalize baseline identity silently.',
        });
      }
      if (seenIds.has(normalizedBaselineId)) {
        issues.push({
          baselineId: governedBaselineId,
          field: 'id',
          severity: 'error',
          message: `Duplicate baseline id ${governedBaselineId} prevents deterministic latest-case selection.`,
        });
      }
      seenIds.add(normalizedBaselineId);
    }

    const runtimeProjectId = runtimeSnapshot.projectId;
    if (runtimeProjectId === undefined) {
      hasUnscopedProject = true;
    } else {
      const normalizedProjectId = normalizeRuntimeIdentityToken(runtimeProjectId);
      if (!normalizedProjectId) {
        issues.push({
          baselineId: governedBaselineId,
          field: 'projectId',
          severity: 'error',
          message: 'Supplied project id must be a non-blank string when present.',
        });
      } else {
        if (typeof runtimeProjectId === 'string' && runtimeProjectId !== normalizedProjectId) {
          issues.push({
            baselineId: governedBaselineId,
            field: 'projectId',
            severity: 'error',
            message:
              'Supplied project id contains leading or trailing whitespace; latest baseline selection will not normalize project scope identity silently.',
          });
        }
        projectScopeIds.add(normalizedProjectId);
      }
    }

    const validationIssues: BaselineValidationIssue[] = validateBaselineSnapshot(
      snapshot as InvestmentBaselineSnapshot
    );

    validationIssues.forEach((issue) => {
      issues.push({
        baselineId: governedBaselineId,
        field: issue.field,
        severity: issue.severity,
        message: issue.message,
      });
    });

    const hasDateValidationError = validationIssues.some(
      (issue) =>
        issue.severity === 'error' &&
        (issue.field === 'asOfDate' || issue.field === 'createdAt')
    );

    if (!hasDateValidationError) {
      const asOfTime = new Date(snapshot.asOfDate).getTime();
      const createdTime = new Date(snapshot.createdAt).getTime();
      const selectionKey = `${snapshot.kind}|${asOfTime}|${createdTime}`;
      const priorBaselineId = selectionKeys.get(selectionKey);

      if (priorBaselineId && priorBaselineId !== governedBaselineId) {
        issues.push({
          baselineId: governedBaselineId,
          field: 'latestSelection',
          severity: 'error',
          message:
            `Baseline ${governedBaselineId} ties baseline ${priorBaselineId} for kind ${snapshot.kind} ` +
            'on both as-of date and created-at timestamp; latest selection would depend on registry order.',
        });
      } else if (!priorBaselineId) {
        selectionKeys.set(selectionKey, governedBaselineId);
      }
    }
  });

  if (projectScopeIds.size > 1 || (projectScopeIds.size > 0 && hasUnscopedProject)) {
    issues.push({
      baselineId: '<registry>',
      field: 'projectId',
      severity: 'error',
      message:
        'Latest baseline selection requires one unambiguous project scope; mixed project ids or scoped/unscoped baseline populations must be separated before selection.',
    });
  }

  const errorIssues = issues.filter((issue) => issue.severity === 'error');
  const warningIssues = issues.filter((issue) => issue.severity === 'warning');

  if (registrySnapshot.length === 0) {
    blockingReasons.push('Latest baseline selection requires a non-empty baseline registry.');
  }
  if (errorIssues.length > 0) {
    blockingReasons.push(
      `Latest baseline selection is blocked by ${errorIssues.length} baseline registry validation error(s).`
    );
  }
  warningIssues.forEach((issue) => warnings.push(`${issue.baselineId}: ${issue.message}`));

  const ready = blockingReasons.length === 0;
  const latestByKind = ready
    ? Object.freeze(
        latestBaselineByKind(
          registrySnapshot.map((snapshot) => snapshot as InvestmentBaselineSnapshot)
        )
      )
    : null;

  return Object.freeze({
    ready,
    registrySnapshot,
    latestByKind,
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze(Array.from(new Set(warnings))),
  });
}
