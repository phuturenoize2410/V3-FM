import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';

export interface BaselineApprovalIdentityMismatch {
  field: string;
  expected: string;
  actual: string;
}

export interface BaselineApprovalIdentityDiagnostics {
  passed: boolean;
  blockingReasons: string[];
  mismatches: BaselineApprovalIdentityMismatch[];
}

function render(value: unknown): string {
  if (value === undefined) return '<undefined>';
  if (value === null) return '<null>';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '<non-finite>';
  return JSON.stringify(value);
}

function pushMismatch(
  mismatches: BaselineApprovalIdentityMismatch[],
  field: string,
  expected: unknown,
  actual: unknown
): void {
  if (render(expected) === render(actual)) return;
  mismatches.push({ field, expected: render(expected), actual: render(actual) });
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
 * Asset-generic, read-only control proving that a draft -> approved baseline
 * transition preserved the underlying economic/provenance snapshot.
 *
 * Approval may change only governance metadata (`status`, `approvedAt`,
 * `approvedBy`). Every other explicit baseline field must remain identical.
 * Source references are compared as a canonical population so ordering alone
 * does not create a false failure; metric names and values are compared exactly.
 *
 * This diagnostic intentionally does not authenticate approval authority,
 * approve/supersede/select a baseline, persist records, infer lifecycle order,
 * calculate economics, repair provenance, or introduce asset-specific terms.
 */
export function assessBaselineApprovalIdentity(input: {
  draft: InvestmentBaselineSnapshot | null;
  approved: InvestmentBaselineSnapshot | null;
}): BaselineApprovalIdentityDiagnostics {
  const mismatches: BaselineApprovalIdentityMismatch[] = [];
  const blockingReasons: string[] = [];
  const { draft, approved } = input;

  if (!draft) {
    blockingReasons.push(
      'Baseline approval identity cannot be established because the source draft snapshot is unavailable.'
    );
  }

  if (!approved) {
    blockingReasons.push(
      'Baseline approval identity cannot be established because the approved snapshot is unavailable.'
    );
  }

  if (!draft || !approved) {
    return { passed: false, blockingReasons, mismatches };
  }

  if (draft.status !== 'draft') {
    blockingReasons.push(
      `Approval identity requires a draft source snapshot; ${draft.id} currently has status ${draft.status}.`
    );
  }

  if (approved.status !== 'approved') {
    blockingReasons.push(
      `Approval identity requires an approved destination snapshot; ${approved.id} currently has status ${approved.status}.`
    );
  }

  pushMismatch(mismatches, 'id', draft.id, approved.id);
  pushMismatch(mismatches, 'kind', draft.kind, approved.kind);
  pushMismatch(mismatches, 'name', draft.name, approved.name);
  pushMismatch(mismatches, 'projectId', draft.projectId, approved.projectId);
  pushMismatch(mismatches, 'asOfDate', draft.asOfDate, approved.asOfDate);
  pushMismatch(mismatches, 'createdAt', draft.createdAt, approved.createdAt);
  pushMismatch(mismatches, 'predecessorId', draft.predecessorId, approved.predecessorId);
  pushMismatch(mismatches, 'modelVersion', draft.modelVersion, approved.modelVersion);
  pushMismatch(mismatches, 'notes', draft.notes, approved.notes);
  pushMismatch(
    mismatches,
    'sourceRefs',
    canonicalSourceRefs(draft),
    canonicalSourceRefs(approved)
  );

  const metricNames = Array.from(
    new Set([...Object.keys(draft.metrics), ...Object.keys(approved.metrics)])
  ).sort();

  for (const metricName of metricNames) {
    pushMismatch(
      mismatches,
      `metrics.${metricName}`,
      Object.prototype.hasOwnProperty.call(draft.metrics, metricName)
        ? draft.metrics[metricName]
        : '<missing>',
      Object.prototype.hasOwnProperty.call(approved.metrics, metricName)
        ? approved.metrics[metricName]
        : '<missing>'
    );
  }

  if (mismatches.length > 0) {
    blockingReasons.push(
      `Approved baseline differs from its source draft in ${mismatches.length} governed field(s); approval metadata cannot mask an economic/provenance change.`
    );
  }

  return {
    passed: blockingReasons.length === 0 && mismatches.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
    mismatches,
  };
}
