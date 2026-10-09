import {
  assessActualMappingGate,
  type ActualMappingGateResult,
} from './actualImportControls';
import type { MappedActualRow } from './investmentLifecycleEngine';

export type ActualMappingReleaseEvidenceIssueCode =
  | 'invalid_population_shape'
  | 'mapping_gate_blocked'
  | 'invalid_row_id'
  | 'duplicate_row_id'
  | 'missing_mapping_rule_id'
  | 'missing_finmod_category'
  | 'invalid_finmod_subcategory'
  | 'missing_finmod_line_item'
  | 'invalid_accounting_treatment'
  | 'invalid_debt_eligible_evidence';

export interface ActualMappingReleaseEvidenceIssue {
  readonly rowId: string | null;
  readonly code: ActualMappingReleaseEvidenceIssueCode;
  readonly message: string;
}

export interface ActualMappingReleaseEvidenceDiagnostics {
  readonly releaseReady: boolean;
  readonly gate: ActualMappingGateResult;
  readonly retainedRows: ReadonlyArray<MappedActualRow>;
  readonly issues: ReadonlyArray<ActualMappingReleaseEvidenceIssue>;
}

const VALID_ACCOUNTING_TREATMENTS = new Set<string>([
  'capitalized',
  'expensed',
  'working_capital',
  'financing',
  'other',
]);

function isRuntimeRowObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonBlankExactString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function freezeIssues(
  issues: ReadonlyArray<ActualMappingReleaseEvidenceIssue>
): ReadonlyArray<ActualMappingReleaseEvidenceIssue> {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
}

/**
 * Strengthens the final Mapping Master release boundary without inventing mapping semantics.
 *
 * The existing mapping gate proves that the population is non-empty, row envelopes are
 * structurally traversable, statuses are supported, amounts are finite and no rows remain
 * explicitly unmapped. This diagnostic adds the minimum evidence required to treat a row
 * labelled `mapped` as verifiable Mapping Master output: exact non-blank and population-unique
 * source-row identity, exact rule/category/line-item identity plus type-safe optional
 * subcategory, accounting-treatment and debt-eligibility evidence.
 *
 * This control deliberately does not validate whether a category or accounting treatment is
 * economically correct, does not infer missing classifications, does not normalize caller
 * evidence and does not authenticate the Mapping Master itself. Those remain separate
 * governance concerns. The exact caller-owned row objects are retained by reference; only
 * the population container and emitted diagnostics are frozen.
 */
export function diagnoseActualMappingReleaseEvidence(
  rows: ReadonlyArray<MappedActualRow> | unknown
): ActualMappingReleaseEvidenceDiagnostics {
  const gate = assessActualMappingGate(rows);

  if (!Array.isArray(rows)) {
    return Object.freeze({
      releaseReady: false,
      gate,
      retainedRows: Object.freeze([]),
      issues: freezeIssues([
        {
          rowId: null,
          code: 'invalid_population_shape',
          message:
            'Actual Mapping Master release evidence must be supplied as an array; malformed retained or deserialized evidence is not coerced.',
        },
      ]),
    });
  }

  const runtimeRows = rows as ReadonlyArray<unknown>;
  const issues: ActualMappingReleaseEvidenceIssue[] = [];
  const seenRowIds = new Set<string>();

  if (!gate.releasable) {
    issues.push({
      rowId: null,
      code: 'mapping_gate_blocked',
      message:
        'Actual Mapping Master release evidence cannot become ready while the authoritative mapping release gate is blocked.',
    });
  }

  runtimeRows.forEach((row) => {
    if (!isRuntimeRowObject(row) || row.mappingStatus !== 'mapped') return;

    const rowId = typeof row.rowId === 'string' ? row.rowId : null;

    if (!isNonBlankExactString(row.rowId)) {
      issues.push({
        rowId,
        code: 'invalid_row_id',
        message:
          'A mapped Actual row requires an exact non-blank source row ID at release; malformed, blank or whitespace-normalized identities are not accepted.',
      });
    } else if (seenRowIds.has(row.rowId)) {
      issues.push({
        rowId: row.rowId,
        code: 'duplicate_row_id',
        message:
          'Mapped Actual release evidence requires one-to-one source row identity; duplicate row IDs are not accepted even when Mapping Master classifications and amounts otherwise reconcile.',
      });
    } else {
      seenRowIds.add(row.rowId);
    }

    if (!isNonBlankExactString(row.mappingRuleId)) {
      issues.push({
        rowId,
        code: 'missing_mapping_rule_id',
        message:
          'A mapped Actual row requires an exact non-blank Mapping Master rule ID; whitespace normalization is not performed at release.',
      });
    }

    if (!isNonBlankExactString(row.finmodCategory)) {
      issues.push({
        rowId,
        code: 'missing_finmod_category',
        message:
          'A mapped Actual row requires an exact non-blank FinMod category supplied by Mapping Master.',
      });
    }

    const finmodSubcategory = row.finmodSubcategory;
    if (
      finmodSubcategory !== null &&
      finmodSubcategory !== undefined &&
      !isNonBlankExactString(finmodSubcategory)
    ) {
      issues.push({
        rowId,
        code: 'invalid_finmod_subcategory',
        message:
          'FinMod subcategory may remain null/omitted, but when supplied it must be an exact non-blank Mapping Master string; release governance does not normalize it.',
      });
    }

    if (!isNonBlankExactString(row.finmodLineItem)) {
      issues.push({
        rowId,
        code: 'missing_finmod_line_item',
        message:
          'A mapped Actual row requires an exact non-blank FinMod line item supplied by Mapping Master.',
      });
    }

    const accountingTreatment = row.accountingTreatment;
    if (
      accountingTreatment !== null &&
      accountingTreatment !== undefined &&
      (typeof accountingTreatment !== 'string' ||
        !VALID_ACCOUNTING_TREATMENTS.has(accountingTreatment))
    ) {
      issues.push({
        rowId,
        code: 'invalid_accounting_treatment',
        message:
          'Accounting treatment must remain null/omitted or one of the existing governed Mapping Master treatments; no treatment is inferred.',
      });
    }

    const debtEligible = row.debtEligible;
    if (
      debtEligible !== null &&
      debtEligible !== undefined &&
      typeof debtEligible !== 'boolean'
    ) {
      issues.push({
        rowId,
        code: 'invalid_debt_eligible_evidence',
        message:
          'Debt-eligibility evidence must remain boolean, null or omitted; release governance does not infer debt eligibility.',
      });
    }
  });

  const retainedRows = Object.freeze([...(rows as ReadonlyArray<MappedActualRow>)]);
  const frozenIssues = freezeIssues(issues);

  return Object.freeze({
    releaseReady: gate.releasable && frozenIssues.length === 0,
    gate,
    retainedRows,
    issues: frozenIssues,
  });
}
