import type { ActualDataPresentationState } from './actualPresentationStatus';
import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { EnergySalesControlResult } from './energySalesControls';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';
import {
  assessPirReadiness,
  type PirReadinessIssue,
  type PirReadinessResult,
} from './pirReadinessEngine';

export interface PirReleaseControlResult extends PirReadinessResult {
  releaseReady: boolean;
  actualDiagnosticsSupplied: boolean;
  actualDiagnosticsReleaseReady: boolean;
  actualEvidenceConsistent: boolean;
}

/**
 * Final asset-generic release gate for a controlled Post-Investment Review.
 *
 * `assessPirReadiness` validates governed Plan / Actual baselines and optional
 * asset-module controls. This wrapper deliberately adds the independent Actual
 * release-diagnostics requirement used by the presentation layer so a caller
 * cannot promote a VERIFIED_RELEASED label into a releasable PIR without the
 * row/amount reconciliation evidence produced by the controlled Actual workflow.
 *
 * Diagnostics are also reconciled back to the presentation metadata. This avoids
 * a stale or unrelated diagnostics object being attached to a different displayed
 * Actual population while still appearing release-ready.
 *
 * This control does not select a comparison baseline, infer commercial terms,
 * calculate PIR economics, persist approvals, or make electricity mandatory.
 */
export function assessPirReleaseControl(input: {
  planBaseline?: InvestmentBaselineSnapshot | null;
  actualBaseline?: InvestmentBaselineSnapshot | null;
  baselineRegistry: InvestmentBaselineSnapshot[];
  actualPresentation: ActualDataPresentationState;
  actualDiagnostics?: ActualReleaseDiagnostics | null;
  energySalesControls?: EnergySalesControlResult | null;
}): PirReleaseControlResult {
  const readiness = assessPirReadiness({
    planBaseline: input.planBaseline,
    actualBaseline: input.actualBaseline,
    baselineRegistry: input.baselineRegistry,
    actualPresentation: input.actualPresentation,
    energySalesControls: input.energySalesControls,
  });

  const diagnostics = input.actualDiagnostics ?? null;
  const diagnosticIssues: PirReadinessIssue[] = [];

  if (!diagnostics) {
    diagnosticIssues.push({
      code: 'PIR_ACTUAL_RELEASE_DIAGNOSTICS_MISSING',
      severity: 'error',
      message:
        'Controlled PIR release requires Actual release diagnostics; a verified presentation label alone is insufficient evidence.',
    });
  } else if (!diagnostics.releaseReady) {
    diagnosticIssues.push({
      code: 'PIR_ACTUAL_RELEASE_DIAGNOSTICS_BLOCKED',
      severity: 'error',
      message:
        'Actual release diagnostics are not release-ready; resolve rejected, unmapped or reconciliation blockers before PIR release.',
    });
  }

  if (diagnostics) {
    for (const check of diagnostics.checks) {
      if (check.severity === 'error' && !check.passed) {
        diagnosticIssues.push({
          code: `PIR_ACTUAL_DIAGNOSTIC_${check.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
          severity: 'error',
          message: `${check.label}: ${check.detail}`,
        });
      }
    }

    if (
      input.actualPresentation.cutoffDate !== null &&
      diagnostics.cutoffDate !== input.actualPresentation.cutoffDate
    ) {
      diagnosticIssues.push({
        code: 'PIR_ACTUAL_EVIDENCE_CUTOFF_MISMATCH',
        severity: 'error',
        message:
          'Actual release diagnostics cutoff date does not match the displayed Actual population cutoff date.',
      });
    }

    if (
      input.actualPresentation.sourceRows !== null &&
      diagnostics.sourceRows !== input.actualPresentation.sourceRows
    ) {
      diagnosticIssues.push({
        code: 'PIR_ACTUAL_EVIDENCE_SOURCE_ROWS_MISMATCH',
        severity: 'error',
        message:
          'Actual release diagnostics source-row count does not match the displayed Actual population.',
      });
    }

    if (diagnostics.releasedRows !== input.actualPresentation.releasedRows) {
      diagnosticIssues.push({
        code: 'PIR_ACTUAL_EVIDENCE_RELEASED_ROWS_MISMATCH',
        severity: 'error',
        message:
          'Actual release diagnostics released-row count does not match the displayed Actual population.',
      });
    }
  }

  const actualEvidenceConsistent =
    diagnostics !== null &&
    !diagnosticIssues.some((issue) =>
      issue.code.startsWith('PIR_ACTUAL_EVIDENCE_')
    );

  const issues = [...readiness.issues, ...diagnosticIssues];
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  return {
    ...readiness,
    ready: errors.length === 0,
    releaseReady: errors.length === 0,
    issues,
    errors,
    warnings,
    actualDiagnosticsSupplied: diagnostics !== null,
    actualDiagnosticsReleaseReady: diagnostics?.releaseReady === true,
    actualEvidenceConsistent,
  };
}
