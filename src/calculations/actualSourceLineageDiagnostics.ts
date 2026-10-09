import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { ActualSourceRow } from './investmentLifecycleEngine';

export type ActualSourceLineageCheckCode =
  | 'workflow_envelope_invalid'
  | 'accepted_population_invalid'
  | 'released_population_invalid'
  | 'accepted_row_missing_from_release'
  | 'unexpected_released_row'
  | 'accepted_row_id_invalid'
  | 'released_row_id_invalid'
  | 'accepted_source_metadata_invalid'
  | 'released_source_metadata_invalid'
  | 'accepted_row_id_duplicated'
  | 'released_row_id_duplicated'
  | 'source_metadata_mismatch';

export type ActualSourceLineageField = Exclude<keyof ActualSourceRow, 'amount'>;

export interface ActualSourceLineageIssue {
  readonly code: ActualSourceLineageCheckCode;
  readonly severity: 'error';
  readonly rowId: string;
  readonly field?: ActualSourceLineageField;
  readonly message: string;
}

export interface ActualSourceLineageDiagnostics {
  readonly passed: boolean;
  readonly acceptedRowCount: number;
  readonly releasedRowCount: number;
  readonly sourceIdentityReconciles: boolean;
  readonly issues: ReadonlyArray<ActualSourceLineageIssue>;
}

const SOURCE_LINEAGE_FIELDS: ReadonlyArray<ActualSourceLineageField> = [
  'rowId',
  'sourceSystem',
  'sourceFile',
  'postingDate',
  'cutoffDate',
  'company',
  'projectId',
  'phase',
  'glAccount',
  'costCenter',
  'wbsCode',
  'costCode',
  'contractId',
  'vendor',
  'currency',
  'dataClass',
  'description',
];

const REQUIRED_STRING_LINEAGE_FIELDS: ReadonlyArray<ActualSourceLineageField> = [
  'rowId',
  'sourceSystem',
  'postingDate',
  'dataClass',
];

const OPTIONAL_STRING_LINEAGE_FIELDS: ReadonlyArray<ActualSourceLineageField> = [
  'sourceFile',
  'cutoffDate',
  'company',
  'projectId',
  'phase',
  'glAccount',
  'costCenter',
  'wbsCode',
  'costCode',
  'contractId',
  'vendor',
  'currency',
  'description',
];

function isRuntimeRowObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function runtimeRowId(value: unknown): string | null {
  if (!isRuntimeRowObject(value)) return null;
  const rowId = value.rowId;
  return typeof rowId === 'string' && rowId.trim() ? rowId : null;
}

function runtimePopulation(value: unknown): ReadonlyArray<ActualSourceRow> | null {
  return Array.isArray(value) ? value as ReadonlyArray<ActualSourceRow> : null;
}

function invalidSourceMetadataFields(value: unknown): ReadonlyArray<ActualSourceLineageField> {
  if (!isRuntimeRowObject(value)) return SOURCE_LINEAGE_FIELDS;

  const invalid = new Set<ActualSourceLineageField>();
  REQUIRED_STRING_LINEAGE_FIELDS.forEach((field) => {
    const fieldValue = value[field];
    if (typeof fieldValue !== 'string' || !fieldValue.trim()) invalid.add(field);
  });
  OPTIONAL_STRING_LINEAGE_FIELDS.forEach((field) => {
    if (value[field] !== undefined && typeof value[field] !== 'string') invalid.add(field);
  });

  return Object.freeze(Array.from(invalid));
}

function indexByRowId<T extends ActualSourceRow>(rows: ReadonlyArray<T>): Map<string, T> {
  const indexed = new Map<string, T>();
  rows.forEach((row) => {
    const rowId = runtimeRowId(row);
    if (rowId !== null) indexed.set(rowId, row);
  });
  return indexed;
}

function duplicatedRowIds<T extends ActualSourceRow>(rows: ReadonlyArray<T>): ReadonlyArray<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  rows.forEach((row) => {
    const rowId = runtimeRowId(row);
    if (rowId === null) return;
    const comparisonKey = rowId.trim();
    if (seen.has(comparisonKey)) {
      duplicates.add(comparisonKey);
      return;
    }
    seen.add(comparisonKey);
  });

  return Object.freeze(Array.from(duplicates));
}

function sourceFieldMatches(
  accepted: ActualSourceRow,
  released: ActualSourceRow,
  field: ActualSourceLineageField
): boolean {
  return accepted[field] === released[field];
}

/**
 * Independently verifies immutable source-row lineage across the accepted import
 * population -> released Actual boundary.
 *
 * Mapping Master is allowed to add FinMod classification fields to released rows,
 * but it must not rewrite the source evidence that was accepted at import. This
 * control therefore compares the original ActualSourceRow identity/metadata fields
 * exactly. Amount reconciliation remains the responsibility of
 * actualReleasedPopulationDiagnostics.ts so the two controls stay independent.
 *
 * Duplicate row identities are checked independently on both retained populations
 * using the same trimmed comparison key applied by import/release reconciliation
 * governance before this diagnostic relies on raw-ID Map lookup. Exact row IDs are
 * still matched and reported as supplied; this diagnostic does not normalize or
 * rewrite caller-owned source evidence.
 *
 * Retained/deserialized workflow evidence can bypass TypeScript contracts. Invalid
 * workflow envelopes, source-row population envelopes, row envelopes,
 * missing/non-string/blank row identities, blank required source metadata, or
 * non-string source metadata therefore fail closed at this independent lineage
 * boundary instead of throwing or being accepted merely because both retained
 * populations contain the same malformed value. This is type/envelope/completeness
 * validation only: allowed lifecycle/data-class values and date semantics remain
 * owned by their authoritative upstream controls and are not duplicated here.
 *
 * This diagnostic is asset-generic and calculation-free. It does not normalize,
 * repair, remap or infer source values, accounting treatment or commercial terms.
 * Returned diagnostics are runtime-immutable so downstream baseline, PIR and
 * reporting consumers cannot alter the evaluated lineage decision or issue set
 * after this control has run. Caller-owned workflow rows are not copied, mutated
 * or deep-frozen by this diagnostic.
 */
export function diagnoseActualSourceLineage(
  workflow: ActualWorkflowResult
): ActualSourceLineageDiagnostics {
  const workflowEnvelopeValid = isRuntimeRowObject(workflow);
  const runtimeWorkflow = workflowEnvelopeValid
    ? workflow as unknown as {
        readonly validation?: unknown;
        readonly releasedRows?: unknown;
      }
    : null;
  const runtimeValidation = isRuntimeRowObject(runtimeWorkflow?.validation)
    ? runtimeWorkflow?.validation as { readonly acceptedRows?: unknown }
    : null;
  const retainedAcceptedRows = runtimePopulation(runtimeValidation?.acceptedRows);
  const retainedReleasedRows = runtimePopulation(runtimeWorkflow?.releasedRows);
  const acceptedRows = retainedAcceptedRows ?? Object.freeze([] as ActualSourceRow[]);
  const releasedRows = retainedReleasedRows ?? Object.freeze([] as ActualSourceRow[]);
  const acceptedById = indexByRowId(acceptedRows);
  const releasedById = indexByRowId(releasedRows);
  const issues: ActualSourceLineageIssue[] = [];

  if (!workflowEnvelopeValid) {
    issues.push({
      code: 'workflow_envelope_invalid',
      severity: 'error',
      rowId: '(workflow)',
      message: 'Retained Actual workflow evidence is not an object and cannot prove deterministic source lineage.',
    });
  }

  if (retainedAcceptedRows === null) {
    issues.push({
      code: 'accepted_population_invalid',
      severity: 'error',
      rowId: '(population)',
      message: 'Retained accepted-import source-row evidence is not an array and cannot prove deterministic source lineage.',
    });
  }

  if (retainedReleasedRows === null) {
    issues.push({
      code: 'released_population_invalid',
      severity: 'error',
      rowId: '(population)',
      message: 'Retained released-Actual source-row evidence is not an array and cannot prove deterministic source lineage.',
    });
  }

  acceptedRows.forEach((accepted, index) => {
    const rowId = runtimeRowId(accepted);
    if (rowId === null) {
      issues.push({
        code: 'accepted_row_id_invalid',
        severity: 'error',
        rowId: '(invalid)',
        field: 'rowId',
        message: `Accepted source row at retained index ${index} has invalid row identity evidence and cannot prove deterministic source lineage.`,
      });
    }

    invalidSourceMetadataFields(accepted)
      .filter((field) => field !== 'rowId')
      .forEach((field) => {
        issues.push({
          code: 'accepted_source_metadata_invalid',
          severity: 'error',
          rowId: rowId ?? '(invalid)',
          field,
          message: `Accepted source row at retained index ${index} has blank, non-string or missing required source field ${field}, or non-string optional source metadata.`,
        });
      });
  });

  releasedRows.forEach((released, index) => {
    const rowId = runtimeRowId(released);
    if (rowId === null) {
      issues.push({
        code: 'released_row_id_invalid',
        severity: 'error',
        rowId: '(invalid)',
        field: 'rowId',
        message: `Released Actual row at retained index ${index} has invalid row identity evidence and cannot prove deterministic source lineage.`,
      });
    }

    invalidSourceMetadataFields(released)
      .filter((field) => field !== 'rowId')
      .forEach((field) => {
        issues.push({
          code: 'released_source_metadata_invalid',
          severity: 'error',
          rowId: rowId ?? '(invalid)',
          field,
          message: `Released Actual row at retained index ${index} has blank, non-string or missing required source field ${field}, or non-string optional source metadata.`,
        });
      });
  });

  duplicatedRowIds(acceptedRows).forEach((rowId) => {
    issues.push({
      code: 'accepted_row_id_duplicated',
      severity: 'error',
      rowId,
      message: `Accepted source row identity ${rowId} is duplicated and cannot prove deterministic source lineage.`,
    });
  });

  duplicatedRowIds(releasedRows).forEach((rowId) => {
    issues.push({
      code: 'released_row_id_duplicated',
      severity: 'error',
      rowId,
      message: `Released Actual row identity ${rowId} is duplicated and cannot prove deterministic source lineage.`,
    });
  });

  acceptedRows.forEach((accepted) => {
    const acceptedRowId = runtimeRowId(accepted);
    if (acceptedRowId === null) return;

    const released = releasedById.get(acceptedRowId);
    if (!released) {
      issues.push({
        code: 'accepted_row_missing_from_release',
        severity: 'error',
        rowId: acceptedRowId,
        message: `Accepted source row ${acceptedRowId} is missing from the released Actual population.`,
      });
      return;
    }

    SOURCE_LINEAGE_FIELDS.forEach((field) => {
      if (!sourceFieldMatches(accepted, released, field)) {
        issues.push({
          code: 'source_metadata_mismatch',
          severity: 'error',
          rowId: acceptedRowId,
          field,
          message: `Released Actual row ${acceptedRowId} changed immutable source field ${field}.`,
        });
      }
    });
  });

  releasedRows.forEach((released) => {
    const releasedRowId = runtimeRowId(released);
    if (releasedRowId === null) return;

    if (!acceptedById.has(releasedRowId)) {
      issues.push({
        code: 'unexpected_released_row',
        severity: 'error',
        rowId: releasedRowId,
        message: `Released Actual row ${releasedRowId} has no matching accepted source row.`,
      });
    }
  });

  const sourceIdentityReconciles = issues.length === 0;
  const frozenIssues: ReadonlyArray<ActualSourceLineageIssue> = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed: sourceIdentityReconciles,
    acceptedRowCount: acceptedRows.length,
    releasedRowCount: releasedRows.length,
    sourceIdentityReconciles,
    issues: frozenIssues,
  });
}
