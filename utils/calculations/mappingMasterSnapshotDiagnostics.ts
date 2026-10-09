import type { MappingRule } from './investmentLifecycleEngine';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface MappingMasterSnapshotDescriptor {
  readonly version: string;
  readonly ruleSignatures: ReadonlyArray<string>;
}

export interface MappingMasterSnapshotIssue {
  readonly code:
    | 'MISSING_SNAPSHOT_VERSION'
    | 'MISSING_SNAPSHOT_RULE_SIGNATURE'
    | 'MISSING_MAPPING_RULE_ID'
    | 'DUPLICATE_MAPPING_RULE_ID'
    | 'INVALID_MAPPING_RULE_PRIORITY'
    | 'INVALID_MAPPING_RULE_EFFECTIVE_FROM'
    | 'INVALID_MAPPING_RULE_EFFECTIVE_TO'
    | 'INVALID_MAPPING_RULE_EFFECTIVE_RANGE'
    | 'DUPLICATE_SNAPSHOT_RULE_SIGNATURE'
    | 'RULE_POPULATION_MISMATCH';
  readonly message: string;
}

export interface MappingMasterSnapshotDiagnostics {
  readonly passed: boolean;
  readonly issues: ReadonlyArray<MappingMasterSnapshotIssue>;
  readonly snapshotVersion: string;
  readonly expectedRuleCount: number;
  readonly suppliedRuleCount: number;
}

function normalized(value?: string): string {
  return (value ?? '').trim();
}

function canonicalPriority(value: number): number | string {
  if (Number.isFinite(value)) return value;
  if (Number.isNaN(value)) return 'NON_FINITE:NaN';
  return value === Number.POSITIVE_INFINITY
    ? 'NON_FINITE:+Infinity'
    : 'NON_FINITE:-Infinity';
}

function parseOptionalDate(value?: string | null): number | null {
  const normalizedValue = normalized(value ?? undefined);
  if (!normalizedValue) return null;
  if (!isValidDateEvidence(normalizedValue)) return Number.NaN;
  return new Date(normalizedValue).getTime();
}

/**
 * Returns a deterministic structural signature for one Mapping Master rule.
 *
 * This is deliberately a canonical identity string, not a cryptographic hash.
 * It contains only explicit MappingRule fields and performs no classification,
 * inference or economics. Callers may persist these signatures in a governed
 * repository/version store and later use them to prove that the exact supplied
 * rule population is the population represented by a versioned snapshot.
 *
 * Non-finite priorities retain distinct canonical markers instead of relying on
 * JSON.stringify's null coercion. They remain invalid governance evidence and are
 * rejected by snapshot diagnostics; the marker only prevents identity collapse.
 *
 * The rule is accepted as read-only evidence: signature construction observes
 * caller-supplied Mapping Master state but does not imply ownership or mutation
 * rights over that governed input object.
 */
export function buildMappingRuleStructuralSignature(
  rule: Readonly<MappingRule>
): string {
  return JSON.stringify({
    id: normalized(rule.id),
    priority: canonicalPriority(rule.priority),
    enabled: rule.enabled,
    company: normalized(rule.company),
    projectId: normalized(rule.projectId),
    phase: rule.phase ?? null,
    glAccount: normalized(rule.glAccount),
    costCenter: normalized(rule.costCenter),
    wbsPrefix: normalized(rule.wbsPrefix),
    costCodePrefix: normalized(rule.costCodePrefix),
    contractId: normalized(rule.contractId),
    finmodCategory: normalized(rule.finmodCategory),
    finmodSubcategory: normalized(rule.finmodSubcategory),
    finmodLineItem: normalized(rule.finmodLineItem),
    accountingTreatment: rule.accountingTreatment ?? null,
    debtEligible: rule.debtEligible ?? null,
    effectiveFrom: normalized(rule.effectiveFrom),
    effectiveTo: normalized(rule.effectiveTo),
  });
}

/**
 * Convenience builder for a Mapping Master snapshot descriptor.
 *
 * Important: creating this descriptor at runtime does not itself establish
 * governance or immutability of the external Mapping Master source. For
 * evidentiary use, the resulting descriptor should be persisted/approved outside
 * the calculation engine and later passed back as the expected snapshot.
 *
 * The returned descriptor is runtime-immutable so a reviewed version/signature
 * population cannot be altered downstream after it has been constructed.
 */
export function buildMappingMasterSnapshotDescriptor(
  version: string,
  rules: ReadonlyArray<Readonly<MappingRule>>
): MappingMasterSnapshotDescriptor {
  return Object.freeze({
    version: version.trim(),
    ruleSignatures: Object.freeze(
      rules.map(buildMappingRuleStructuralSignature).sort()
    ),
  });
}

/**
 * Independently verifies that a supplied Mapping Master rule population exactly
 * matches an explicit expected snapshot descriptor.
 *
 * Stable non-blank unique rule IDs, finite priorities and internally valid explicit
 * effective-date boundaries are part of the snapshot governance boundary, not only
 * downstream released-row lineage. A versioned rule population whose identity,
 * precedence or effective-date evidence is ambiguous cannot provide independently
 * governable Mapping Master evidence even when its structural signatures otherwise
 * reconcile.
 *
 * Retained snapshot signatures are also required to be non-blank evidence. Runtime
 * descriptors built by this module always emit canonical JSON signatures, but an
 * externally retained/deserialized descriptor is still validated independently so
 * an empty signature cannot be treated as a governed rule identity merely because
 * the surrounding descriptor shape is present.
 *
 * Effective-date validation deliberately shares the same governed date-evidence
 * boundary used by controlled Actual lineage. Empty boundaries remain valid open
 * ends; supplied boundaries must be valid date evidence and effectiveFrom cannot be
 * later than effectiveTo. No timezone, accounting-period, business-day or mapping
 * applicability semantics are inferred here.
 *
 * It does not map Actual rows, select rules, repair classifications, approve a
 * Mapping Master version, persist evidence, or claim cryptographic identity.
 * Input populations and individual rules are read-only contracts and returned
 * diagnostic evidence is runtime-immutable so downstream Actual, baseline and
 * PIR consumers cannot alter the evaluated snapshot decision after the control
 * has run.
 */
export function diagnoseMappingMasterSnapshot(input: Readonly<{
  snapshot: Readonly<MappingMasterSnapshotDescriptor>;
  mappingRules: ReadonlyArray<Readonly<MappingRule>>;
}>): MappingMasterSnapshotDiagnostics {
  const issues: MappingMasterSnapshotIssue[] = [];
  const snapshotVersion = input.snapshot.version.trim();
  const expected = [...input.snapshot.ruleSignatures].sort();
  const supplied = input.mappingRules.map(buildMappingRuleStructuralSignature).sort();

  if (!snapshotVersion) {
    issues.push({
      code: 'MISSING_SNAPSHOT_VERSION',
      message: 'Mapping Master snapshot requires an explicit version identifier.',
    });
  }

  input.snapshot.ruleSignatures.forEach((signature, index) => {
    if (!signature.trim()) {
      issues.push({
        code: 'MISSING_SNAPSHOT_RULE_SIGNATURE',
        message: `Mapping Master snapshot rule signature at supplied index ${index} is blank; versioned rule identity cannot be independently verified.`,
      });
    }
  });

  const suppliedRuleIds = new Set<string>();
  const duplicateRuleIds = new Set<string>();

  input.mappingRules.forEach((rule, index) => {
    const mappingRuleId = normalized(rule.id);

    if (!mappingRuleId) {
      issues.push({
        code: 'MISSING_MAPPING_RULE_ID',
        message: `Mapping Master rule at supplied index ${index} has no stable rule id; versioned snapshot evidence cannot independently address this rule.`,
      });
    } else if (suppliedRuleIds.has(mappingRuleId)) {
      duplicateRuleIds.add(mappingRuleId);
    } else {
      suppliedRuleIds.add(mappingRuleId);
    }

    if (!Number.isFinite(rule.priority)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_PRIORITY',
        message: `Mapping Master rule "${mappingRuleId || '(blank id)'}" has a non-finite priority; snapshot identity requires finite numeric precedence evidence.`,
      });
    }

    const effectiveFrom = parseOptionalDate(rule.effectiveFrom);
    const effectiveTo = parseOptionalDate(rule.effectiveTo);

    if (Number.isNaN(effectiveFrom)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_EFFECTIVE_FROM',
        message: `Mapping Master rule "${mappingRuleId || '(blank id)'}" has invalid effectiveFrom evidence "${rule.effectiveFrom}".`,
      });
    }

    if (Number.isNaN(effectiveTo)) {
      issues.push({
        code: 'INVALID_MAPPING_RULE_EFFECTIVE_TO',
        message: `Mapping Master rule "${mappingRuleId || '(blank id)'}" has invalid effectiveTo evidence "${rule.effectiveTo}".`,
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
        message: `Mapping Master rule "${mappingRuleId || '(blank id)'}" has effectiveFrom later than effectiveTo.`,
      });
    }
  });

  for (const mappingRuleId of [...duplicateRuleIds].sort()) {
    issues.push({
      code: 'DUPLICATE_MAPPING_RULE_ID',
      message: `Mapping Master snapshot population contains duplicate rule id "${mappingRuleId}"; versioned rule identity is ambiguous.`,
    });
  }

  if (new Set(expected).size !== expected.length) {
    issues.push({
      code: 'DUPLICATE_SNAPSHOT_RULE_SIGNATURE',
      message: 'Mapping Master snapshot contains duplicate structural rule signatures.',
    });
  }

  const exactPopulationMatch =
    expected.length === supplied.length &&
    expected.every((signature, index) => signature === supplied[index]);

  if (!exactPopulationMatch) {
    issues.push({
      code: 'RULE_POPULATION_MISMATCH',
      message:
        'Supplied Mapping Master rules do not exactly match the expected versioned snapshot population.',
    });
  }

  const frozenIssues: ReadonlyArray<MappingMasterSnapshotIssue> = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed: issues.length === 0,
    issues: frozenIssues,
    snapshotVersion,
    expectedRuleCount: expected.length,
    suppliedRuleCount: supplied.length,
  });
}
