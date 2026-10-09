import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { MappedActualRow } from './investmentLifecycleEngine';
import {
  buildActualReleaseDiagnostics,
  type ActualReleaseDiagnostics,
} from './actualReleaseDiagnostics';
import {
  type BaselineSourceRef,
  type InvestmentBaselineSnapshot,
  validateBaselineSnapshot,
} from './baselineVersioningEngine';

export interface VerifiedActualBaselineInput {
  workflow: ActualWorkflowResult;
  baselineId: string;
  baselineName: string;
  createdAt: string;
  projectId?: string;
  modelVersion?: string;
  predecessorId?: string;
  notes?: string;
  buildMetrics: (releasedRows: readonly MappedActualRow[]) => Record<string, number | null>;
}

export interface VerifiedActualBaselineResult {
  releasable: boolean;
  blockingReasons: string[];
  snapshot: InvestmentBaselineSnapshot | null;
  releaseDiagnostics: ActualReleaseDiagnostics;
}

function buildSourceRefs(rows: readonly MappedActualRow[]): BaselineSourceRef[] {
  const unique = new Map<string, BaselineSourceRef>();

  for (const row of rows) {
    const sourceSystem = row.sourceSystem.trim();
    const sourceFile = row.sourceFile?.trim() || undefined;
    const key = `${sourceSystem}::${sourceFile ?? ''}`;

    if (!unique.has(key)) {
      unique.set(key, {
        sourceSystem,
        sourceFile,
      });
    }
  }

  return Array.from(unique.values()).sort((a, b) => {
    const aKey = `${a.sourceSystem ?? ''}::${a.sourceFile ?? ''}`;
    const bKey = `${b.sourceSystem ?? ''}::${b.sourceFile ?? ''}`;
    return aKey.localeCompare(bKey);
  });
}

/**
 * Creates an Actual-to-Date baseline candidate only from a fully released
 * Actual workflow population whose independent release diagnostics also pass.
 *
 * The bridge deliberately does not infer financial KPI semantics from mapped
 * categories. Callers must provide an explicit metric builder so project,
 * portfolio and asset-specific KPI definitions remain controlled outside the
 * generic release gate.
 *
 * Generic controlled lifecycle release and Actual-only semantic readiness are
 * intentionally distinct. This bridge consumes the stricter diagnostics gate:
 * commitment, ETC, budget or model-baseline rows can remain valid controlled
 * workflow populations, but they cannot be relabelled into Actual-to-Date.
 *
 * The resulting snapshot is always draft. Approval must remain a separate,
 * explicit governance action; a verified import is not the same as an approved
 * investment baseline.
 */
export function buildVerifiedActualToDateBaseline(
  input: VerifiedActualBaselineInput
): VerifiedActualBaselineResult {
  const releaseDiagnostics = buildActualReleaseDiagnostics(input.workflow);
  const blockingReasons = [...input.workflow.blockingReasons];

  if (
    !input.workflow.releasableToLifecycle ||
    !releaseDiagnostics.releaseReady ||
    input.workflow.releasedRows.length === 0
  ) {
    if (input.workflow.releasableToLifecycle && input.workflow.releasedRows.length === 0) {
      blockingReasons.push('Verified Actual population is empty at the selected cutoff.');
    }

    if (!releaseDiagnostics.releaseReady) {
      const failedChecks = releaseDiagnostics.checks.filter(
        (check) => check.severity === 'error' && !check.passed
      );

      if (failedChecks.length > 0) {
        blockingReasons.push(
          ...failedChecks.map((check) => `${check.label}: ${check.detail}`)
        );
      } else if (input.workflow.releasableToLifecycle) {
        blockingReasons.push(
          'Controlled release diagnostics are not ready for baseline handoff.'
        );
      }
    }

    return {
      releasable: false,
      blockingReasons: Array.from(new Set(blockingReasons)),
      snapshot: null,
      releaseDiagnostics,
    };
  }

  if (!releaseDiagnostics.actualOnlyReleaseReady) {
    const nonActualClasses = releaseDiagnostics.releasedDataClassCounts
      .filter((item) => item.dataClass !== 'actual')
      .map((item) => item.dataClass)
      .sort();

    return {
      releasable: false,
      blockingReasons: [
        ...blockingReasons,
        `Actual-to-Date baseline requires an Actual-only released population; ${releaseDiagnostics.nonActualRows} row(s) are classified as ${nonActualClasses.join(', ')}.`,
      ],
      snapshot: null,
      releaseDiagnostics,
    };
  }

  const metrics = input.buildMetrics(input.workflow.releasedRows);
  const snapshot: InvestmentBaselineSnapshot = {
    id: input.baselineId,
    kind: 'actual_to_date',
    name: input.baselineName,
    projectId: input.projectId,
    asOfDate: input.workflow.cutoffDate,
    createdAt: input.createdAt,
    status: 'draft',
    predecessorId: input.predecessorId,
    modelVersion: input.modelVersion,
    notes: input.notes,
    sourceRefs: buildSourceRefs(input.workflow.releasedRows),
    metrics,
  };

  const validationIssues = validateBaselineSnapshot(snapshot).filter(
    (issue) => issue.severity === 'error'
  );

  if (validationIssues.length > 0) {
    return {
      releasable: false,
      blockingReasons: [
        ...blockingReasons,
        ...validationIssues.map((issue) => `${issue.field}: ${issue.message}`),
      ],
      snapshot: null,
      releaseDiagnostics,
    };
  }

  return {
    releasable: true,
    blockingReasons,
    snapshot,
    releaseDiagnostics,
  };
}

