import { isValidDateEvidence } from './dateEvidenceControls';
import {
  mapActualRows,
  type ActualSourceRow,
  type MappedActualRow,
  type MappingRule,
} from './investmentLifecycleEngine';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasGovernedOptionalDate(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return !normalized || isValidDateEvidence(normalized);
}

function hasGovernedEffectiveRange(effectiveFrom: unknown, effectiveTo: unknown): boolean {
  if (!hasGovernedOptionalDate(effectiveFrom) || !hasGovernedOptionalDate(effectiveTo)) {
    return false;
  }

  const normalizedFrom = typeof effectiveFrom === 'string' ? effectiveFrom.trim() : '';
  const normalizedTo = typeof effectiveTo === 'string' ? effectiveTo.trim() : '';

  if (!normalizedFrom || !normalizedTo) return true;

  return new Date(normalizedFrom).getTime() <= new Date(normalizedTo).getTime();
}

const GOVERNED_LIFECYCLE_PHASES = new Set([
  'development',
  'financial_close',
  'construction',
  'cod',
  'operations',
  'ppa_expiry',
]);

const GOVERNED_ACCOUNTING_TREATMENTS = new Set([
  'capitalized',
  'expensed',
  'working_capital',
  'financing',
  'other',
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

function hasGovernedActualMappingDimensions(row: unknown): row is ActualSourceRow {
  if (!isRecord(row)) return false;

  for (const key of ACTUAL_MAPPING_STRING_DIMENSIONS) {
    const value = row[key];
    if (value !== undefined && typeof value !== 'string') return false;
  }

  const phase = row.phase;
  if (phase !== undefined && (typeof phase !== 'string' || !GOVERNED_LIFECYCLE_PHASES.has(phase))) {
    return false;
  }

  return true;
}

function toFailClosedUnmappedRow(row: ActualSourceRow): MappedActualRow {
  return {
    ...row,
    mappingRuleId: null,
    finmodCategory: null,
    finmodSubcategory: null,
    finmodLineItem: null,
    accountingTreatment: null,
    debtEligible: null,
    mappingStatus: 'unmapped',
  };
}

function hasGovernedOptionalMatchDimensions(rule: Record<string, unknown>): boolean {
  const optionalStringDimensions = [
    'company',
    'projectId',
    'glAccount',
    'costCenter',
    'wbsPrefix',
    'costCodePrefix',
    'contractId',
  ] as const;

  for (const key of optionalStringDimensions) {
    const value = rule[key];
    if (value !== undefined && typeof value !== 'string') return false;
  }

  const phase = rule.phase;
  if (phase !== undefined && (typeof phase !== 'string' || !GOVERNED_LIFECYCLE_PHASES.has(phase))) {
    return false;
  }

  return true;
}

function hasGovernedClassificationOutputs(rule: Record<string, unknown>): boolean {
  const category = rule.finmodCategory;
  if (typeof category !== 'string' || !category.trim()) return false;

  const lineItem = rule.finmodLineItem;
  if (typeof lineItem !== 'string' || !lineItem.trim()) return false;

  const subcategory = rule.finmodSubcategory;
  if (subcategory !== undefined && typeof subcategory !== 'string') return false;

  const accountingTreatment = rule.accountingTreatment;
  if (
    accountingTreatment !== undefined &&
    (typeof accountingTreatment !== 'string' ||
      !GOVERNED_ACCOUNTING_TREATMENTS.has(accountingTreatment))
  ) {
    return false;
  }

  const debtEligible = rule.debtEligible;
  if (debtEligible !== undefined && typeof debtEligible !== 'boolean') return false;

  return true;
}

function isExecutableGovernedRule(rule: unknown): rule is MappingRule {
  if (!isRecord(rule)) return false;

  const ruleId = typeof rule.id === 'string' ? rule.id.trim() : '';
  if (!ruleId) return false;
  if (typeof rule.enabled !== 'boolean') return false;
  if (typeof rule.priority !== 'number' || !Number.isFinite(rule.priority)) return false;
  if (!hasGovernedOptionalMatchDimensions(rule)) return false;
  if (!hasGovernedClassificationOutputs(rule)) return false;

  return hasGovernedEffectiveRange(rule.effectiveFrom, rule.effectiveTo);
}

/**
 * Compatibility boundary for the legacy Mapping Master helper.
 *
 * Controlled Actual governance owns read-only source and Mapping Master populations.
 * The underlying legacy helper still declares mutable array inputs even though its
 * implementation only reads those containers and creates derived mapped rows.
 *
 * Keep the compatibility copy isolated here so authoritative workflow code does not
 * need to manufacture mutable aliases. Row/rule object identity is preserved; only
 * the array containers are copied.
 *
 * Controlled Actual additionally fails closed at this boundary for Mapping Master
 * rules whose runtime envelope, stable identity, explicit activation state,
 * deterministic priority, optional match-dimension evidence, classification outputs,
 * explicit effective-date evidence, or effective-date range is invalid. The legacy
 * mapper assumes rule-shaped objects and copies classification outputs directly into
 * mapped Actual rows while also performing truthiness, string normalization, numeric
 * sorting and native Date comparison internally; malformed runtime evidence could
 * otherwise throw, be interpreted using JavaScript coercion, or surface malformed
 * classification evidence before the workflow-level governance gate blocks release.
 * Invalid rules are therefore excluded here rather than coerced or executed.
 *
 * Accepted imported rows are also checked at this compatibility boundary for the
 * optional dimensions consumed by the legacy matcher. A deserialized row carrying a
 * non-string company/project/GL/cost-center/WBS/cost-code/contract dimension, or an
 * unsupported lifecycle phase, is emitted as explicitly unmapped rather than passed to
 * string normalization where it could throw or be coerced. This does not repair the
 * source row or assign a classification: the normal mapping gate will fail closed on
 * that unmapped row. Import validation remains the authoritative place to expand source
 * evidence diagnostics; this guard only prevents the legacy matcher from becoming a
 * runtime bypass while that contract is progressively hardened.
 *
 * Optional textual match dimensions remain optional and retain their existing matching
 * semantics when they are valid strings. Lifecycle phase, when supplied, must be one of
 * the existing governed LifecyclePhase values already declared by the finance core.
 * Required FinMod category and line-item outputs must remain non-blank strings; optional
 * subcategory, accounting-treatment and debt-eligibility outputs must preserve the
 * existing MappingRule contract when supplied. This adds no new phase or classification
 * meaning; it only prevents deserialized malformed evidence from entering the legacy
 * mapper. The upstream Mapping Master population control remains responsible for release
 * authority, so exclusion here cannot by itself make malformed evidence authoritative.
 *
 * Excluding an invalid rule from controlled mapping keeps the authoritative path
 * aligned with governed evidence semantics: valid rule identity is explicit, enabled
 * is a real boolean, priority is finite, classification outputs preserve their existing
 * governed runtime types, omitted date boundaries remain open-ended, supplied date
 * boundaries must be valid string evidence when non-blank, and a bounded effectiveFrom
 * cannot be later than effectiveTo. Invalid rules are not repaired, normalized into a
 * different value, or assigned replacement economics; affected rows remain unmapped and
 * therefore cannot become releasable through the normal mapping gate.
 *
 * This adapter does not alter rule priority, valid classifications, amounts or any
 * commercial terms. The legacy helper remains untouched for compatibility outside the
 * controlled workflow until its broader callers can be migrated safely.
 */
export function mapActualRowsFromReadonlyEvidence(
  rows: ReadonlyArray<ActualSourceRow>,
  rules: ReadonlyArray<MappingRule>,
  cutoffDate?: string
): MappedActualRow[] {
  const governedRules = rules.filter(isExecutableGovernedRule);
  const governedRows = rows.filter(hasGovernedActualMappingDimensions);
  const invalidRows = rows.filter((row) => !hasGovernedActualMappingDimensions(row));
  const mappedRows = mapActualRows([...governedRows], [...governedRules], cutoffDate);

  return [...mappedRows, ...invalidRows.map(toFailClosedUnmappedRow)];
}
