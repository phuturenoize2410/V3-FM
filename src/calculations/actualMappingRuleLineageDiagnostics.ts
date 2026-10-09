import type { ActualWorkflowResult } from './actualWorkflowEngine';
import { isValidDateEvidence } from './dateEvidenceControls';
import type { MappingRule } from './investmentLifecycleEngine';

export interface ActualMappingRuleLineageIssue {
  readonly code:
    | 'INVALID_MAPPING_RULE_POPULATION'
    | 'INVALID_RELEASED_ROW_POPULATION'
    | 'INVALID_MAPPING_RULE_SHAPE'
    | 'INVALID_RELEASED_ROW_SHAPE'
    | 'MISSING_MAPPING_RULE_ID'
    | 'INVALID_MAPPING_RULE_ID_TYPE'
    | 'DUPLICATE_MAPPING_RULE_ID'
    | 'INVALID_MAPPING_RULE_ENABLED_FLAG'
    | 'INVALID_MAPPING_RULE_PRIORITY'
    | 'INVALID_MAPPING_RULE_EFFECTIVE_FROM'
    | 'INVALID_MAPPING_RULE_EFFECTIVE_TO'
    | 'INVALID_MAPPING_RULE_EFFECTIVE_RANGE'
    | 'INVALID_MAPPING_RULE_CLASSIFICATION_TYPE'
    | 'RELEASED_ROW_WITHOUT_MAPPING_RULE_ID'
    | 'INVALID_RELEASED_ROW_MAPPING_RULE_ID_TYPE'
    | 'RELEASED_ROW_REFERENCES_UNKNOWN_RULE'
    | 'RELEASED_ROW_REFERENCES_AMBIGUOUS_RULE'
    | 'RELEASED_ROW_REFERENCES_DISABLED_RULE'
    | 'INVALID_RELEASED_ROW_POSTING_DATE'
    | 'RELEASED_ROW_OUTSIDE_RULE_EFFECTIVE_RANGE'
    | 'INVALID_RELEASED_ROW_CLASSIFICATION_TYPE'
    | 'RELEASED_ROW_CLASSIFICATION_MISMATCH';
  readonly severity: 'error';
  readonly rowId?: string;
  readonly mappingRuleId?: string;
  readonly message: string;
}

export interface ActualMappingRuleLineageDiagnostics {
  readonly passed: boolean;
  readonly releasedRows: number;
  readonly referencedRuleIds: ReadonlyArray<string>;
  readonly suppliedRuleCount: number;
  readonly issueCount: number;
  readonly issues: ReadonlyArray<ActualMappingRuleLineageIssue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedOptional(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseOptionalDate(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'string') return Number.NaN;
  const normalized = normalizedOptional(value);
  if (!normalized) return null;
  if (!isValidDateEvidence(normalized)) return Number.NaN;
  return new Date(normalized).getTime();
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidRuleClassificationTypes(rule: Record<string, unknown>): boolean {
  return (
    isNonBlankString(rule.finmodCategory) &&
    (rule.finmodSubcategory == null || typeof rule.finmodSubcategory === 'string') &&
    isNonBlankString(rule.finmodLineItem) &&
    (rule.accountingTreatment == null || typeof rule.accountingTreatment === 'string') &&
    (rule.debtEligible == null || typeof rule.debtEligible === 'boolean')
  );
}

function hasValidReleasedClassificationTypes(row: Record<string, unknown>): boolean {
  return (
    isNonBlankString(row.finmodCategory) &&
    (row.finmodSubcategory == null || typeof row.finmodSubcategory === 'string') &&
    isNonBlankString(row.finmodLineItem) &&
    (row.accountingTreatment == null || typeof row.accountingTreatment === 'string') &&
    (row.debtEligible == null || typeof row.debtEligible === 'boolean')
  );
}

/**
 * Independently verifies released Actual classification against the explicit
 * Mapping Master rule population supplied by the caller.
 *
 * This control is intentionally asset-generic and calculation-free. It does not
 * execute Mapping Master matching again and therefore cannot silently choose a
 * different rule. Instead, it proves that:
 * - retained/deserialized Mapping Master and released-Actual populations are
 *   runtime arrays before iteration;
 * - every supplied Mapping Master entry is a valid runtime object envelope before
 *   any governed field is read from serialized/reconstructed evidence;
 * - every retained released-Actual entry is a valid runtime object envelope before
 *   Mapping Master lineage fields are inspected;
 * - every supplied Mapping Master rule has a stable, runtime-string, non-blank rule id;
 * - every supplied Mapping Master rule has an explicit runtime-boolean enabled
 *   flag so serialized/reconstructed evidence cannot rely on JavaScript truthiness;
 * - every supplied Mapping Master rule has a finite numeric priority so the
 *   explicit precedence mechanism is deterministic and auditable;
 * - supplied effective-date boundaries are valid date evidence and, when both
 *   exist, effectiveFrom is not later than effectiveTo;
 * - required Mapping Master classification outputs retain non-blank string
 *   evidence, while optional classification outputs retain their declared runtime
 *   scalar types, before they may be compared to released Actual evidence;
 * - every released row retains a runtime-string Mapping Master rule id and
 *   references exactly one supplied, explicitly enabled rule id;
 * - duplicate rule ids fail closed at the row-lineage boundary instead of using
 *   an arbitrary first matching rule for downstream evidence checks;
 * - every released row retains valid posting-date evidence;
 * - each released row's posting date remains inside the referenced rule's
 *   explicit effective-date window;
 * - required released-row classification outputs retain non-blank string evidence,
 *   while optional classification outputs retain their declared runtime scalar
 *   types before reconciliation; and
 * - every released row retains the classification outputs declared by that
 *   referenced rule.
 *
 * Priority governance is deliberately limited to numeric finiteness. This
 * diagnostic does not infer whether priorities must be positive, integral or
 * contiguous because those are external Mapping Master policy decisions.
 *
 * Classification runtime checks are deliberately limited to required-field
 * completeness and declared scalar types. They do not invent allowed category,
 * line-item or accounting-treatment values, fill missing optional classification
 * fields, or reinterpret debt eligibility. Semantic classification governance
 * remains owned by the existing Mapping Master/import controls.
 *
 * Date evidence shares the same validation boundary used by controlled Actual
 * import/cutoff handling: impossible canonical YYYY-MM-DD calendar dates fail
 * closed while other currently parseable formats remain compatible until a
 * canonical external serialization contract is explicitly governed. No timezone,
 * business-day, accounting-period or commercial semantics are inferred here.
 *
 * Runtime envelope and identifier checks deliberately fail closed before property
 * access, iteration or trimming. External serialized/reconstructed evidence
 * therefore cannot crash the lineage control or acquire identity through implicit
 * JavaScript coercion when a retained population is null/primitive/object, when a
 * row/rule entry is null/primitive/array, or when a rule id or released row
 * mapping-rule id is not actually a string.
 *
 * The caller remains responsible for binding the supplied rule population to an
 * externally governed Mapping Master version/evidence record. This diagnostic
 * does not invent version ids, approve Mapping Master changes, repair rows, or
 * infer accounting/debt eligibility semantics.
 *
 * Input references are read-only contracts so lineage evaluation does not require
 * ownership of mutable workflow or Mapping Master containers. Returned rule-lineage
 * evidence is runtime-immutable so downstream controlled Actual, baseline, PIR and
 * reporting consumers cannot alter the evaluated lineage decision after this
 * diagnostic has run. Caller-owned workflow rows and Mapping Master rules are not
 * copied, mutated or deep-frozen by this control.
 */
export function diagnoseActualMappingRuleLineage(input: Readonly<{
  workflow: ActualWorkflowResult;
  mappingRules: ReadonlyArray<MappingRule>;
}>): ActualMappingRuleLineageDiagnostics {
  const issues: ActualMappingRuleLineageIssue[] = [];
  const rulesById = new Map<string, MappingRule>();
  const duplicateRuleIds = new Set<string>();
  const runtimeInput = input as unknown as {
    readonly workflow?: unknown;
    readonly mappingRules?: unknown;
  };
  const mappingRules = Array.isArray(runtimeInput.mappingRules)
    ? runtimeInput.mappingRules as ReadonlyArray<MappingRule>
    : Object.freeze([] as MappingRule[]);
  const runtimeWorkflow = isRecord(runtimeInput.workflow) ? runtimeInput.workflow : null;
  const releasedRows = runtimeWorkflow && Array.isArray(runtimeWorkflow.releasedRows)
    ? runtimeWorkflow.releasedRows as ActualWorkflowResult['releasedRows']
    : Object.freeze([] as unknown[]) as unknown as ActualWorkflowResult['releasedRows'];

  if (!Array.isArray(runtimeInput.mappingRules)) {
    issues.push({
      code: 'INVALID_MAPPING_RULE_POPULATION',
      severity: 'error',
      message: 'Retained Mapping Master rule evidence is not an array and cannot prove deterministic released-row lineage.',
    });
  }

  if (!runtimeWorkflow || !Array.isArray(runtimeWorkflow.releasedRows)) {
    issues.push({
      code: 'INVALID_RELEASED_ROW_POPULATION',
      severity: 'error',
      message: 'Retained released-Actual evidence is not an array and cannot prove deterministic Mapping Master lineage.',
    });
  }

  mappingRules.forEach((rule, index) => {
    const runtimeRule = rule as unknown;
    if (!isRecord(runtimeRule)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_SHAPE',
        severity: 'error',
        message: `Mapping Master entry at supplied index ${index} is not a valid rule object; released-row lineage cannot be verified.`,
      });
      return;
    }

    const rawId = runtimeRule.id;
    if (typeof rawId !== 'string') {
      issues.push({
        code: 'INVALID_MAPPING_RULE_ID_TYPE',
        severity: 'error',
        message: `Mapping Master rule at supplied index ${index} has non-string rule-id evidence; governed released-row lineage requires an explicit string identifier.`,
      });
      return;
    }

    const id = rawId.trim();
    if (!id) {
      issues.push({
        code: 'MISSING_MAPPING_RULE_ID',
        severity: 'error',
        message: `Mapping Master rule at supplied index ${index} has no stable rule id; governed released-row lineage cannot address this rule.`,
      });
      return;
    }

    if (rulesById.has(id)) {
      duplicateRuleIds.add(id);
      return;
    }

    rulesById.set(id, rule);

    const enabled = runtimeRule.enabled;
    if (typeof enabled !== 'boolean') {
      issues.push({
        code: 'INVALID_MAPPING_RULE_ENABLED_FLAG',
        severity: 'error',
        mappingRuleId: id,
        message: `Mapping Master rule "${id}" has non-boolean enabled evidence; released-row lineage requires an explicit runtime boolean.`,
      });
    }

    const priority = runtimeRule.priority;
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_PRIORITY',
        severity: 'error',
        mappingRuleId: id,
        message: `Mapping Master rule "${id}" has non-finite numeric priority evidence; deterministic precedence cannot be independently verified.`,
      });
    }

    if (!hasValidRuleClassificationTypes(runtimeRule)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_CLASSIFICATION_TYPE',
        severity: 'error',
        mappingRuleId: id,
        message: `Mapping Master rule "${id}" has malformed classification evidence; category/line-item must be non-blank strings, optional subcategory/accounting treatment must be strings when supplied, and debt eligibility must be boolean when supplied.`,
      });
    }

    const effectiveFrom = parseOptionalDate(runtimeRule.effectiveFrom);
    const effectiveTo = parseOptionalDate(runtimeRule.effectiveTo);

    if (Number.isNaN(effectiveFrom)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_EFFECTIVE_FROM',
        severity: 'error',
        mappingRuleId: id,
        message: `Mapping Master rule "${id}" has invalid effectiveFrom evidence.`,
      });
    }

    if (Number.isNaN(effectiveTo)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_EFFECTIVE_TO',
        severity: 'error',
        mappingRuleId: id,
        message: `Mapping Master rule "${id}" has invalid effectiveTo evidence.`,
      });
    }

    if (
      effectiveFrom !== null &&
      effectiveTo !== null &&
      Number.isFinite(effectiveFrom) &&
      Number.isFinite(effectiveTo) &&
      effectiveFrom > effectiveTo
    ) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_EFFECTIVE_RANGE',
        severity: 'error',
        mappingRuleId: id,
        message: `Mapping Master rule "${id}" has effectiveFrom later than effectiveTo.`,
      });
    }
  });

  for (const mappingRuleId of [...duplicateRuleIds].sort()) {
    issues.push({
      code: 'DUPLICATE_MAPPING_RULE_ID',
      severity: 'error',
      mappingRuleId,
      message: `Mapping Master contains duplicate rule id "${mappingRuleId}"; released-row lineage is ambiguous.`,
    });
  }

  const referencedRuleIds = new Set<string>();

  releasedRows.forEach((row, index) => {
    const runtimeRow = row as unknown;
    if (!isRecord(runtimeRow)) {
      issues.push({
        code: 'INVALID_RELEASED_ROW_SHAPE',
        severity: 'error',
        rowId: '(invalid)',
        message: `Released Actual entry at retained index ${index} is not a valid row object; Mapping Master lineage cannot be verified.`,
      });
      return;
    }

    const rowId = normalizedOptional(runtimeRow.rowId) ?? '(invalid)';
    const rawMappingRuleId = runtimeRow.mappingRuleId;
    if (rawMappingRuleId != null && typeof rawMappingRuleId !== 'string') {
      issues.push({
        code: 'INVALID_RELEASED_ROW_MAPPING_RULE_ID_TYPE',
        severity: 'error',
        rowId,
        message: `Released Actual row "${rowId}" has non-string Mapping Master rule-id evidence; governed lineage requires an explicit string identifier.`,
      });
      return;
    }

    const mappingRuleId = normalizedOptional(rawMappingRuleId);

    if (!mappingRuleId) {
      issues.push({
        code: 'RELEASED_ROW_WITHOUT_MAPPING_RULE_ID',
        severity: 'error',
        rowId,
        message: `Released Actual row "${rowId}" has no Mapping Master rule id.`,
      });
      return;
    }

    referencedRuleIds.add(mappingRuleId);

    if (duplicateRuleIds.has(mappingRuleId)) {
      issues.push({
        code: 'RELEASED_ROW_REFERENCES_AMBIGUOUS_RULE',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" references duplicated Mapping Master rule id "${mappingRuleId}"; no single governed rule can be selected for lineage verification.`,
      });
      return;
    }

    const rule = rulesById.get(mappingRuleId);

    if (!rule) {
      issues.push({
        code: 'RELEASED_ROW_REFERENCES_UNKNOWN_RULE',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" references Mapping Master rule "${mappingRuleId}" that is absent from the supplied rule population.`,
      });
      return;
    }

    if ((rule as { enabled?: unknown }).enabled !== true) {
      issues.push({
        code: 'RELEASED_ROW_REFERENCES_DISABLED_RULE',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" references Mapping Master rule "${mappingRuleId}" that is not explicitly enabled with boolean true.`,
      });
    }

    const postingDate = parseOptionalDate(runtimeRow.postingDate);
    if (postingDate === null || !Number.isFinite(postingDate)) {
      issues.push({
        code: 'INVALID_RELEASED_ROW_POSTING_DATE',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" has invalid posting-date evidence; Mapping Master effective-date lineage cannot be independently verified.`,
      });
    }

    const effectiveFrom = parseOptionalDate((rule as { effectiveFrom?: unknown }).effectiveFrom);
    const effectiveTo = parseOptionalDate((rule as { effectiveTo?: unknown }).effectiveTo);
    if (
      postingDate !== null &&
      Number.isFinite(postingDate) &&
      ((effectiveFrom !== null && Number.isFinite(effectiveFrom) && postingDate < effectiveFrom) ||
        (effectiveTo !== null && Number.isFinite(effectiveTo) && postingDate > effectiveTo))
    ) {
      issues.push({
        code: 'RELEASED_ROW_OUTSIDE_RULE_EFFECTIVE_RANGE',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" posting date "${String(runtimeRow.postingDate)}" falls outside Mapping Master rule "${mappingRuleId}" effective-date window.`,
      });
    }

    if (!hasValidReleasedClassificationTypes(runtimeRow)) {
      issues.push({
        code: 'INVALID_RELEASED_ROW_CLASSIFICATION_TYPE',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" has malformed classification evidence; category/line-item must be non-blank strings, optional subcategory/accounting treatment must be strings when supplied, and debt eligibility must be boolean when supplied.`,
      });
    }

    const rowClassification = {
      finmodCategory: normalizedOptional(runtimeRow.finmodCategory),
      finmodSubcategory: normalizedOptional(runtimeRow.finmodSubcategory),
      finmodLineItem: normalizedOptional(runtimeRow.finmodLineItem),
      accountingTreatment: runtimeRow.accountingTreatment ?? null,
      debtEligible: runtimeRow.debtEligible ?? null,
    };
    const ruleClassification = {
      finmodCategory: normalizedOptional(rule.finmodCategory),
      finmodSubcategory: normalizedOptional(rule.finmodSubcategory),
      finmodLineItem: normalizedOptional(rule.finmodLineItem),
      accountingTreatment: rule.accountingTreatment ?? null,
      debtEligible: rule.debtEligible ?? null,
    };

    if (
      rowClassification.finmodCategory !== ruleClassification.finmodCategory ||
      rowClassification.finmodSubcategory !== ruleClassification.finmodSubcategory ||
      rowClassification.finmodLineItem !== ruleClassification.finmodLineItem ||
      rowClassification.accountingTreatment !== ruleClassification.accountingTreatment ||
      rowClassification.debtEligible !== ruleClassification.debtEligible
    ) {
      issues.push({
        code: 'RELEASED_ROW_CLASSIFICATION_MISMATCH',
        severity: 'error',
        rowId,
        mappingRuleId,
        message: `Released Actual row "${rowId}" classification does not match Mapping Master rule "${mappingRuleId}".`,
      });
    }
  });

  const frozenReferencedRuleIds: ReadonlyArray<string> = Object.freeze([...referencedRuleIds].sort());
  const frozenIssues: ReadonlyArray<ActualMappingRuleLineageIssue> = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed: issues.length === 0,
    releasedRows: releasedRows.length,
    referencedRuleIds: frozenReferencedRuleIds,
    suppliedRuleCount: mappingRules.length,
    issueCount: issues.length,
    issues: frozenIssues,
  });
}
