import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';

export interface PirActualBaselineIdentityMismatch {
  field: string;
  expected: string;
  actual: string;
}

export interface PirActualBaselineIdentityDiagnostics {
  passed: boolean;
  blockingReasons: string[];
  mismatches: PirActualBaselineIdentityMismatch[];
}

function text(value: unknown): string {
  if (value === undefined) return '<undefined>';
  if (value === null) return '<null>';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '<non-finite>';
  return JSON.stringify(value);
}

function pushMismatch(
  mismatches: PirActualBaselineIdentityMismatch[],
  field: string,
  expected: unknown,
  actual: unknown
): void {
  if (text(expected) === text(actual)) return;
  mismatches.push({ field, expected: text(expected), actual: text(actual) });
}

function canonicalSourceRefs(snapshot: InvestmentBaselineSnapshot): string[] {
  return (snapshot.sourceRefs ?? [])
    .map((ref) =>
      JSON.stringify({
        importedAt: ref.importedAt ?? null,
        sourceFile: ref.sourceFile ?? null,
        sourceSystem: ref.sourceSystem ?? null,
        sourceUrl: ref.sourceUrl ?? null,
        sourceVersion: ref.sourceVersion ?? null,
      })
    )
    .sort();
}

/**
 * Verifies that the approved Actual-to-Date baseline selected for PIR is the
 * same economic/provenance snapshot as the evidence-bound draft candidate that
 * came from the controlled Actual workflow.
 *
 * Approval is allowed to add only governance metadata (`status`, `approvedAt`,
 * `approvedBy`). All other explicit baseline fields must remain identical.
 * Source references are compared as a canonical population so harmless ordering
 * does not create a false failure; metric names and values are compared exactly.
 *
 * Boundary: this diagnostic is asset-generic and read-only. It does not approve,
 * supersede, repair or select a baseline; mutate Actuals or Mapping Master data;
 * calculate PIR economics; infer KPI/accounting semantics; or introduce sector-
 * specific/commercial assumptions.
 */
export function assessPirActualBaselineIdentity(input: {
  evidencedDraft: InvestmentBaselineSnapshot | null;
  selectedApprovedActual: InvestmentBaselineSnapshot | null;
}): PirActualBaselineIdentityDiagnostics {
  const mismatches: PirActualBaselineIdentityMismatch[] = [];
  const blockingReasons: string[] = [];
  const { evidencedDraft, selectedApprovedActual } = input;

  if (!evidencedDraft) {
    blockingReasons.push(
      'PIR Actual identity cannot be established because the evidence-bound Actual-to-Date draft candidate is unavailable.'
    );
  }

  if (!selectedApprovedActual) {
    blockingReasons.push(
      'PIR Actual identity cannot be established because no approved Actual-to-Date baseline is selected.'
    );
  }

  if (!evidencedDraft || !selectedApprovedActual) {
    return { passed: false, blockingReasons, mismatches };
  }

  if (evidencedDraft.kind !== 'actual_to_date') {
    blockingReasons.push(
      `Evidence-bound candidate ${evidencedDraft.id} is ${evidencedDraft.kind}, not actual_to_date.`
    );
  }

  if (evidencedDraft.status !== 'draft') {
    blockingReasons.push(
      `Evidence-bound Actual candidate ${evidencedDraft.id} must remain draft before explicit approval; current status is ${evidencedDraft.status}.`
    );
  }

  if (selectedApprovedActual.kind !== 'actual_to_date') {
    blockingReasons.push(
      `Selected PIR Actual baseline ${selectedApprovedActual.id} is ${selectedApprovedActual.kind}, not actual_to_date.`
    );
  }

  if (selectedApprovedActual.status !== 'approved') {
    blockingReasons.push(
      `Selected PIR Actual baseline ${selectedApprovedActual.id} must be approved; current status is ${selectedApprovedActual.status}.`
    );
  }

  pushMismatch(mismatches, 'id', evidencedDraft.id, selectedApprovedActual.id);
  pushMismatch(mismatches, 'kind', evidencedDraft.kind, selectedApprovedActual.kind);
  pushMismatch(mismatches, 'name', evidencedDraft.name, selectedApprovedActual.name);
  pushMismatch(mismatches, 'projectId', evidencedDraft.projectId, selectedApprovedActual.projectId);
  pushMismatch(mismatches, 'asOfDate', evidencedDraft.asOfDate, selectedApprovedActual.asOfDate);
  pushMismatch(mismatches, 'createdAt', evidencedDraft.createdAt, selectedApprovedActual.createdAt);
  pushMismatch(mismatches, 'predecessorId', evidencedDraft.predecessorId, selectedApprovedActual.predecessorId);
  pushMismatch(mismatches, 'modelVersion', evidencedDraft.modelVersion, selectedApprovedActual.modelVersion);
  pushMismatch(mismatches, 'notes', evidencedDraft.notes, selectedApprovedActual.notes);
  pushMismatch(
    mismatches,
    'sourceRefs',
    canonicalSourceRefs(evidencedDraft),
    canonicalSourceRefs(selectedApprovedActual)
  );

  const metricNames = Array.from(
    new Set([
      ...Object.keys(evidencedDraft.metrics),
      ...Object.keys(selectedApprovedActual.metrics),
    ])
  ).sort();

  for (const metricName of metricNames) {
    pushMismatch(
      mismatches,
      `metrics.${metricName}`,
      Object.prototype.hasOwnProperty.call(evidencedDraft.metrics, metricName)
        ? evidencedDraft.metrics[metricName]
        : '<missing>',
      Object.prototype.hasOwnProperty.call(selectedApprovedActual.metrics, metricName)
        ? selectedApprovedActual.metrics[metricName]
        : '<missing>'
    );
  }

  if (mismatches.length > 0) {
    blockingReasons.push(
      `Selected approved Actual baseline differs from the evidence-bound candidate in ${mismatches.length} governed field(s).`
    );
  }

  return {
    passed: blockingReasons.length === 0 && mismatches.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
    mismatches,
  };
}
