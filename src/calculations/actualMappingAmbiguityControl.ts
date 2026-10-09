import { isValidDateEvidence } from './dateEvidenceControls';
import type { ActualSourceRow, MappingRule } from './investmentLifecycleEngine';

export interface ActualMappingAmbiguity {
  readonly rowId: string;
  readonly priority: number;
  readonly competingRuleIds: ReadonlyArray<string>;
}

export interface ActualMappingAmbiguityControlResult {
  readonly releasable: boolean;
  readonly ambiguousRows: number;
  readonly ambiguities: ReadonlyArray<ActualMappingAmbiguity>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalize(value?: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function dateInRange(dateStr: string, from?: string, to?: string): boolean {
  if (!isValidDateEvidence(dateStr)) return false;
  const value = new Date(dateStr).getTime();

  if (from) {
    if (!isValidDateEvidence(from)) return false;
    const fromTime = new Date(from).getTime();
    if (value < fromTime) return false;
  }

  if (to) {
    if (!isValidDateEvidence(to)) return false;
    const toTime = new Date(to).getTime();
    if (value > toTime) return false;
  }

  return true;
}

const GOVERNED_LIFECYCLE_PHASES = new Set([
  'development',
  'financial_close',
  'construction',
  'cod',
  'operations',
  'ppa_expiry',
]);

const MAPPING_RULE_STRING_MATCH_DIMENSIONS = [
  'company',
  'projectId',
  'glAccount',
  'costCenter',
  'wbsPrefix',
  'costCodePrefix',
  'contractId',
] as const;

function hasExecutableAmbiguityEvidence(rule: unknown): rule is MappingRule {
  if (!isRecord(rule)) return false;
  if (typeof rule.id !== 'string' || !rule.id.trim()) return false;
  if (rule.enabled !== true) return false;
  if (typeof rule.priority !== 'number' || !Number.isFinite(rule.priority)) return false;

  for (const key of MAPPING_RULE_STRING_MATCH_DIMENSIONS) {
    const value = rule[key];
    if (value !== undefined && typeof value !== 'string') return false;
  }

  const phase = rule.phase;
  if (phase !== undefined && (typeof phase !== 'string' || !GOVERNED_LIFECYCLE_PHASES.has(phase))) {
    return false;
  }

  const rawFrom = rule.effectiveFrom;
  const rawTo = rule.effectiveTo;
  if (rawFrom !== undefined && typeof rawFrom !== 'string') return false;
  if (rawTo !== undefined && typeof rawTo !== 'string') return false;

  const from = typeof rawFrom === 'string' ? rawFrom.trim() : '';
  const to = typeof rawTo === 'string' ? rawTo.trim() : '';
  if (from && !isValidDateEvidence(from)) return false;
  if (to && !isValidDateEvidence(to)) return false;
  if (from && to && new Date(from).getTime() > new Date(to).getTime()) return false;

  return true;
}

/**
 * Mirrors the current Mapping Master match dimensions without selecting a rule.
 * This control exists so equal-priority overlaps are surfaced before
 * mapActualRows() applies its deterministic array-order tie break.
 *
 * Runtime-deserialized optional dimension evidence is validated defensively before
 * ambiguity evaluation. Optional textual criteria must remain strings when supplied,
 * and lifecycle phase must use one of the existing governed LifecyclePhase values.
 * Malformed/non-executable Mapping Master evidence therefore cannot enter ambiguity
 * arithmetic, throw in legacy string normalization, or become an accidental match.
 * A participating rule must also have a stable string identity, explicit enabled=true
 * state, finite numeric priority and structurally valid effective date evidence/range.
 * The upstream Mapping Master population control remains responsible for retaining the
 * explicit release-blocking reason for invalid rules, so excluding them here cannot make
 * the authoritative workflow releasable.
 *
 * Date eligibility uses the same governed date-evidence boundary as controlled
 * Actual import and Mapping Master lineage diagnostics. Impossible canonical
 * YYYY-MM-DD calendar dates therefore cannot participate in ambiguity evidence,
 * while other currently parseable formats remain compatible until a canonical
 * external serialization contract is explicitly governed. No timezone,
 * business-day, accounting-period or commercial semantics are inferred here.
 */
function matchesRule(row: ActualSourceRow, rule: MappingRule): boolean {
  if (!hasExecutableAmbiguityEvidence(rule)) return false;

  const effectiveFrom = typeof rule.effectiveFrom === 'string' ? rule.effectiveFrom : undefined;
  const effectiveTo = typeof rule.effectiveTo === 'string' ? rule.effectiveTo : undefined;
  if (!dateInRange(row.postingDate, effectiveFrom, effectiveTo)) return false;
  if (rule.company && normalize(row.company) !== normalize(rule.company)) return false;
  if (rule.projectId && normalize(row.projectId) !== normalize(rule.projectId)) return false;
  if (rule.phase && row.phase !== rule.phase) return false;
  if (rule.glAccount && normalize(row.glAccount) !== normalize(rule.glAccount)) return false;
  if (rule.costCenter && normalize(row.costCenter) !== normalize(rule.costCenter)) return false;
  if (rule.contractId && normalize(row.contractId) !== normalize(rule.contractId)) return false;
  if (rule.wbsPrefix && !normalize(row.wbsCode).startsWith(normalize(rule.wbsPrefix))) return false;
  if (rule.costCodePrefix && !normalize(row.costCode).startsWith(normalize(rule.costCodePrefix))) return false;
  return true;
}

/**
 * Blocks lifecycle/PIR release when an imported row matches more than one
 * enabled Mapping Master rule at the same highest priority.
 *
 * Lower-priority matches are not ambiguous because priority is the explicit
 * precedence mechanism. Equal-priority matches are not resolved by array order:
 * that ordering is an implementation detail and is not sufficient governance
 * evidence for a verified Actual population.
 *
 * The function does not mutate rows, mapping rules or commercial/accounting
 * classifications. It only reports the overlap so Mapping Master owners can
 * remediate the rules explicitly.
 *
 * Input populations are read-only contracts so ambiguity evaluation does not
 * require ownership of mutable source-row or Mapping Master containers. Returned
 * ambiguity evidence is runtime-immutable so downstream workflow, baseline and
 * PIR consumers cannot alter the evaluated Mapping Master overlap decision after
 * the control has run. Caller-owned rows and mapping rules are not copied, mutated
 * or deep-frozen by this diagnostic. The exported contract mirrors that runtime
 * immutability so consumers cannot treat governed evidence as mutable at compile
 * time either.
 */
export function assessActualMappingAmbiguity(
  rows: ReadonlyArray<ActualSourceRow>,
  rules: ReadonlyArray<MappingRule>
): ActualMappingAmbiguityControlResult {
  const ambiguities: ActualMappingAmbiguity[] = [];

  for (const row of rows) {
    const matches = rules.filter((rule) => matchesRule(row, rule));
    if (matches.length <= 1) continue;

    const highestPriority = Math.max(...matches.map((rule) => rule.priority));
    const topMatches = matches.filter((rule) => rule.priority === highestPriority);
    if (topMatches.length <= 1) continue;

    ambiguities.push({
      rowId: row.rowId,
      priority: highestPriority,
      competingRuleIds: topMatches.map((rule) => rule.id).sort(),
    });
  }

  const blockingReasons = ambiguities.map(
    (item) =>
      `Source row ${item.rowId} matches ${item.competingRuleIds.length} Mapping Master rules at equal highest priority ${item.priority}: ${item.competingRuleIds.join(', ')}.`
  );

  const frozenAmbiguities: ReadonlyArray<ActualMappingAmbiguity> = Object.freeze(
    ambiguities.map((item) =>
      Object.freeze({
        ...item,
        competingRuleIds: Object.freeze([...item.competingRuleIds]),
      })
    )
  );

  return Object.freeze({
    releasable: ambiguities.length === 0,
    ambiguousRows: ambiguities.length,
    ambiguities: frozenAmbiguities,
    blockingReasons: Object.freeze([...blockingReasons]),
  });
}
