import type {
  BaselineKind,
  InvestmentBaselineSnapshot,
} from './baselineVersioningEngine';
import { validateBaselineRegistry } from './baselineGovernanceEngine';

export type PirPlanBaselineKind =
  | 'ic_case'
  | 'entry_case'
  | 'financial_close_case'
  | 'approved_budget';

export interface PirBaselineSelectionRequest {
  planBaselineId: string;
  actualBaselineId: string;
}

export interface PirBaselineSelectionIssue {
  severity: 'error' | 'warning';
  field: 'planBaselineId' | 'actualBaselineId' | 'registry' | 'projectId' | 'asOfDate';
  message: string;
}

export interface PirBaselineSelectionResult {
  ready: boolean;
  planBaseline: InvestmentBaselineSnapshot | null;
  actualBaseline: InvestmentBaselineSnapshot | null;
  issues: PirBaselineSelectionIssue[];
  errors: PirBaselineSelectionIssue[];
  warnings: PirBaselineSelectionIssue[];
}

const ALLOWED_PLAN_KINDS = new Set<BaselineKind>([
  'ic_case',
  'entry_case',
  'financial_close_case',
  'approved_budget',
]);

function readTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTime(value: unknown): number | null {
  const normalized = readTrimmedString(value);
  if (!normalized) return null;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Explicit baseline-selection gate for Post-Investment Review (PIR).
 *
 * This control is deliberately asset-generic. It does not decide which lifecycle
 * case management should use as the PIR comparison case, and it never selects a
 * "latest" baseline automatically. The caller must provide both ids explicitly.
 *
 * Defensible release rules:
 * - the registry and selection request must retain valid runtime object envelopes;
 *   malformed deserialized evidence fails closed before registry traversal;
 * - both selected snapshots must exist in the supplied governed registry;
 * - registry integrity must be valid before PIR can rely on its lineage;
 * - both snapshots must be approved (draft or superseded cases are not silently
 *   promoted into decision evidence);
 * - the plan side must be an explicit decision/budget case;
 * - the Actual side must be an approved Actual-to-Date baseline;
 * - project ids must match when present on either side; malformed retained
 *   identity evidence fails closed instead of being coerced;
 * - both selected as-of dates must be valid retained date evidence before PIR can
 *   perform chronology comparison;
 * - Actual as-of date cannot precede the selected plan baseline as-of date.
 *
 * No commercial term, asset class, tariff, EBL structure, KPI semantics or
 * materiality threshold is inferred here.
 */
export function assessPirBaselineSelection(
  snapshots: InvestmentBaselineSnapshot[],
  request: PirBaselineSelectionRequest
): PirBaselineSelectionResult {
  const issues: PirBaselineSelectionIssue[] = [];
  const registryPopulation = Array.isArray(snapshots)
    ? snapshots.filter((snapshot) => isRecord(snapshot))
    : [];
  const registryEnvelopeMalformed =
    !Array.isArray(snapshots) || registryPopulation.length !== snapshots.length;

  if (registryEnvelopeMalformed) {
    issues.push({
      severity: 'error',
      field: 'registry',
      message:
        'Baseline registry contains malformed runtime row evidence; PIR selection cannot traverse or repair that population.',
    });
  } else {
    const registry = validateBaselineRegistry(
      registryPopulation as InvestmentBaselineSnapshot[]
    );

    if (!registry.valid) {
      issues.push({
        severity: 'error',
        field: 'registry',
        message:
          'Baseline registry contains governance errors. Resolve registry integrity before releasing a PIR comparison.',
      });
    }
  }

  const requestRecord = isRecord(request) ? request : null;
  const rawPlanId = requestRecord?.planBaselineId;
  const rawActualId = requestRecord?.actualBaselineId;
  const planId = readTrimmedString(rawPlanId);
  const actualId = readTrimmedString(rawActualId);
  const safeSnapshots = registryPopulation as InvestmentBaselineSnapshot[];
  const planBaseline = planId
    ? safeSnapshots.find((snapshot) => readTrimmedString((snapshot as { id?: unknown }).id) === planId) ?? null
    : null;
  const actualBaseline = actualId
    ? safeSnapshots.find((snapshot) => readTrimmedString((snapshot as { id?: unknown }).id) === actualId) ?? null
    : null;

  if (!requestRecord) {
    issues.push({
      severity: 'error',
      field: 'registry',
      message:
        'PIR baseline selection request evidence is malformed; expected an object carrying explicit plan and Actual baseline ids.',
    });
  }

  if (!planId) {
    issues.push({
      severity: 'error',
      field: 'planBaselineId',
      message:
        typeof rawPlanId === 'string'
          ? 'PIR requires an explicitly selected plan / decision baseline id.'
          : 'PIR plan baseline identity evidence is malformed; expected a non-blank string id.',
    });
  } else if (!planBaseline) {
    issues.push({
      severity: 'error',
      field: 'planBaselineId',
      message: `Selected PIR plan baseline ${planId} is not present in the governed registry.`,
    });
  }

  if (!actualId) {
    issues.push({
      severity: 'error',
      field: 'actualBaselineId',
      message:
        typeof rawActualId === 'string'
          ? 'PIR requires an explicitly selected approved Actual-to-Date baseline id.'
          : 'PIR Actual baseline identity evidence is malformed; expected a non-blank string id.',
    });
  } else if (!actualBaseline) {
    issues.push({
      severity: 'error',
      field: 'actualBaselineId',
      message: `Selected PIR Actual baseline ${actualId} is not present in the governed registry.`,
    });
  }

  if (planBaseline) {
    if (!ALLOWED_PLAN_KINDS.has(planBaseline.kind)) {
      issues.push({
        severity: 'error',
        field: 'planBaselineId',
        message:
          `Baseline ${planBaseline.id} is ${planBaseline.kind}; PIR plan comparison must explicitly select an IC, Entry, Financial Close or Approved Budget case.`,
      });
    }

    if (planBaseline.status !== 'approved') {
      issues.push({
        severity: 'error',
        field: 'planBaselineId',
        message: `Selected PIR plan baseline ${planBaseline.id} must be approved, not ${planBaseline.status}.`,
      });
    }
  }

  if (actualBaseline) {
    if (actualBaseline.kind !== 'actual_to_date') {
      issues.push({
        severity: 'error',
        field: 'actualBaselineId',
        message: `Baseline ${actualBaseline.id} is ${actualBaseline.kind}; PIR Actual comparison requires an Actual-to-Date baseline.`,
      });
    }

    if (actualBaseline.status !== 'approved') {
      issues.push({
        severity: 'error',
        field: 'actualBaselineId',
        message: `Selected PIR Actual baseline ${actualBaseline.id} must be approved, not ${actualBaseline.status}.`,
      });
    }
  }

  if (planBaseline && actualBaseline) {
    const rawPlanProjectId = (planBaseline as { projectId?: unknown }).projectId;
    const rawActualProjectId = (actualBaseline as { projectId?: unknown }).projectId;
    const planProjectId = readTrimmedString(rawPlanProjectId);
    const actualProjectId = readTrimmedString(rawActualProjectId);
    const planProjectIdentityMalformed =
      rawPlanProjectId !== undefined && rawPlanProjectId !== null && typeof rawPlanProjectId !== 'string';
    const actualProjectIdentityMalformed =
      rawActualProjectId !== undefined && rawActualProjectId !== null && typeof rawActualProjectId !== 'string';

    if (planProjectIdentityMalformed || actualProjectIdentityMalformed) {
      issues.push({
        severity: 'error',
        field: 'projectId',
        message:
          'Selected PIR baselines contain malformed project identity evidence; cross-project comparison cannot be excluded.',
      });
    } else if (planProjectId || actualProjectId) {
      if (!planProjectId || !actualProjectId || planProjectId !== actualProjectId) {
        issues.push({
          severity: 'error',
          field: 'projectId',
          message:
            'Selected PIR baselines do not carry the same explicit project identity; cross-project comparison cannot be released.',
        });
      }
    } else {
      issues.push({
        severity: 'warning',
        field: 'projectId',
        message:
          'Neither selected baseline carries a project id. Comparison can remain technically valid, but portfolio-level project identity should be governed before scale-up.',
      });
    }

    const planTime = parseTime((planBaseline as { asOfDate?: unknown }).asOfDate);
    const actualTime = parseTime((actualBaseline as { asOfDate?: unknown }).asOfDate);

    if (planTime === null) {
      issues.push({
        severity: 'error',
        field: 'asOfDate',
        message:
          'Selected PIR plan baseline has missing or malformed as-of date evidence; chronology cannot be verified.',
      });
    }

    if (actualTime === null) {
      issues.push({
        severity: 'error',
        field: 'asOfDate',
        message:
          'Selected PIR Actual baseline has missing or malformed as-of date evidence; chronology cannot be verified.',
      });
    }

    if (planTime !== null && actualTime !== null && actualTime < planTime) {
      issues.push({
        severity: 'error',
        field: 'asOfDate',
        message:
          'Actual-to-Date baseline as-of date precedes the selected plan baseline as-of date; the PIR comparison period is not defensible.',
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return {
    ready: errors.length === 0,
    planBaseline,
    actualBaseline,
    issues,
    errors,
    warnings,
  };
}
