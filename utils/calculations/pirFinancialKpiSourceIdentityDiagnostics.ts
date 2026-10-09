import type { PirOperatingPeriodInput } from './investmentLifecycleEngine';

export type PirFinancialKpiSourceSide = 'model' | 'actual';
export type PirFinancialKpiMetric = 'opex' | 'cfads' | 'dscr';
export type PirFinancialKpiSourceIdentitySeverity = 'error' | 'warning';

export interface PirFinancialKpiSourceEvidence {
  readonly sourceId: string;
  readonly populationId: string;
  readonly year: number;
  readonly side: PirFinancialKpiSourceSide;
  readonly metric: PirFinancialKpiMetric;
  readonly value: number;
}

export interface PirFinancialKpiSourceIdentityIssue {
  readonly code: string;
  readonly severity: PirFinancialKpiSourceIdentitySeverity;
  readonly message: string;
}

export interface PirFinancialKpiSourceIdentityDiagnostics {
  readonly passed: boolean;
  readonly metric: PirFinancialKpiMetric;
  readonly side: PirFinancialKpiSourceSide;
  readonly year: number;
  readonly sourceId: string;
  readonly populationId: string;
  readonly sourceValue: number;
  readonly pirValue: number | null;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly issues: ReadonlyArray<PirFinancialKpiSourceIdentityIssue>;
}

const VALUE_TOLERANCE = 1e-9;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPirFinancialKpiMetric(value: unknown): value is PirFinancialKpiMetric {
  return value === 'opex' || value === 'cfads' || value === 'dscr';
}

function isPirFinancialKpiSourceSide(value: unknown): value is PirFinancialKpiSourceSide {
  return value === 'model' || value === 'actual';
}

function selectedPirValue(input: {
  metric: PirFinancialKpiMetric;
  side: PirFinancialKpiSourceSide;
  pirPeriodInput: PirOperatingPeriodInput;
}): number | null {
  const { metric, side, pirPeriodInput } = input;

  if (metric === 'opex') {
    return side === 'model'
      ? pirPeriodInput.modelOpexIdrBillion ?? null
      : pirPeriodInput.actualOpexIdrBillion ?? null;
  }

  if (metric === 'cfads') {
    return side === 'model'
      ? pirPeriodInput.modelCfadsIdrBillion ?? null
      : pirPeriodInput.actualCfadsIdrBillion ?? null;
  }

  return side === 'model'
    ? pirPeriodInput.modelDscr ?? null
    : pirPeriodInput.actualDscr ?? null;
}

function differs(a: number, b: number, tolerance = VALUE_TOLERANCE): boolean {
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance;
}

/**
 * Asset-generic, read-only source-identity control for PIR financial KPIs that are
 * not owned by the electricity Energy Sales module: OPEX, CFADS and DSCR.
 *
 * The caller must supply explicit source evidence including source ID, population ID,
 * year, model/Actual side, metric and value. The diagnostic reconciles that evidence
 * to the corresponding already-supplied PIR operating-period input and fails closed
 * when the PIR value is absent. It never guesses which source, population, side or
 * period should be used.
 *
 * Runtime envelope, discriminator and identifier evidence is validated independently
 * before a PIR value is treated as governed. This matters after serialization/
 * deserialization because TypeScript declarations are not runtime authentication: a
 * null/array/primitive envelope must not be dereferenced, an unknown metric must not
 * silently fall through to DSCR, an unknown side must not silently fall through to
 * Actual, and a non-string source/population identity must not reach string operations
 * or be coerced into provenance. Required source/population identifiers must also be
 * exact caller-supplied identities: leading/trailing whitespace is treated as
 * ambiguous retained evidence rather than silently normalized. Invalid retained
 * evidence therefore blocks governance instead of selecting, normalizing or repairing
 * a parallel KPI path.
 *
 * This is structural provenance evidence only. It does not authenticate the source
 * system or preparer, prove that the source population is audited, decide accounting
 * classification, calculate or repair OPEX/CFADS/DSCR, select a baseline, approve PIR,
 * or infer any tariff/PPA/EBL/commercial economics.
 */
export function assessPirFinancialKpiSourceIdentity(input: {
  evidence: PirFinancialKpiSourceEvidence;
  pirPeriodInput: PirOperatingPeriodInput;
}): PirFinancialKpiSourceIdentityDiagnostics {
  const issues: PirFinancialKpiSourceIdentityIssue[] = [];
  const evidenceEnvelope: unknown = input?.evidence;
  const periodEnvelope: unknown = input?.pirPeriodInput;
  const evidence = isRecord(evidenceEnvelope) ? evidenceEnvelope : null;
  const period = isRecord(periodEnvelope) ? periodEnvelope : null;

  if (!evidence) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_EVIDENCE_ENVELOPE_INVALID',
      severity: 'error',
      message: 'PIR financial KPI source evidence must be an object envelope; malformed retained evidence is not normalized or repaired.',
    });
  }

  if (!period) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_PERIOD_ENVELOPE_INVALID',
      severity: 'error',
      message: 'PIR financial KPI reconciliation requires an explicit PIR operating-period object; malformed retained period evidence is not normalized or repaired.',
    });
  }

  const metric = evidence?.metric;
  const side = evidence?.side;
  const year = evidence?.year;
  const sourceId = evidence?.sourceId;
  const populationId = evidence?.populationId;
  const sourceValue = evidence?.value;
  const metricValid = isPirFinancialKpiMetric(metric);
  const sideValid = isPirFinancialKpiSourceSide(side);
  const pirValue =
    metricValid && sideValid && period
      ? selectedPirValue({
          metric,
          side,
          pirPeriodInput: period as unknown as PirOperatingPeriodInput,
        })
      : null;

  if (typeof sourceId !== 'string') {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_SOURCE_ID_INVALID',
      severity: 'error',
      message: 'PIR financial KPI source identity must be a caller-supplied string; malformed runtime evidence is not coerced.',
    });
  } else if (!sourceId.trim()) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_SOURCE_ID_MISSING',
      severity: 'error',
      message: 'PIR financial KPI source identity requires a non-empty caller-supplied source ID.',
    });
  } else if (sourceId !== sourceId.trim()) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_SOURCE_ID_AMBIGUOUS',
      severity: 'error',
      message: 'PIR financial KPI source identity must match the exact caller-supplied identifier without leading or trailing whitespace; retained identity is not normalized.',
    });
  }

  if (typeof populationId !== 'string') {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_POPULATION_ID_INVALID',
      severity: 'error',
      message: 'PIR financial KPI population identity must be a caller-supplied string; malformed runtime evidence is not coerced.',
    });
  } else if (!populationId.trim()) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_POPULATION_ID_MISSING',
      severity: 'error',
      message: 'PIR financial KPI source identity requires a non-empty caller-supplied population ID.',
    });
  } else if (populationId !== populationId.trim()) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_POPULATION_ID_AMBIGUOUS',
      severity: 'error',
      message: 'PIR financial KPI population identity must match the exact caller-supplied identifier without leading or trailing whitespace; retained identity is not normalized.',
    });
  }

  if (!metricValid) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_METRIC_INVALID',
      severity: 'error',
      message: 'PIR financial KPI source evidence must use an explicit supported metric: OPEX, CFADS or DSCR.',
    });
  }

  if (!sideValid) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_SIDE_INVALID',
      severity: 'error',
      message: 'PIR financial KPI source evidence must use an explicit supported side: model or actual.',
    });
  }

  if (!Number.isInteger(year) || !period || year !== period.year) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_YEAR_MISMATCH',
      severity: 'error',
      message: 'PIR financial KPI source-evidence year must be an integer matching the explicit PIR operating-period year.',
    });
  }

  if (!Number.isFinite(sourceValue)) {
    issues.push({
      code: 'PIR_FINANCIAL_KPI_SOURCE_VALUE_INVALID',
      severity: 'error',
      message: 'PIR financial KPI source-evidence value must be finite.',
    });
  }

  if (metricValid && sideValid && period) {
    if (pirValue === null || !Number.isFinite(pirValue)) {
      issues.push({
        code: 'PIR_FINANCIAL_KPI_VALUE_MISSING',
        severity: 'error',
        message: `PIR ${metric.toUpperCase()} ${side} value must be explicitly supplied before source identity can be governed.`,
      });
    } else if (differs(sourceValue as number, pirValue)) {
      issues.push({
        code: 'PIR_FINANCIAL_KPI_VALUE_MISMATCH',
        severity: 'error',
        message: `Caller-supplied ${metric.toUpperCase()} source evidence does not reconcile to the explicit ${side} PIR operating-period input.`,
      });
    }
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const frozenIssues = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed: blockingIssueCount === 0,
    metric: metric as PirFinancialKpiMetric,
    side: side as PirFinancialKpiSourceSide,
    year: year as number,
    sourceId: sourceId as string,
    populationId: populationId as string,
    sourceValue: sourceValue as number,
    pirValue,
    blockingIssueCount,
    warningCount,
    issues: frozenIssues,
  });
}
