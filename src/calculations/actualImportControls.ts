import { isValidDateEvidence } from './dateEvidenceControls';
import type { ActualSourceRow, MappedActualRow } from './investmentLifecycleEngine';

export type ActualImportIssueCode =
  | 'invalid_population_shape'
  | 'invalid_row_shape'
  | 'missing_row_id'
  | 'invalid_row_id'
  | 'duplicate_row_id'
  | 'missing_source_system'
  | 'invalid_source_system'
  | 'invalid_posting_date'
  | 'invalid_cutoff_date'
  | 'after_cutoff'
  | 'non_finite_amount'
  | 'missing_data_class'
  | 'invalid_data_class'
  | 'invalid_mapping_dimension'
  | 'invalid_currency_evidence';

export interface ActualImportIssue {
  readonly rowId: string | null;
  readonly code: ActualImportIssueCode;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface ActualImportValidationResult {
  readonly acceptedRows: ReadonlyArray<ActualSourceRow>;
  readonly rejectedRows: ReadonlyArray<ActualSourceRow>;
  readonly issues: ReadonlyArray<ActualImportIssue>;
  readonly control: Readonly<{
    inputRows: number;
    acceptedRows: number;
    rejectedRows: number;
    duplicateRowIds: number;
    inputAmount: number;
    acceptedAmount: number;
    rejectedAmount: number;
    amountReconciles: boolean;
  }>;
}

const VALID_ACTUAL_DATA_CLASSES = new Set<string>([
  'actual',
  'commitment',
  'forecast_etc',
  'budget',
  'model_baseline',
]);

const ACTUAL_MAPPING_STRING_DIMENSIONS = [
  'company',
  'projectId',
  'glAccount',
  'costCenter',
  'wbsCode',
  'costCode',
  'contractId',
] as const;

const GOVERNED_LIFECYCLE_PHASES = new Set<string>([
  'development',
  'financial_close',
  'construction',
  'cod',
  'operations',
  'ppa_expiry',
]);

function safeAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isRuntimeRowObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function runtimeRowAmount(value: unknown): number {
  return isRuntimeRowObject(value) ? safeAmount(value.amount) : 0;
}

function freezeRows<T>(rows: ReadonlyArray<T>): ReadonlyArray<T> {
  // Freeze only the population container. Row objects remain the exact caller-owned
  // references so downstream workflow identity checks are not silently rewritten.
  return Object.freeze([...rows]);
}

function freezeIssues(
  issues: ReadonlyArray<ActualImportIssue>
): ReadonlyArray<ActualImportIssue> {
  return Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );
}

function invalidPopulationResult(): ActualImportValidationResult {
  return Object.freeze({
    acceptedRows: freezeRows<ActualSourceRow>([]),
    rejectedRows: freezeRows<ActualSourceRow>([]),
    issues: freezeIssues([
      {
        rowId: null,
        code: 'invalid_population_shape',
        severity: 'error',
        message:
          'Actual import population must be supplied as an array; malformed retained or deserialized evidence is not coerced into rows.',
      },
    ]),
    control: Object.freeze({
      inputRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      duplicateRowIds: 0,
      inputAmount: 0,
      acceptedAmount: 0,
      rejectedAmount: 0,
      amountReconciles: true,
    }),
  });
}

/**
 * Validates imported Actual/Commitment/ETC rows before Mapping Master is applied.
 *
 * Design boundaries:
 * - Does not infer missing source fields.
 * - Does not mutate or classify rows.
 * - Runtime population containers are validated before row traversal. Non-array retained or
 *   deserialized evidence fails closed rather than being coerced into a synthetic population.
 * - Runtime row envelopes, identity/data-class/cutoff values and optional dimensions
 *   consumed by Mapping Master are validated independently instead of trusting the
 *   TypeScript contract, because imported/serialized evidence can bypass compile-time
 *   typing. Null, array or primitive row envelopes fail closed rather than throwing while
 *   property access or reconciliation controls are evaluated.
 * - Optional Mapping Master dimensions remain optional. When supplied, textual dimensions
 *   must stay strings and lifecycle phase must use an existing governed phase; no value is
 *   coerced, normalized into a different type, or inferred from other source evidence.
 * - Optional currency evidence remains optional, but when supplied it must remain a
 *   non-blank string. This protects downstream Plan-vs-Actual currency reconciliation
 *   from deserialized or empty evidence without inventing an ISO currency, FX conversion
 *   or base currency.
 * - Rows after an explicit cutoff are rejected rather than silently included.
 * - An explicitly supplied but invalid cutoff fails closed for the full population;
 *   it is never treated as equivalent to an omitted cutoff.
 * - Date evidence rejects impossible canonical YYYY-MM-DD calendar dates while retaining
 *   compatibility with other parseable formats until a canonical external date contract
 *   is explicitly governed; no timezone or business-day semantics are inferred here.
 * - Duplicate row IDs are rejected because source traceability must remain one-to-one.
 * - Amount controls reconcile accepted + rejected back to the imported population.
 * - Malformed runtime row envelopes contribute zero to amount controls because no governed
 *   numeric amount can be read from them; the row itself remains rejected and visible in
 *   population counts rather than being coerced into a synthetic Actual record.
 * - Input populations are read-only contracts: validation does not require ownership
 *   of mutable caller containers in order to prove accepted/rejected reconciliation.
 * - Returned population/issue/control envelopes are runtime-immutable so a downstream
 *   consumer cannot alter validation evidence after evaluation. Exact row objects are
 *   deliberately retained by reference; this control does not claim ownership of or
 *   deep-freeze caller source data.
 */
export function validateActualImport(
  rows: ReadonlyArray<ActualSourceRow> | unknown,
  cutoffDate?: unknown
): ActualImportValidationResult {
  if (!Array.isArray(rows)) return invalidPopulationResult();
  const population = rows as ReadonlyArray<ActualSourceRow>;
  const issues: ActualImportIssue[] = [];
  const rejected = new Set<number>();
  const seenRowIds = new Map<string, number>();
  const cutoffSupplied = cutoffDate !== undefined;
  const cutoffValid = cutoffSupplied && isValidDateEvidence(cutoffDate);
  const cutoff = cutoffValid ? new Date(cutoffDate as string).getTime() : null;
  let duplicateRowIds = 0;

  if (cutoffSupplied && !cutoffValid) {
    const cutoffLabel =
      typeof cutoffDate === 'string'
        ? cutoffDate.trim() || '(blank)'
        : cutoffDate === null
          ? '(null)'
          : `[${typeof cutoffDate}]`;

    issues.push({
      rowId: null,
      code: 'invalid_cutoff_date',
      severity: 'error',
      message: `Actual cutoff ${cutoffLabel} is invalid.`,
    });
    population.forEach((_, index) => rejected.add(index));
  }

  population.forEach((row, index) => {
    const runtimeRow = row as unknown;
    if (!isRuntimeRowObject(runtimeRow)) {
      issues.push({
        rowId: null,
        code: 'invalid_row_shape',
        severity: 'error',
        message: `Imported row ${index + 1} is not a valid Actual row object.`,
      });
      rejected.add(index);
      return;
    }

    const rawRowId = runtimeRow.rowId;
    const rowId = typeof rawRowId === 'string' ? rawRowId.trim() : '';

    if (rawRowId === undefined || rawRowId === null || rawRowId === '') {
      issues.push({
        rowId: null,
        code: 'missing_row_id',
        severity: 'error',
        message: `Imported row ${index + 1} has no source row ID.`,
      });
      rejected.add(index);
    } else if (typeof rawRowId !== 'string') {
      issues.push({
        rowId: null,
        code: 'invalid_row_id',
        severity: 'error',
        message: `Imported row ${index + 1} requires string source row-ID evidence.`,
      });
      rejected.add(index);
    } else if (!rowId) {
      issues.push({
        rowId: null,
        code: 'missing_row_id',
        severity: 'error',
        message: `Imported row ${index + 1} has no source row ID.`,
      });
      rejected.add(index);
    } else if (seenRowIds.has(rowId)) {
      duplicateRowIds += 1;
      issues.push({
        rowId,
        code: 'duplicate_row_id',
        severity: 'error',
        message: `Source row ID ${rowId} is duplicated in the import population.`,
      });
      rejected.add(index);
      const firstIndex = seenRowIds.get(rowId);
      if (firstIndex !== undefined) rejected.add(firstIndex);
    } else {
      seenRowIds.set(rowId, index);
    }

    const rawSourceSystem = runtimeRow.sourceSystem;
    if (
      rawSourceSystem === undefined ||
      rawSourceSystem === null ||
      rawSourceSystem === '' ||
      (typeof rawSourceSystem === 'string' && !rawSourceSystem.trim())
    ) {
      issues.push({
        rowId: rowId || null,
        code: 'missing_source_system',
        severity: 'error',
        message: 'Source system is required for Actual provenance.',
      });
      rejected.add(index);
    } else if (typeof rawSourceSystem !== 'string') {
      issues.push({
        rowId: rowId || null,
        code: 'invalid_source_system',
        severity: 'error',
        message: 'Source system must be supplied as string provenance evidence.',
      });
      rejected.add(index);
    }

    const postingDate = runtimeRow.postingDate;
    if (!isValidDateEvidence(postingDate)) {
      issues.push({
        rowId: rowId || null,
        code: 'invalid_posting_date',
        severity: 'error',
        message: `Posting date ${typeof postingDate === 'string' ? postingDate || '(blank)' : `[${typeof postingDate}]`} is invalid.`,
      });
      rejected.add(index);
    } else if (cutoff !== null && typeof postingDate === 'string' && new Date(postingDate).getTime() > cutoff) {
      issues.push({
        rowId: rowId || null,
        code: 'after_cutoff',
        severity: 'error',
        message: `Posting date ${postingDate} is after the Actual cutoff ${String(cutoffDate)}.`,
      });
      rejected.add(index);
    }

    const amount = runtimeRow.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      issues.push({
        rowId: rowId || null,
        code: 'non_finite_amount',
        severity: 'error',
        message: 'Amount must be a finite numeric value.',
      });
      rejected.add(index);
    }

    const dataClass = runtimeRow.dataClass;
    if (dataClass === undefined || dataClass === null || dataClass === '') {
      issues.push({
        rowId: rowId || null,
        code: 'missing_data_class',
        severity: 'error',
        message: 'Data class is required to distinguish Actual, commitment, ETC, budget or baseline.',
      });
      rejected.add(index);
    } else if (typeof dataClass !== 'string' || !VALID_ACTUAL_DATA_CLASSES.has(dataClass)) {
      issues.push({
        rowId: rowId || null,
        code: 'invalid_data_class',
        severity: 'error',
        message: `Data class ${String(dataClass)} is not a supported controlled Actual classification.`,
      });
      rejected.add(index);
    }

    for (const key of ACTUAL_MAPPING_STRING_DIMENSIONS) {
      const value = runtimeRow[key];
      if (value !== undefined && typeof value !== 'string') {
        issues.push({
          rowId: rowId || null,
          code: 'invalid_mapping_dimension',
          severity: 'error',
          message: `Mapping dimension ${key} must be supplied as string evidence when present.`,
        });
        rejected.add(index);
      }
    }

    const phase = runtimeRow.phase;
    if (
      phase !== undefined &&
      (typeof phase !== 'string' || !GOVERNED_LIFECYCLE_PHASES.has(phase))
    ) {
      issues.push({
        rowId: rowId || null,
        code: 'invalid_mapping_dimension',
        severity: 'error',
        message: 'Lifecycle phase must use an existing governed phase when supplied as Mapping Master evidence.',
      });
      rejected.add(index);
    }

    const currency = runtimeRow.currency;
    if (
      currency !== undefined &&
      (typeof currency !== 'string' || !currency.trim())
    ) {
      issues.push({
        rowId: rowId || null,
        code: 'invalid_currency_evidence',
        severity: 'error',
        message: 'Currency must be supplied as non-blank string evidence when present; no currency or FX treatment is inferred.',
      });
      rejected.add(index);
    }
  });

  const acceptedRows = population.filter((_, index) => !rejected.has(index));
  const rejectedRows = population.filter((_, index) => rejected.has(index));
  const inputAmount = population.reduce((sum, row) => sum + runtimeRowAmount(row), 0);
  const acceptedAmount = acceptedRows.reduce((sum, row) => sum + runtimeRowAmount(row), 0);
  const rejectedAmount = rejectedRows.reduce((sum, row) => sum + runtimeRowAmount(row), 0);
  const amountReconciles = Math.abs(inputAmount - acceptedAmount - rejectedAmount) <= 1e-9;

  return Object.freeze({
    acceptedRows: freezeRows(acceptedRows),
    rejectedRows: freezeRows(rejectedRows),
    issues: freezeIssues(issues),
    control: Object.freeze({
      inputRows: population.length,
      acceptedRows: acceptedRows.length,
      rejectedRows: rejectedRows.length,
      duplicateRowIds,
      inputAmount,
      acceptedAmount,
      rejectedAmount,
      amountReconciles,
    }),
  });
}

export interface ActualMappingGateResult {
  readonly releasable: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly totalRows: number;
  readonly mappedRows: number;
  readonly unmappedRows: number;
  readonly mappedAmount: number;
  readonly unmappedAmount: number;
}

/**
 * Final control gate before mapped Actuals are allowed into PIR / lifecycle snapshots.
 * All rows should have passed import validation before this function is called, but the
 * release boundary independently fails closed on malformed retained/reconstructed row
 * envelopes instead of relying on TypeScript or an earlier validation run.
 * Non-array retained/deserialized population evidence also fails closed before traversal.
 * A zero-row population is never releasable: arithmetic reconciliation to zero is
 * not evidence that a controlled Actual population exists.
 * Runtime mapping-status and amount values are validated independently instead of
 * trusting the TypeScript contract. Imported, retained or reconstructed evidence with
 * an unsupported status or non-finite amount must fail closed rather than disappearing
 * from controlled release evidence through safe aggregation.
 *
 * Input mapped populations are read-only contracts; the gate only observes the exact
 * supplied population and does not require a mutable container. The returned gate and
 * blocker population are runtime-immutable. This preserves the evaluated release
 * decision for downstream lifecycle/PIR consumers without changing Mapping Master
 * classifications or taking ownership of mapped row objects.
 */
export function assessActualMappingGate(
  rows: ReadonlyArray<MappedActualRow> | unknown
): ActualMappingGateResult {
  if (!Array.isArray(rows)) {
    return Object.freeze({
      releasable: false,
      blockingReasons: Object.freeze([
        'Actual Mapping Master release population must be supplied as an array; malformed retained or deserialized evidence is not coerced into rows.',
      ]),
      totalRows: 0,
      mappedRows: 0,
      unmappedRows: 0,
      mappedAmount: 0,
      unmappedAmount: 0,
    });
  }

  const runtimeRows = rows as ReadonlyArray<unknown>;
  const validRowObjects = runtimeRows.filter(isRuntimeRowObject);
  const invalidRowShapeCount = runtimeRows.length - validRowObjects.length;
  const mappedRows = validRowObjects.filter((row) => row.mappingStatus === 'mapped');
  const unmappedRows = validRowObjects.filter((row) => row.mappingStatus === 'unmapped');
  const invalidMappingStatusRows = validRowObjects.filter(
    (row) => row.mappingStatus !== 'mapped' && row.mappingStatus !== 'unmapped'
  );
  const invalidAmountRows = validRowObjects.filter(
    (row) => typeof row.amount !== 'number' || !Number.isFinite(row.amount)
  );
  const mappedAmount = mappedRows.reduce((sum, row) => sum + safeAmount(row.amount), 0);
  const unmappedAmount = unmappedRows.reduce((sum, row) => sum + safeAmount(row.amount), 0);
  const blockingReasons: string[] = [];

  if (runtimeRows.length === 0) {
    blockingReasons.push(
      'Actual Mapping Master release requires a non-empty source population.'
    );
  }

  if (invalidRowShapeCount > 0) {
    blockingReasons.push(
      `${invalidRowShapeCount} imported row(s) are not valid mapped Actual row objects.`
    );
  }

  if (invalidMappingStatusRows.length > 0) {
    blockingReasons.push(
      `${invalidMappingStatusRows.length} imported row(s) contain an unsupported Mapping Master status.`
    );
  }

  if (invalidAmountRows.length > 0) {
    blockingReasons.push(
      `${invalidAmountRows.length} imported row(s) contain a non-finite Actual amount.`
    );
  }

  if (unmappedRows.length > 0) {
    blockingReasons.push(`${unmappedRows.length} imported row(s) remain unmapped.`);
  }

  if (!Number.isFinite(mappedAmount) || !Number.isFinite(unmappedAmount)) {
    blockingReasons.push('Mapped Actual amount control contains a non-finite value.');
  }

  return Object.freeze({
    releasable: blockingReasons.length === 0,
    blockingReasons: Object.freeze([...blockingReasons]),
    totalRows: runtimeRows.length,
    mappedRows: mappedRows.length,
    unmappedRows: unmappedRows.length,
    mappedAmount,
    unmappedAmount,
  });
}
