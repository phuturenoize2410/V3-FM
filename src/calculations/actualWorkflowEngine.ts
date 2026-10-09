import {
  assessActualMappingGate,
  validateActualImport,
  type ActualImportValidationResult,
  type ActualMappingGateResult,
} from './actualImportControls';
import {
  assessActualMappingAmbiguity,
  type ActualMappingAmbiguityControlResult,
} from './actualMappingAmbiguityControl';
import { mapActualRowsFromReadonlyEvidence } from './actualMappingReadonlyAdapter';
import { isValidDateEvidence } from './dateEvidenceControls';
import {
  summarizeMapping,
  type ActualSourceRow,
  type MappedActualRow,
  type MappingControlSummary,
  type MappingRule,
} from './investmentLifecycleEngine';

export interface ActualWorkflowInput {
  readonly rows: ReadonlyArray<ActualSourceRow>;
  readonly mappingRules: ReadonlyArray<MappingRule>;
  readonly cutoffDate: string;
}

export interface ActualCutoffControl {
  readonly suppliedCutoffDate: string;
  readonly valid: boolean;
  readonly evaluated: boolean;
  readonly rejectedAfterCutoffRows: number;
}

export interface MappingRulePopulationControl {
  readonly passed: boolean;
  readonly suppliedRuleCount: number;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ActualWorkflowResult {
  readonly cutoffDate: string;
  readonly cutoffControl: ActualCutoffControl;
  readonly validation: ActualImportValidationResult;
  readonly mappedRows: ReadonlyArray<MappedActualRow>;
  readonly mappingSummary: Readonly<MappingControlSummary>;
  readonly mappingRulePopulationControl: MappingRulePopulationControl;
  readonly mappingGate: ActualMappingGateResult;
  readonly mappingAmbiguityControl: ActualMappingAmbiguityControlResult;
  readonly releasableToLifecycle: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly releasedRows: ReadonlyArray<MappedActualRow>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidExplicitCutoff(value: string): boolean {
  return isValidDateEvidence(value);
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

const MAPPING_RULE_STRING_MATCH_DIMENSIONS = [
  'company',
  'projectId',
  'glAccount',
  'costCenter',
  'wbsPrefix',
  'costCodePrefix',
  'contractId',
] as const;

function assessMappingRulePopulation(
  rules: ReadonlyArray<MappingRule>
): MappingRulePopulationControl {
  const blockingReasons: string[] = [];
  const seenRuleIds = new Set<string>();
  const duplicateRuleIds = new Set<string>();

  rules.forEach((rule, index) => {
    if (!isRecord(rule)) {
      blockingReasons.push(
        `Mapping Master rule at supplied index ${index} must be a non-array object before lifecycle/PIR release.`
      );
      return;
    }

    const rawRuleId = rule.id;
    const ruleId = typeof rawRuleId === 'string' ? rawRuleId.trim() : '';
    const ruleLabel = ruleId || `(rule at supplied index ${index})`;

    if (typeof rawRuleId !== 'string') {
      blockingReasons.push(
        `Mapping Master rule at supplied index ${index} requires string rule-id evidence before lifecycle/PIR release.`
      );
    } else if (!ruleId) {
      blockingReasons.push(
        `Mapping Master rule at supplied index ${index} requires a stable non-blank rule id before lifecycle/PIR release.`
      );
    } else if (seenRuleIds.has(ruleId)) {
      duplicateRuleIds.add(ruleId);
    } else {
      seenRuleIds.add(ruleId);
    }

    const enabled = rule.enabled;
    if (typeof enabled !== 'boolean') {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires an explicit boolean enabled flag before lifecycle/PIR release.`
      );
    }

    const priority = rule.priority;
    if (typeof priority !== 'number' || !Number.isFinite(priority)) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} has a non-finite priority and cannot provide deterministic precedence evidence.`
      );
    }

    for (const key of MAPPING_RULE_STRING_MATCH_DIMENSIONS) {
      const value = rule[key];
      if (value !== undefined && typeof value !== 'string') {
        blockingReasons.push(
          `Mapping Master rule ${ruleLabel} requires string ${key} match-dimension evidence when supplied.`
        );
      }
    }

    const phase = rule.phase as unknown;
    if (
      phase !== undefined &&
      (typeof phase !== 'string' || !GOVERNED_LIFECYCLE_PHASES.has(phase))
    ) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} has invalid lifecycle phase match evidence; supplied phase must use an existing governed LifecyclePhase value.`
      );
    }

    const rawCategory = rule.finmodCategory as unknown;
    if (typeof rawCategory !== 'string' || !rawCategory.trim()) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires a non-blank string finmodCategory classification before lifecycle/PIR release.`
      );
    }

    const rawLineItem = rule.finmodLineItem as unknown;
    if (typeof rawLineItem !== 'string' || !rawLineItem.trim()) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires a non-blank string finmodLineItem classification before lifecycle/PIR release.`
      );
    }

    const rawSubcategory = rule.finmodSubcategory as unknown;
    if (rawSubcategory !== undefined && typeof rawSubcategory !== 'string') {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires string finmodSubcategory classification evidence when supplied.`
      );
    }

    const rawAccountingTreatment = rule.accountingTreatment as unknown;
    if (
      rawAccountingTreatment !== undefined &&
      (typeof rawAccountingTreatment !== 'string' ||
        !GOVERNED_ACCOUNTING_TREATMENTS.has(rawAccountingTreatment))
    ) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} has invalid accountingTreatment classification evidence; supplied treatment must use an existing governed MappingRule value.`
      );
    }

    const rawDebtEligible = rule.debtEligible as unknown;
    if (rawDebtEligible !== undefined && typeof rawDebtEligible !== 'boolean') {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires boolean debtEligible classification evidence when supplied.`
      );
    }

    const rawEffectiveFrom = rule.effectiveFrom;
    const rawEffectiveTo = rule.effectiveTo;
    const effectiveFromTypeValid =
      rawEffectiveFrom === undefined || typeof rawEffectiveFrom === 'string';
    const effectiveToTypeValid = rawEffectiveTo === undefined || typeof rawEffectiveTo === 'string';
    const effectiveFrom =
      typeof rawEffectiveFrom === 'string' ? rawEffectiveFrom.trim() : '';
    const effectiveTo = typeof rawEffectiveTo === 'string' ? rawEffectiveTo.trim() : '';
    const effectiveFromValid =
      effectiveFromTypeValid && (!effectiveFrom || isValidDateEvidence(effectiveFrom));
    const effectiveToValid =
      effectiveToTypeValid && (!effectiveTo || isValidDateEvidence(effectiveTo));

    if (!effectiveFromTypeValid) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires string effectiveFrom evidence when supplied.`
      );
    } else if (!effectiveFromValid) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} has invalid effectiveFrom evidence "${effectiveFrom}".`
      );
    }

    if (!effectiveToTypeValid) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} requires string effectiveTo evidence when supplied.`
      );
    } else if (!effectiveToValid) {
      blockingReasons.push(
        `Mapping Master rule ${ruleLabel} has invalid effectiveTo evidence "${effectiveTo}".`
      );
    }

    if (effectiveFrom && effectiveTo && effectiveFromValid && effectiveToValid) {
      const fromTime = new Date(effectiveFrom).getTime();
      const toTime = new Date(effectiveTo).getTime();
      if (fromTime > toTime) {
        blockingReasons.push(
          `Mapping Master rule ${ruleLabel} has effectiveFrom later than effectiveTo.`
        );
      }
    }
  });

  [...duplicateRuleIds].sort().forEach((ruleId) => {
    blockingReasons.push(
      `Mapping Master population contains duplicate rule id "${ruleId}"; rule identity is ambiguous.`
    );
  });

  const frozenBlockingReasons = Object.freeze([...blockingReasons]);
  return Object.freeze({
    passed: frozenBlockingReasons.length === 0,
    suppliedRuleCount: rules.length,
    blockingReasons: frozenBlockingReasons,
  });
}

/**
 * Controlled Actual-data workflow from source population to lifecycle/PIR release.
 *
 * Control principles:
 * - An explicit, valid cutoff is required before a population can be released.
 * - Cutoff validity/evaluation is retained as explicit workflow evidence rather than
 *   inferred later from released rows or a loose date string.
 * - The supplied cutoff is passed through to import validation unchanged so invalid
 *   cutoff evidence fails closed before Mapping Master instead of being treated as omitted.
 * - Workflow and import validation use the same date-evidence control so an impossible
 *   canonical calendar date cannot receive conflicting cutoff verdicts across layers.
 * - Validation always runs before Mapping Master.
 * - Rejected source rows are never passed into mapping.
 * - Mapping only sees rows accepted at the explicit cutoff.
 * - Mapping Master rule envelopes, identity, explicit boolean activation state,
 *   precedence, optional match dimensions, classification outputs and explicit
 *   effective-date evidence must be structurally valid before the workflow can release
 *   rows downstream. Runtime-deserialized malformed envelopes, match/date evidence or
 *   classification values fail closed instead of being coerced or allowed to throw.
 *   Required FinMod category/line-item outputs must be non-blank strings; optional
 *   subcategory, accounting-treatment and debt-eligibility evidence must preserve the
 *   existing governed MappingRule contract when supplied. Lifecycle phase, when supplied,
 *   must use an existing core phase; this control does not invent new lifecycle semantics.
 *   This is an independent fail-closed boundary; snapshot/version authority remains governed
 *   by the controlled workflow bundle and is not inferred here.
 * - Mapping Master structural validation is retained as its own immutable workflow
 *   control so downstream audit/reporting consumers do not need to reverse-engineer
 *   rule-population failures from the aggregate release blocking-reason list.
 * - Any unmapped row blocks lifecycle/PIR release.
 * - Equal-highest-priority Mapping Master overlaps block release rather than
 *   allowing array order to decide a verified classification silently.
 * - Any import rejection blocks release of the population as a verified Actual set.
 * - Released rows are therefore source-valid, unambiguous and mapped; nothing is inferred.
 *
 * The workflow input contract is read-only: the engine does not require ownership of
 * mutable source-row or Mapping Master containers in order to validate and classify
 * Actual evidence. The returned workflow envelope and its workflow-owned population
 * containers are runtime-immutable. Caller/source row objects are not deep-frozen:
 * validation retains their existing provenance identity, while mapped rows remain the
 * derived row objects created by the Mapping Master helper. Legacy mutable-container
 * compatibility is isolated behind mapActualRowsFromReadonlyEvidence(); authoritative
 * workflow code does not manufacture parallel mutable aliases of controlled evidence.
 */
export function runActualWorkflow(input: ActualWorkflowInput): ActualWorkflowResult {
  const cutoffValid = isValidExplicitCutoff(input.cutoffDate);
  const validation = validateActualImport(input.rows, input.cutoffDate);
  const rejectedAfterCutoffRows = validation.issues.filter(
    (issue) => issue.code === 'after_cutoff'
  ).length;
  const cutoffControl: ActualCutoffControl = Object.freeze({
    suppliedCutoffDate: input.cutoffDate,
    valid: cutoffValid,
    evaluated: cutoffValid,
    rejectedAfterCutoffRows,
  });

  const mappingRulePopulationControl = assessMappingRulePopulation(input.mappingRules);
  const mappingAmbiguityControl = assessActualMappingAmbiguity(
    validation.acceptedRows,
    input.mappingRules
  );
  const mappedRows = mapActualRowsFromReadonlyEvidence(
    validation.acceptedRows,
    input.mappingRules,
    cutoffValid ? input.cutoffDate : undefined
  );
  const mappingSummary = summarizeMapping(mappedRows);
  const mappingGate = assessActualMappingGate(mappedRows);
  const blockingReasons: string[] = [];

  if (!cutoffValid) {
    blockingReasons.push(
      'Actual workflow requires an explicit valid cutoff date before lifecycle/PIR release.'
    );
  }

  if (!validation.control.amountReconciles) {
    blockingReasons.push('Actual import population does not reconcile after validation.');
  }

  if (validation.control.rejectedRows > 0) {
    blockingReasons.push(
      `${validation.control.rejectedRows} source row(s) failed import validation and require remediation.`
    );
  }

  blockingReasons.push(...mappingRulePopulationControl.blockingReasons);
  blockingReasons.push(...mappingAmbiguityControl.blockingReasons);
  blockingReasons.push(...mappingGate.blockingReasons);

  const releasableToLifecycle = blockingReasons.length === 0;
  const frozenMappedRows: ReadonlyArray<MappedActualRow> = Object.freeze([...mappedRows]);
  const frozenBlockingReasons: ReadonlyArray<string> = Object.freeze([...blockingReasons]);
  const releasedRows: ReadonlyArray<MappedActualRow> = releasableToLifecycle
    ? frozenMappedRows
    : Object.freeze([] as MappedActualRow[]);

  return Object.freeze({
    cutoffDate: input.cutoffDate,
    cutoffControl,
    validation,
    mappedRows: frozenMappedRows,
    mappingSummary: Object.freeze({ ...mappingSummary }),
    mappingRulePopulationControl,
    mappingGate,
    mappingAmbiguityControl,
    releasableToLifecycle,
    blockingReasons: frozenBlockingReasons,
    releasedRows,
  });
}
