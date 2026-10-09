import type { ActualDataPresentationState } from './actualPresentationStatus';
import {
  type BaselineKind,
  type InvestmentBaselineSnapshot,
} from './baselineVersioningEngine';
import { validateBaselineRegistry } from './baselineGovernanceEngine';
import type { EnergySalesControlResult } from './energySalesControls';

export type PirReadinessSeverity = 'error' | 'warning';

export interface PirReadinessIssue {
  code: string;
  severity: PirReadinessSeverity;
  message: string;
}

export interface PirReadinessResult {
  ready: boolean;
  issues: PirReadinessIssue[];
  errors: PirReadinessIssue[];
  warnings: PirReadinessIssue[];
  planBaselineId: string | null;
  actualBaselineId: string | null;
  actualStatus: ActualDataPresentationState['status'];
  energyModuleAssessed: boolean;
}

const PLAN_BASELINE_KINDS: BaselineKind[] = [
  'ic_case',
  'entry_case',
  'financial_close_case',
  'approved_budget',
  'latest_forecast',
];

function normalizedSourceRefs(snapshot: InvestmentBaselineSnapshot) {
  return (snapshot.sourceRefs ?? []).map((ref) => ({
    sourceSystem: ref.sourceSystem ?? null,
    sourceFile: ref.sourceFile ?? null,
    sourceVersion: ref.sourceVersion ?? null,
    sourceUrl: ref.sourceUrl ?? null,
    importedAt: ref.importedAt ?? null,
  }));
}

/**
 * A PIR caller may pass the selected baseline separately from the governed
 * registry. Matching only by id is insufficient because a detached/stale object
 * with the same id could carry different approval metadata or KPI values.
 *
 * This re-performance therefore requires the selected snapshot to match the
 * registry copy across controlled metadata, provenance and metrics. The check
 * is intentionally asset-generic and does not impose any commercial lifecycle
 * ordering or KPI taxonomy.
 */
function selectedBaselineMatchesRegistry(
  selected: InvestmentBaselineSnapshot,
  registrySnapshot: InvestmentBaselineSnapshot
): boolean {
  const selectedMetrics = Object.entries(selected.metrics).sort(([a], [b]) => a.localeCompare(b));
  const registryMetrics = Object.entries(registrySnapshot.metrics).sort(([a], [b]) => a.localeCompare(b));

  return (
    selected.id === registrySnapshot.id &&
    selected.kind === registrySnapshot.kind &&
    selected.name === registrySnapshot.name &&
    (selected.projectId ?? null) === (registrySnapshot.projectId ?? null) &&
    selected.asOfDate === registrySnapshot.asOfDate &&
    selected.createdAt === registrySnapshot.createdAt &&
    selected.status === registrySnapshot.status &&
    (selected.approvedAt ?? null) === (registrySnapshot.approvedAt ?? null) &&
    (selected.approvedBy ?? null) === (registrySnapshot.approvedBy ?? null) &&
    (selected.predecessorId ?? null) === (registrySnapshot.predecessorId ?? null) &&
    (selected.modelVersion ?? null) === (registrySnapshot.modelVersion ?? null) &&
    (selected.notes ?? null) === (registrySnapshot.notes ?? null) &&
    JSON.stringify(normalizedSourceRefs(selected)) === JSON.stringify(normalizedSourceRefs(registrySnapshot)) &&
    JSON.stringify(selectedMetrics) === JSON.stringify(registryMetrics)
  );
}

/**
 * Asset-generic release gate for Post-Investment Review (PIR).
 *
 * The engine does not calculate PIR economics and does not choose a commercial
 * comparison case for the caller. It only checks whether supplied comparison
 * populations are auditable enough to be presented as a controlled PIR:
 * - the Plan case is an explicitly identified, approved lifecycle baseline;
 * - the Actual case is a controlled Actual-to-Date baseline;
 * - UI/data provenance reports VERIFIED_RELEASED rather than demo/manual Actuals;
 * - the supplied baseline registry passes referential/approval governance;
 * - selected baseline objects match their governed registry snapshots;
 * - Plan and Actual belong to the same project when both project IDs are present;
 * - optional electricity Energy Sales controls pass when that module is included.
 *
 * Electricity is deliberately optional. Non-power assets can run the same PIR
 * readiness gate without importing tariff or Energy Sales semantics.
 */
export function assessPirReadiness(input: {
  planBaseline?: InvestmentBaselineSnapshot | null;
  actualBaseline?: InvestmentBaselineSnapshot | null;
  baselineRegistry: InvestmentBaselineSnapshot[];
  actualPresentation: ActualDataPresentationState;
  energySalesControls?: EnergySalesControlResult | null;
}): PirReadinessResult {
  const issues: PirReadinessIssue[] = [];
  const plan = input.planBaseline ?? null;
  const actual = input.actualBaseline ?? null;

  const governance = validateBaselineRegistry(input.baselineRegistry);
  for (const issue of governance.errors) {
    issues.push({
      code: 'PIR_BASELINE_GOVERNANCE_ERROR',
      severity: 'error',
      message: `${issue.baselineId}: ${issue.message}`,
    });
  }
  for (const issue of governance.warnings) {
    issues.push({
      code: 'PIR_BASELINE_GOVERNANCE_WARNING',
      severity: 'warning',
      message: `${issue.baselineId}: ${issue.message}`,
    });
  }

  if (!plan) {
    issues.push({
      code: 'PIR_PLAN_BASELINE_MISSING',
      severity: 'error',
      message: 'PIR requires an explicitly selected Plan / decision baseline.',
    });
  } else {
    if (!PLAN_BASELINE_KINDS.includes(plan.kind)) {
      issues.push({
        code: 'PIR_PLAN_BASELINE_KIND_INVALID',
        severity: 'error',
        message: `Baseline ${plan.id} (${plan.kind}) is not a valid Plan / decision comparison case.`,
      });
    }

    if (plan.status !== 'approved') {
      issues.push({
        code: 'PIR_PLAN_BASELINE_NOT_APPROVED',
        severity: 'error',
        message: `Plan baseline ${plan.id} is ${plan.status}; a controlled PIR must compare against an approved decision baseline.`,
      });
    }
  }

  if (!actual) {
    issues.push({
      code: 'PIR_ACTUAL_BASELINE_MISSING',
      severity: 'error',
      message: 'PIR requires an Actual-to-Date baseline built from released Actual data.',
    });
  } else {
    if (actual.kind !== 'actual_to_date') {
      issues.push({
        code: 'PIR_ACTUAL_BASELINE_KIND_INVALID',
        severity: 'error',
        message: `Actual comparison baseline ${actual.id} must be kind actual_to_date.`,
      });
    }

    if (actual.status !== 'approved') {
      issues.push({
        code: 'PIR_ACTUAL_BASELINE_NOT_APPROVED',
        severity: 'error',
        message: `Actual-to-Date baseline ${actual.id} is ${actual.status}; controlled PIR release requires an approved baseline.`,
      });
    }
  }

  if (
    input.actualPresentation.status !== 'VERIFIED_RELEASED' ||
    !input.actualPresentation.verified ||
    !input.actualPresentation.lifecycleEligible
  ) {
    issues.push({
      code: 'PIR_ACTUAL_PROVENANCE_NOT_VERIFIED',
      severity: 'error',
      message: `Actual population is ${input.actualPresentation.status}; demo, manual or blocked imports are not eligible for controlled PIR release.`,
    });
  }

  if (
    plan?.projectId &&
    actual?.projectId &&
    plan.projectId !== actual.projectId
  ) {
    issues.push({
      code: 'PIR_PROJECT_MISMATCH',
      severity: 'error',
      message: 'Plan and Actual baselines have different project IDs.',
    });
  }

  if (plan) {
    const registryPlan = input.baselineRegistry.find((snapshot) => snapshot.id === plan.id);
    if (!registryPlan) {
      issues.push({
        code: 'PIR_PLAN_BASELINE_NOT_IN_REGISTRY',
        severity: 'error',
        message: `Plan baseline ${plan.id} is not present in the supplied governed baseline registry.`,
      });
    } else if (!selectedBaselineMatchesRegistry(plan, registryPlan)) {
      issues.push({
        code: 'PIR_PLAN_BASELINE_REGISTRY_MISMATCH',
        severity: 'error',
        message: `Selected Plan baseline ${plan.id} does not match the governed registry snapshot with the same id.`,
      });
    }
  }

  if (actual) {
    const registryActual = input.baselineRegistry.find((snapshot) => snapshot.id === actual.id);
    if (!registryActual) {
      issues.push({
        code: 'PIR_ACTUAL_BASELINE_NOT_IN_REGISTRY',
        severity: 'error',
        message: `Actual baseline ${actual.id} is not present in the supplied governed baseline registry.`,
      });
    } else if (!selectedBaselineMatchesRegistry(actual, registryActual)) {
      issues.push({
        code: 'PIR_ACTUAL_BASELINE_REGISTRY_MISMATCH',
        severity: 'error',
        message: `Selected Actual baseline ${actual.id} does not match the governed registry snapshot with the same id.`,
      });
    }
  }

  if (input.energySalesControls && !input.energySalesControls.passed) {
    const energyErrors = input.energySalesControls.issues.filter(
      (issue) => issue.severity === 'error'
    );
    for (const issue of energyErrors) {
      issues.push({
        code: `PIR_${issue.code}`,
        severity: 'error',
        message: `Energy Sales module: ${issue.message}`,
      });
    }
  }

  if (input.energySalesControls) {
    const energyWarnings = input.energySalesControls.issues.filter(
      (issue) => issue.severity === 'warning'
    );
    for (const issue of energyWarnings) {
      issues.push({
        code: `PIR_${issue.code}`,
        severity: 'warning',
        message: `Energy Sales module: ${issue.message}`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return {
    ready: errors.length === 0,
    issues,
    errors,
    warnings,
    planBaselineId: plan?.id ?? null,
    actualBaselineId: actual?.id ?? null,
    actualStatus: input.actualPresentation.status,
    energyModuleAssessed: Boolean(input.energySalesControls),
  };
}
