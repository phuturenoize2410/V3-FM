/*
 * Asset-generic investment baseline versioning utilities.
 *
 * Purpose:
 * - Preserve distinct approved/decision cases across the investment lifecycle.
 * - Keep historical baselines immutable by convention: create a new snapshot rather than overwrite.
 * - Compare like-for-like numeric KPIs without embedding sector-specific commercial assumptions.
 * - Make provenance/cut-off metadata explicit so IC / FC / Budget / Actual / Forecast cases can be audited.
 */

import { isValidDateEvidence } from './dateEvidenceControls';

export type BaselineKind =
  | 'ic_case'
  | 'entry_case'
  | 'financial_close_case'
  | 'approved_budget'
  | 'actual_to_date'
  | 'latest_forecast';

export type BaselineStatus = 'draft' | 'approved' | 'superseded';

const BASELINE_KINDS = new Set<string>([
  'ic_case',
  'entry_case',
  'financial_close_case',
  'approved_budget',
  'actual_to_date',
  'latest_forecast',
]);

const BASELINE_STATUSES = new Set<string>(['draft', 'approved', 'superseded']);

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasOuterWhitespace(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value !== value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export interface BaselineSourceRef {
  sourceSystem?: string;
  sourceFile?: string;
  sourceVersion?: string;
  sourceUrl?: string;
  importedAt?: string;
}

export interface InvestmentBaselineSnapshot {
  id: string;
  kind: BaselineKind;
  name: string;
  projectId?: string;
  asOfDate: string;
  createdAt: string;
  status: BaselineStatus;
  approvedAt?: string;
  approvedBy?: string;
  predecessorId?: string;
  modelVersion?: string;
  notes?: string;
  sourceRefs?: ReadonlyArray<Readonly<BaselineSourceRef>>;
  metrics: Record<string, number | null>;
}

export interface BaselineValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Validates baseline evidence at a runtime boundary, not merely against the static
 * TypeScript shape. Persisted/deserialized registry content may violate compile-time
 * contracts; malformed baseline/provenance evidence must fail closed instead of throwing.
 */
export function validateBaselineSnapshot(
  snapshot: InvestmentBaselineSnapshot
): BaselineValidationIssue[] {
  const issues: BaselineValidationIssue[] = [];
  const runtimeCandidate = snapshot as unknown;

  if (!isRecord(runtimeCandidate)) {
    return [{
      field: 'snapshot',
      severity: 'error',
      message: 'Baseline snapshot must be an object.',
    }];
  }

  const runtime = runtimeCandidate;

  if (!isNonBlankString(runtime.id)) {
    issues.push({ field: 'id', severity: 'error', message: 'Baseline id is required and must be a non-blank string.' });
  } else if (hasOuterWhitespace(runtime.id)) {
    issues.push({
      field: 'id',
      severity: 'error',
      message: 'Baseline id contains leading or trailing whitespace; identity evidence must be supplied exactly.',
    });
  }
  if (!isNonBlankString(runtime.name)) {
    issues.push({ field: 'name', severity: 'error', message: 'Baseline name is required and must be a non-blank string.' });
  }
  if (!BASELINE_KINDS.has(String(runtime.kind))) {
    issues.push({
      field: 'kind',
      severity: 'error',
      message: `Unsupported baseline kind ${String(runtime.kind)}.`,
    });
  }
  if (!BASELINE_STATUSES.has(String(runtime.status))) {
    issues.push({
      field: 'status',
      severity: 'error',
      message: `Unsupported baseline status ${String(runtime.status)}.`,
    });
  }
  if (runtime.projectId !== undefined && !isNonBlankString(runtime.projectId)) {
    issues.push({
      field: 'projectId',
      severity: 'error',
      message: 'Baseline project id must be a non-blank string when supplied.',
    });
  } else if (runtime.projectId !== undefined && hasOuterWhitespace(runtime.projectId)) {
    issues.push({
      field: 'projectId',
      severity: 'error',
      message: 'Baseline project id contains leading or trailing whitespace; scope identity evidence must be supplied exactly.',
    });
  }

  const optionalBaselineIdentityFields: Array<keyof Pick<
    InvestmentBaselineSnapshot,
    'approvedBy' | 'predecessorId' | 'modelVersion'
  >> = ['approvedBy', 'predecessorId', 'modelVersion'];

  for (const field of optionalBaselineIdentityFields) {
    const value = runtime[field];
    if (value !== undefined && !isNonBlankString(value)) {
      issues.push({
        field,
        severity: 'error',
        message: `Baseline ${field} must be a non-blank string when supplied.`,
      });
    } else if (value !== undefined && hasOuterWhitespace(value)) {
      issues.push({
        field,
        severity: 'error',
        message: `Baseline ${field} contains leading or trailing whitespace; identity evidence must be supplied exactly.`,
      });
    }
  }

  const asOfValid = isValidDateEvidence(runtime.asOfDate);
  const createdAtValid = isValidDateEvidence(runtime.createdAt);
  const approvedAtSupplied = runtime.approvedAt !== undefined && runtime.approvedAt !== null;
  const approvedAtValid = approvedAtSupplied && isValidDateEvidence(runtime.approvedAt);
  const createdTime = createdAtValid ? new Date(String(runtime.createdAt)).getTime() : null;
  const approvedTime = approvedAtValid ? new Date(String(runtime.approvedAt)).getTime() : null;

  if (!asOfValid) {
    issues.push({ field: 'asOfDate', severity: 'error', message: 'Baseline as-of date is invalid.' });
  }
  if (!createdAtValid) {
    issues.push({ field: 'createdAt', severity: 'error', message: 'Baseline created-at timestamp is invalid.' });
  }
  if (approvedAtSupplied && !approvedAtValid) {
    issues.push({ field: 'approvedAt', severity: 'error', message: 'Baseline approval timestamp is invalid.' });
  }
  if (
    approvedTime !== null &&
    createdTime !== null &&
    approvedTime < createdTime
  ) {
    issues.push({
      field: 'approvedAt',
      severity: 'error',
      message: 'Baseline approval timestamp cannot precede its creation timestamp.',
    });
  }
  if (runtime.status === 'approved' && !approvedAtSupplied) {
    issues.push({
      field: 'approvedAt',
      severity: 'warning',
      message: 'Approved baseline has no explicit approval timestamp.',
    });
  }

  const sourceRefs = Array.isArray(runtime.sourceRefs) ? runtime.sourceRefs : [];
  if (runtime.sourceRefs !== undefined && !Array.isArray(runtime.sourceRefs)) {
    issues.push({
      field: 'sourceRefs',
      severity: 'error',
      message: 'Baseline source references must be an array when supplied.',
    });
  }

  sourceRefs.forEach((sourceRef, index) => {
    if (!isRecord(sourceRef)) {
      issues.push({
        field: `sourceRefs.${index}`,
        severity: 'error',
        message: `Source reference ${index + 1} must be an object.`,
      });
      return;
    }

    const runtimeSource = sourceRef;
    const optionalIdentityFields: Array<keyof Pick<
      BaselineSourceRef,
      'sourceSystem' | 'sourceFile' | 'sourceVersion' | 'sourceUrl'
    >> = ['sourceSystem', 'sourceFile', 'sourceVersion', 'sourceUrl'];
    const hasSourceIdentity = optionalIdentityFields.some((field) =>
      isNonBlankString(runtimeSource[field])
    );

    if (!hasSourceIdentity) {
      issues.push({
        field: `sourceRefs.${index}`,
        severity: 'error',
        message: `Source reference ${index + 1} must retain at least one explicit source identity.`,
      });
    }

    for (const field of optionalIdentityFields) {
      const value = runtimeSource[field];
      if (value !== undefined && !isNonBlankString(value)) {
        issues.push({
          field: `sourceRefs.${index}.${field}`,
          severity: 'error',
          message: `Source reference ${index + 1} ${field} must be a non-blank string when supplied.`,
        });
      }
    }

    if (runtimeSource.importedAt !== undefined && !isValidDateEvidence(runtimeSource.importedAt)) {
      issues.push({
        field: `sourceRefs.${index}.importedAt`,
        severity: 'error',
        message: `Source reference ${index + 1} has an invalid import timestamp.`,
      });
    }
  });

  const metrics = runtime.metrics;
  if (metrics === null || typeof metrics !== 'object' || Array.isArray(metrics)) {
    issues.push({
      field: 'metrics',
      severity: 'error',
      message: 'Baseline metrics must be an object keyed by explicit metric identity.',
    });
    return issues;
  }

  for (const [metric, value] of Object.entries(metrics as Record<string, unknown>)) {
    if (!metric.trim()) {
      issues.push({
        field: 'metrics',
        severity: 'error',
        message: 'Baseline metric identities must be non-blank.',
      });
    } else if (hasOuterWhitespace(metric)) {
      issues.push({
        field: `metrics.${metric}`,
        severity: 'error',
        message: `Baseline metric identity ${metric} contains leading or trailing whitespace; metric identity evidence must be supplied exactly.`,
      });
    }
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      issues.push({
        field: `metrics.${metric}`,
        severity: 'error',
        message: `Metric ${metric} must be a finite number or null.`,
      });
    }
  }

  return issues;
}

export interface BaselineMetricComparison {
  metric: string;
  baseValue: number | null;
  compareValue: number | null;
  absoluteVariance: number | null;
  variancePct: number | null;
}

export interface BaselineComparison {
  baseBaselineId: string;
  compareBaselineId: string;
  baseKind: BaselineKind;
  compareKind: BaselineKind;
  baseAsOfDate: string;
  compareAsOfDate: string;
  metrics: BaselineMetricComparison[];
}

export function compareBaselines(
  base: InvestmentBaselineSnapshot,
  compare: InvestmentBaselineSnapshot
): BaselineComparison {
  const metricNames = Array.from(
    new Set([...Object.keys(base.metrics), ...Object.keys(compare.metrics)])
  ).sort();

  const metrics = metricNames.map<BaselineMetricComparison>((metric) => {
    const baseValue = base.metrics[metric] ?? null;
    const compareValue = compare.metrics[metric] ?? null;
    const bothAvailable = baseValue !== null && compareValue !== null;
    const absoluteVariance = bothAvailable ? compareValue - baseValue : null;
    const variancePct =
      bothAvailable && baseValue !== 0
        ? ((compareValue - baseValue) / Math.abs(baseValue)) * 100
        : null;

    return {
      metric,
      baseValue,
      compareValue,
      absoluteVariance,
      variancePct,
    };
  });

  return {
    baseBaselineId: base.id,
    compareBaselineId: compare.id,
    baseKind: base.kind,
    compareKind: compare.kind,
    baseAsOfDate: base.asOfDate,
    compareAsOfDate: compare.asOfDate,
    metrics,
  };
}

/**
 * Returns the latest snapshot for each lifecycle baseline kind.
 * Selection is deterministic: as-of date first, then created-at timestamp.
 */
export function latestBaselineByKind(
  snapshots: InvestmentBaselineSnapshot[]
): Partial<Record<BaselineKind, InvestmentBaselineSnapshot>> {
  const result: Partial<Record<BaselineKind, InvestmentBaselineSnapshot>> = {};

  for (const snapshot of snapshots) {
    const current = result[snapshot.kind];
    if (!current) {
      result[snapshot.kind] = snapshot;
      continue;
    }

    const snapshotAsOf = new Date(snapshot.asOfDate).getTime();
    const currentAsOf = new Date(current.asOfDate).getTime();
    const snapshotCreated = new Date(snapshot.createdAt).getTime();
    const currentCreated = new Date(current.createdAt).getTime();

    if (
      snapshotAsOf > currentAsOf ||
      (snapshotAsOf === currentAsOf && snapshotCreated > currentCreated)
    ) {
      result[snapshot.kind] = snapshot;
    }
  }

  return result;
}

function freezeRetainedEvidence(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) =>
      isRecord(item) ? Object.freeze({ ...item }) : item
    );
    return Object.freeze(items);
  }

  if (isRecord(value)) {
    return Object.freeze({ ...value });
  }

  return value;
}

/**
 * Protects an approved case from accidental in-place mutation at runtime.
 * Persistence layers should still enforce append-only/versioned storage separately.
 *
 * This boundary may receive retained/deserialized evidence that violates the static
 * TypeScript contract. It therefore preserves malformed container shape while
 * freezing inspectable evidence rather than normalizing arrays/scalars into objects
 * or throwing before the validator can fail closed.
 */
export function freezeApprovedBaseline(
  snapshot: InvestmentBaselineSnapshot
): Readonly<InvestmentBaselineSnapshot> {
  if (snapshot.status !== 'approved') return snapshot;

  const runtime = snapshot as unknown as Record<string, unknown>;
  const sourceRefs = freezeRetainedEvidence(runtime.sourceRefs);
  const metrics = freezeRetainedEvidence(runtime.metrics);

  return Object.freeze({
    ...runtime,
    sourceRefs,
    metrics,
  }) as unknown as Readonly<InvestmentBaselineSnapshot>;
}
