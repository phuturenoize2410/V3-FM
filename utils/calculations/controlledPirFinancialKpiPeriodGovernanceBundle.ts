import type { PirOperatingPeriodControlledRow } from './pirOperatingPeriodControlBundle';
import type {
  PirFinancialKpiMetric,
  PirFinancialKpiSourceSide,
} from './pirFinancialKpiSourceIdentityDiagnostics';
import type { ControlledPirFinancialKpiSourceGovernance } from './controlledPirFinancialKpiSourceGovernance';

type FinancialKpiEvidenceKey = `${PirFinancialKpiMetric}:${PirFinancialKpiSourceSide}`;

export interface ControlledPirFinancialKpiPeriodCoverageDiagnostics {
  readonly passed: boolean;
  readonly sourceGovernancePopulationValid: boolean;
  readonly invalidSourceGovernanceIndexes: ReadonlyArray<number>;
  readonly expectedEvidenceKeys: ReadonlyArray<FinancialKpiEvidenceKey>;
  readonly suppliedEvidenceKeys: ReadonlyArray<FinancialKpiEvidenceKey>;
  readonly missingEvidenceKeys: ReadonlyArray<FinancialKpiEvidenceKey>;
  readonly duplicateEvidenceKeys: ReadonlyArray<FinancialKpiEvidenceKey>;
  readonly unexpectedEvidenceKeys: ReadonlyArray<FinancialKpiEvidenceKey>;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledPirFinancialKpiPeriodGovernanceBundle {
  readonly ready: boolean;
  readonly operatingPeriodControl: PirOperatingPeriodControlledRow;
  /** Exact caller-supplied runtime evidence retained for audit/debug continuity. */
  readonly sourceGovernanceEvidence: unknown;
  /** Structurally usable governance rows only; malformed retained evidence never reaches downstream property access. */
  readonly sourceGovernance: ReadonlyArray<ControlledPirFinancialKpiSourceGovernance>;
  readonly coverage: ControlledPirFinancialKpiPeriodCoverageDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

const FINANCIAL_KPI_FIELDS: ReadonlyArray<{
  metric: PirFinancialKpiMetric;
  side: PirFinancialKpiSourceSide;
  field:
    | 'modelOpexIdrBillion'
    | 'actualOpexIdrBillion'
    | 'modelCfadsIdrBillion'
    | 'actualCfadsIdrBillion'
    | 'modelDscr'
    | 'actualDscr';
}> = Object.freeze([
  { metric: 'opex', side: 'model', field: 'modelOpexIdrBillion' },
  { metric: 'opex', side: 'actual', field: 'actualOpexIdrBillion' },
  { metric: 'cfads', side: 'model', field: 'modelCfadsIdrBillion' },
  { metric: 'cfads', side: 'actual', field: 'actualCfadsIdrBillion' },
  { metric: 'dscr', side: 'model', field: 'modelDscr' },
  { metric: 'dscr', side: 'actual', field: 'actualDscr' },
]);

function evidenceKey(metric: PirFinancialKpiMetric, side: PirFinancialKpiSourceSide): FinancialKpiEvidenceKey {
  return `${metric}:${side}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsableSourceGovernance(value: unknown): value is ControlledPirFinancialKpiSourceGovernance {
  if (!isRecord(value) || !isRecord(value.sourceIdentity)) {
    return false;
  }

  const metric = value.sourceIdentity.metric;
  const side = value.sourceIdentity.side;

  return (
    (metric === 'opex' || metric === 'cfads' || metric === 'dscr') &&
    (side === 'model' || side === 'actual') &&
    typeof value.ready === 'boolean' &&
    Array.isArray(value.blockingReasons) &&
    value.blockingReasons.every((reason) => typeof reason === 'string') &&
    'operatingPeriodControl' in value
  );
}

function assessCoverage(input: {
  operatingPeriodControl: PirOperatingPeriodControlledRow;
  periodInput: Record<string, unknown> | null;
  sourceGovernance: ReadonlyArray<ControlledPirFinancialKpiSourceGovernance>;
  sourceGovernancePopulationValid: boolean;
  invalidSourceGovernanceIndexes: ReadonlyArray<number>;
}): ControlledPirFinancialKpiPeriodCoverageDiagnostics {
  const expectedEvidenceKeys = input.periodInput
    ? FINANCIAL_KPI_FIELDS
        .filter(({ field }) => {
          const value = input.periodInput?.[field];
          return value !== null && value !== undefined;
        })
        .map(({ metric, side }) => evidenceKey(metric, side))
    : [];

  const suppliedEvidenceKeys = input.sourceGovernance.map((governance) =>
    evidenceKey(governance.sourceIdentity.metric, governance.sourceIdentity.side)
  );

  const suppliedCounts = new Map<FinancialKpiEvidenceKey, number>();
  for (const key of suppliedEvidenceKeys) {
    suppliedCounts.set(key, (suppliedCounts.get(key) ?? 0) + 1);
  }

  const expectedSet = new Set(expectedEvidenceKeys);
  const suppliedSet = new Set(suppliedEvidenceKeys);
  const missingEvidenceKeys = expectedEvidenceKeys.filter((key) => !suppliedSet.has(key));
  const duplicateEvidenceKeys = [...suppliedCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const unexpectedEvidenceKeys = [...suppliedSet].filter((key) => !expectedSet.has(key));

  const blockingReasons: string[] = [];

  if (!input.sourceGovernancePopulationValid) {
    blockingReasons.push(
      'PIR financial KPI period governance source-evidence population must be an array.'
    );
  }

  if (input.invalidSourceGovernanceIndexes.length > 0) {
    blockingReasons.push(
      `PIR financial KPI period governance contains malformed source-evidence item(s) at index: ${input.invalidSourceGovernanceIndexes.join(', ')}.`
    );
  }

  if (missingEvidenceKeys.length > 0) {
    blockingReasons.push(
      `PIR financial KPI period governance is missing explicit source identity for: ${missingEvidenceKeys.join(', ')}.`
    );
  }

  if (duplicateEvidenceKeys.length > 0) {
    blockingReasons.push(
      `PIR financial KPI period governance has duplicate source evidence for: ${duplicateEvidenceKeys.join(', ')}.`
    );
  }

  if (unexpectedEvidenceKeys.length > 0) {
    blockingReasons.push(
      `PIR financial KPI period governance received source evidence for KPI values not explicitly present in the controlled PIR period: ${unexpectedEvidenceKeys.join(', ')}.`
    );
  }

  for (const governance of input.sourceGovernance) {
    if (governance.operatingPeriodControl !== input.operatingPeriodControl) {
      blockingReasons.push(
        'PIR financial KPI period governance requires every source-evidence item to retain the exact same in-memory controlled operating-period row.'
      );
    }
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);

  return Object.freeze({
    passed: uniqueBlockingReasons.length === 0,
    sourceGovernancePopulationValid: input.sourceGovernancePopulationValid,
    invalidSourceGovernanceIndexes: Object.freeze([...input.invalidSourceGovernanceIndexes]),
    expectedEvidenceKeys: Object.freeze([...expectedEvidenceKeys]),
    suppliedEvidenceKeys: Object.freeze([...suppliedEvidenceKeys]),
    missingEvidenceKeys: Object.freeze([...missingEvidenceKeys]),
    duplicateEvidenceKeys: Object.freeze([...duplicateEvidenceKeys]),
    unexpectedEvidenceKeys: Object.freeze([...unexpectedEvidenceKeys]),
    blockingReasons: uniqueBlockingReasons,
  });
}

/**
 * Asset-generic, read-only composition boundary for OPEX, CFADS and DSCR source
 * identity within one exact controlled PIR operating period.
 *
 * Coverage is derived only from KPI values already explicitly present on the
 * controlled PIR period input. Each present model/Actual KPI value must have one,
 * and only one, ready source-governance item bound to that exact in-memory period.
 * Missing PIR KPI values remain absent; this bundle does not manufacture values or
 * force economics that the caller has not supplied.
 *
 * Runtime/deserialized operating-period evidence is validated before any nested input,
 * issue or passed flag is dereferenced. Malformed control/input/issue envelopes fail
 * closed while the exact caller-supplied control value is retained; the bundle never
 * repairs or normalizes retained governance evidence into an apparently valid period.
 *
 * The exact caller-supplied source-governance evidence is retained separately from
 * the structurally usable population. Malformed deserialized populations/items fail
 * closed and never reach downstream property access; they are not coerced, repaired,
 * reclassified or silently promoted into valid governance evidence.
 *
 * The source-governance population is snapshotted once before coverage and readiness
 * are assessed. This keeps all derived diagnostics and the retained usable population
 * bound to one exact ordered evidence set even when the caller owns a mutable array.
 *
 * The bundle does not authenticate an external source system, decide accounting or
 * lifecycle classification, calculate/repair OPEX, CFADS or DSCR, select/approve a
 * baseline, persist evidence, or infer electricity, tariff, PPA, EBL or other
 * commercial terms. Object identity is an in-memory continuity control only and
 * does not claim persisted identity across serialization or external evidence stores.
 */
export function buildControlledPirFinancialKpiPeriodGovernanceBundle(input: {
  operatingPeriodControl: PirOperatingPeriodControlledRow;
  sourceGovernance: ReadonlyArray<ControlledPirFinancialKpiSourceGovernance>;
}): ControlledPirFinancialKpiPeriodGovernanceBundle {
  const rawOperatingPeriodControl = input?.operatingPeriodControl as unknown;
  const operatingPeriodEnvelope = isRecord(rawOperatingPeriodControl)
    ? rawOperatingPeriodControl
    : null;
  const rawPeriodInput = operatingPeriodEnvelope?.input;
  const periodInputEnvelope = isRecord(rawPeriodInput) ? rawPeriodInput : null;
  const rawControlIssues = operatingPeriodEnvelope?.issues;
  const controlIssues = Array.isArray(rawControlIssues) ? rawControlIssues : [];
  let controlIssuePopulationStructurallyValid = Array.isArray(rawControlIssues);
  const controlBlockingReasons: string[] = [];

  if (!operatingPeriodEnvelope) {
    controlBlockingReasons.push(
      'PIR financial KPI period governance requires an explicit controlled operating-period object; malformed retained control evidence fails closed.'
    );
  }

  if (!periodInputEnvelope) {
    controlBlockingReasons.push(
      'PIR financial KPI period governance requires an inspectable retained operating-period input object; malformed period evidence cannot establish KPI coverage.'
    );
  }

  if (!Array.isArray(rawControlIssues)) {
    controlBlockingReasons.push(
      'PIR financial KPI period governance requires an inspectable controlled-period issue population; malformed retained issue evidence fails closed.'
    );
  } else {
    controlIssues.forEach((issue, index) => {
      if (
        !isRecord(issue) ||
        (issue.severity !== 'error' && issue.severity !== 'warning') ||
        typeof issue.message !== 'string'
      ) {
        controlIssuePopulationStructurallyValid = false;
        controlBlockingReasons.push(
          `PIR financial KPI period governance contains malformed controlled-period issue evidence at index ${index}; retained issue evidence is not discarded or repaired.`
        );
        return;
      }

      if (issue.severity === 'error') {
        controlBlockingReasons.push(issue.message);
      }
    });
  }

  const sourceGovernanceEvidence: unknown = input?.sourceGovernance;
  const sourceGovernancePopulationValid = Array.isArray(sourceGovernanceEvidence);
  const sourceGovernancePopulation = sourceGovernancePopulationValid
    ? sourceGovernanceEvidence
    : [];
  const invalidSourceGovernanceIndexes: number[] = [];
  const usableSourceGovernance: ControlledPirFinancialKpiSourceGovernance[] = [];

  sourceGovernancePopulation.forEach((governance, index) => {
    if (isUsableSourceGovernance(governance)) {
      usableSourceGovernance.push(governance);
    } else {
      invalidSourceGovernanceIndexes.push(index);
    }
  });

  const operatingPeriodControl = rawOperatingPeriodControl as PirOperatingPeriodControlledRow;
  const sourceGovernance = Object.freeze([...usableSourceGovernance]);
  const coverage = assessCoverage({
    operatingPeriodControl,
    periodInput: periodInputEnvelope,
    sourceGovernance,
    sourceGovernancePopulationValid,
    invalidSourceGovernanceIndexes,
  });

  const blockingReasons = Object.freeze([
    ...new Set([
      ...controlBlockingReasons,
      ...sourceGovernance.flatMap((governance) => governance.blockingReasons),
      ...coverage.blockingReasons,
    ]),
  ]);
  const controlPassed = operatingPeriodEnvelope?.passed === true;

  return Object.freeze({
    ready:
      controlPassed &&
      periodInputEnvelope !== null &&
      controlIssuePopulationStructurallyValid &&
      sourceGovernance.every((governance) => governance.ready) &&
      coverage.passed &&
      blockingReasons.length === 0,
    operatingPeriodControl,
    sourceGovernanceEvidence,
    sourceGovernance,
    coverage,
    blockingReasons,
  });
}
