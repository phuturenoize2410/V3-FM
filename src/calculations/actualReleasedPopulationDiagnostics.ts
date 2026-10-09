import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { ActualSourceRow } from './investmentLifecycleEngine';

export type ActualReleasedPopulationCheckCode =
  | 'accepted_population_invalid'
  | 'released_population_invalid'
  | 'released_population_not_releasable'
  | 'accepted_row_missing_from_release'
  | 'unexpected_released_row'
  | 'accepted_row_amount_not_finite'
  | 'released_row_amount_not_finite'
  | 'accepted_row_id_invalid'
  | 'released_row_id_invalid'
  | 'accepted_row_id_blank'
  | 'released_row_id_blank'
  | 'accepted_row_id_duplicated'
  | 'released_row_id_duplicated'
  | 'released_row_amount_mismatch'
  | 'released_population_amount_mismatch'
  | 'released_population_count_mismatch';

export interface ActualReleasedPopulationIssue {
  readonly code: ActualReleasedPopulationCheckCode;
  readonly severity: 'error';
  readonly rowId?: string;
  readonly message: string;
}

export interface ActualReleasedPopulationDiagnostics {
  readonly passed: boolean;
  readonly acceptedRowCount: number;
  readonly releasedRowCount: number;
  readonly acceptedAmount: number;
  readonly releasedAmount: number;
  readonly rowIdentityReconciles: boolean;
  readonly rowAmountReconciles: boolean;
  readonly populationAmountReconciles: boolean;
  readonly populationCountReconciles: boolean;
  readonly issues: ReadonlyArray<ActualReleasedPopulationIssue>;
}

const AMOUNT_TOLERANCE = 1e-9;

function isRuntimeRowObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function runtimePopulation(value: unknown): ReadonlyArray<ActualSourceRow> | null {
  return Array.isArray(value) ? value as ReadonlyArray<ActualSourceRow> : null;
}

function runtimeRowId(value: unknown): string | null {
  if (!isRuntimeRowObject(value)) return null;
  return typeof value.rowId === 'string' ? value.rowId : null;
}

function runtimeAmount(value: unknown): number | null {
  if (!isRuntimeRowObject(value)) return null;
  return typeof value.amount === 'number' && Number.isFinite(value.amount) ? value.amount : null;
}

function safeAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function amountReconciles(left: unknown, right: unknown): boolean {
  return typeof left === 'number'
    && typeof right === 'number'
    && Number.isFinite(left)
    && Number.isFinite(right)
    && Math.abs(left - right) <= AMOUNT_TOLERANCE;
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
    if (!comparisonKey) return;
    if (seen.has(comparisonKey)) {
      duplicates.add(comparisonKey);
      return;
    }
    seen.add(comparisonKey);
  });

  return Object.freeze(Array.from(duplicates));
}

/**
 * Independently reconciles the exact source population accepted by import
 * validation to the population released by the controlled Actual workflow.
 *
 * This diagnostic is deliberately calculation-free and classification-free:
 * - it does not map or remap rows;
 * - it does not infer accounting treatment, project ownership or commercial terms;
 * - it does not approve a baseline or PIR population;
 * - it only verifies row identity, row amount, population count and population
 *   amount across the accepted-source -> released-population boundary.
 *
 * The workflow rejects blank/duplicate source row IDs before release using trimmed
 * source identity. This boundary repeats those identity invariants independently on
 * retained accepted and released populations before relying on exact raw-ID Map
 * lookup, so missing identities or formatting variants cannot masquerade as valid
 * one-to-one provenance. Exact raw row IDs are still used for accepted-to-released
 * matching and are never normalized or rewritten here. Amount validation is repeated
 * defensively at this boundary: non-finite accepted or released values are explicit
 * blocking errors and can never reconcile merely because aggregation falls back to
 * zero.
 *
 * Retained/deserialized workflow evidence may bypass TypeScript contracts. Malformed
 * population envelopes, row envelopes and non-string row identities therefore fail
 * closed at this independent reconciliation boundary instead of throwing during
 * array traversal, `.trim()` or Map construction. No malformed evidence is coerced,
 * repaired or promoted into released Actual data.
 */
export function diagnoseActualReleasedPopulation(
  workflow: ActualWorkflowResult
): ActualReleasedPopulationDiagnostics {
  const runtimeWorkflow = workflow as unknown as {
    readonly validation?: { readonly acceptedRows?: unknown };
    readonly releasedRows?: unknown;
    readonly releasableToLifecycle?: unknown;
  };
  const retainedAcceptedRows = runtimePopulation(runtimeWorkflow.validation?.acceptedRows);
  const retainedReleasedRows = runtimePopulation(runtimeWorkflow.releasedRows);
  const acceptedRows = retainedAcceptedRows ?? Object.freeze([] as ActualSourceRow[]);
  const releasedRows = retainedReleasedRows ?? Object.freeze([] as ActualSourceRow[]);
  const acceptedById = indexByRowId(acceptedRows);
  const releasedById = indexByRowId(releasedRows);
  const issues: ActualReleasedPopulationIssue[] = [];

  if (retainedAcceptedRows === null) {
    issues.push({
      code: 'accepted_population_invalid',
      severity: 'error',
      message: 'Retained accepted-import population is not an array and cannot be reconciled deterministically.',
    });
  }

  if (retainedReleasedRows === null) {
    issues.push({
      code: 'released_population_invalid',
      severity: 'error',
      message: 'Retained released-Actual population is not an array and cannot be reconciled deterministically.',
    });
  }

  acceptedRows.forEach((row, index) => {
    const rowId = runtimeRowId(row);
    if (rowId === null) {
      issues.push({
        code: 'accepted_row_id_invalid',
        severity: 'error',
        rowId: '(invalid)',
        message: `Accepted source row at retained index ${index} has non-string or missing row identity evidence.`,
      });
      return;
    }
    if (rowId.trim().length === 0) {
      issues.push({
        code: 'accepted_row_id_blank',
        severity: 'error',
        rowId,
        message: 'Accepted source row has a blank row identity and cannot be reconciled deterministically.',
      });
    }
  });

  releasedRows.forEach((row, index) => {
    const rowId = runtimeRowId(row);
    if (rowId === null) {
      issues.push({
        code: 'released_row_id_invalid',
        severity: 'error',
        rowId: '(invalid)',
        message: `Released Actual row at retained index ${index} has non-string or missing row identity evidence.`,
      });
      return;
    }
    if (rowId.trim().length === 0) {
      issues.push({
        code: 'released_row_id_blank',
        severity: 'error',
        rowId,
        message: 'Released Actual row has a blank row identity and cannot be reconciled deterministically.',
      });
    }
  });

  duplicatedRowIds(acceptedRows).forEach((rowId) => {
    issues.push({
      code: 'accepted_row_id_duplicated',
      severity: 'error',
      rowId,
      message: `Accepted source row identity ${rowId} is duplicated and cannot be reconciled deterministically.`,
    });
  });

  duplicatedRowIds(releasedRows).forEach((rowId) => {
    issues.push({
      code: 'released_row_id_duplicated',
      severity: 'error',
      rowId,
      message: `Released Actual row identity ${rowId} is duplicated and cannot be reconciled deterministically.`,
    });
  });

  if (runtimeWorkflow.releasableToLifecycle !== true && releasedRows.length > 0) {
    issues.push({
      code: 'released_population_not_releasable',
      severity: 'error',
      message:
        'Actual workflow released rows even though the population is not releasable to lifecycle.',
    });
  }

  acceptedRows.forEach((accepted) => {
    const acceptedRowId = runtimeRowId(accepted);
    const acceptedAmount = runtimeAmount(accepted);
    if (acceptedAmount === null) {
      issues.push({
        code: 'accepted_row_amount_not_finite',
        severity: 'error',
        rowId: acceptedRowId ?? '(invalid)',
        message: `Accepted source row ${acceptedRowId ?? '(invalid)'} has a non-finite or non-numeric amount and cannot be reconciled.`,
      });
    }

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

    if (!amountReconciles(acceptedAmount, runtimeAmount(released))) {
      issues.push({
        code: 'released_row_amount_mismatch',
        severity: 'error',
        rowId: acceptedRowId,
        message: `Released amount for source row ${acceptedRowId} does not reconcile to the accepted import amount.`,
      });
    }
  });

  releasedRows.forEach((released) => {
    const releasedRowId = runtimeRowId(released);
    if (runtimeAmount(released) === null) {
      issues.push({
        code: 'released_row_amount_not_finite',
        severity: 'error',
        rowId: releasedRowId ?? '(invalid)',
        message: `Released Actual row ${releasedRowId ?? '(invalid)'} has a non-finite or non-numeric amount and cannot be reconciled.`,
      });
    }

    if (releasedRowId !== null && !acceptedById.has(releasedRowId)) {
      issues.push({
        code: 'unexpected_released_row',
        severity: 'error',
        rowId: releasedRowId,
        message: `Released row ${releasedRowId} does not exist in the accepted import population.`,
      });
    }
  });

  const acceptedAmount = acceptedRows.reduce((sum, row) => sum + safeAmount(isRuntimeRowObject(row) ? row.amount : undefined), 0);
  const releasedAmount = releasedRows.reduce((sum, row) => sum + safeAmount(isRuntimeRowObject(row) ? row.amount : undefined), 0);
  const populationCountReconciles = retainedAcceptedRows !== null
    && retainedReleasedRows !== null
    && acceptedRows.length === releasedRows.length;
  const allAcceptedAmountsFinite = acceptedRows.every((row) => runtimeAmount(row) !== null);
  const allReleasedAmountsFinite = releasedRows.every((row) => runtimeAmount(row) !== null);
  const populationAmountReconciles = retainedAcceptedRows !== null
    && retainedReleasedRows !== null
    && allAcceptedAmountsFinite
    && allReleasedAmountsFinite
    && amountReconciles(acceptedAmount, releasedAmount);

  if (!populationCountReconciles) {
    issues.push({
      code: 'released_population_count_mismatch',
      severity: 'error',
      message: `Released Actual row count (${releasedRows.length}) does not reconcile to accepted import row count (${acceptedRows.length}).`,
    });
  }

  if (!populationAmountReconciles) {
    issues.push({
      code: 'released_population_amount_mismatch',
      severity: 'error',
      message: 'Released Actual population amount does not reconcile to the accepted import population amount.',
    });
  }

  const validAcceptedRowIds = acceptedRows.every((row) => {
    const rowId = runtimeRowId(row);
    return rowId !== null && rowId.trim().length > 0;
  });
  const validReleasedRowIds = releasedRows.every((row) => {
    const rowId = runtimeRowId(row);
    return rowId !== null && rowId.trim().length > 0;
  });
  const noDuplicateAcceptedRowIds = duplicatedRowIds(acceptedRows).length === 0;
  const noDuplicateReleasedRowIds = duplicatedRowIds(releasedRows).length === 0;
  const rowIdentityReconciles = retainedAcceptedRows !== null
    && retainedReleasedRows !== null
    && validAcceptedRowIds
    && validReleasedRowIds
    && noDuplicateAcceptedRowIds
    && noDuplicateReleasedRowIds
    && acceptedRows.every((row) => {
      const rowId = runtimeRowId(row);
      return rowId !== null && releasedById.has(rowId);
    })
    && releasedRows.every((row) => {
      const rowId = runtimeRowId(row);
      return rowId !== null && acceptedById.has(rowId);
    });
  const rowAmountReconciles = rowIdentityReconciles
    && acceptedRows.every((row) => {
      const rowId = runtimeRowId(row);
      if (rowId === null) return false;
      const released = releasedById.get(rowId);
      return released ? amountReconciles(runtimeAmount(row), runtimeAmount(released)) : false;
    });
  const frozenIssues = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed:
      runtimeWorkflow.releasableToLifecycle === true
        ? frozenIssues.length === 0
        : releasedRows.length === 0 && frozenIssues.length === 0,
    acceptedRowCount: acceptedRows.length,
    releasedRowCount: releasedRows.length,
    acceptedAmount,
    releasedAmount,
    rowIdentityReconciles,
    rowAmountReconciles,
    populationAmountReconciles,
    populationCountReconciles,
    issues: frozenIssues,
  });
}
