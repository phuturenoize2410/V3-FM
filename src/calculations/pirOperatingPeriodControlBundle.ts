import type {
  PirOperatingPeriodInput,
  PirOperatingPeriodResult,
} from './investmentLifecycleEngine';
import {
  assessPirOperatingPeriodDiagnostics,
  type PirOperatingPeriodDiagnostics,
  type PirOperatingPeriodDiagnosticIssue,
} from './pirOperatingPeriodDiagnostics';

export interface PirOperatingPeriodControlIssue extends PirOperatingPeriodDiagnosticIssue {
  year: number;
}

export interface PirOperatingPeriodControlledRow {
  year: number;
  readonly input: PirOperatingPeriodInput;
  readonly result: PirOperatingPeriodResult;
  inputIdentityPassed: boolean;
  arithmetic: PirOperatingPeriodDiagnostics;
  passed: boolean;
  issues: PirOperatingPeriodControlIssue[];
}

export interface PirOperatingPeriodControlBundle {
  ready: boolean;
  periodsEvaluated: number;
  passedPeriods: number;
  failedPeriods: number;
  rows: PirOperatingPeriodControlledRow[];
  issues: PirOperatingPeriodControlIssue[];
}

const OPTIONAL_NUMBER_FIELDS: Array<
  'modelOpexIdrBillion' |
  'actualOpexIdrBillion' |
  'modelCfadsIdrBillion' |
  'actualCfadsIdrBillion' |
  'modelDscr' |
  'actualDscr'
> = [
  'modelOpexIdrBillion',
  'actualOpexIdrBillion',
  'modelCfadsIdrBillion',
  'actualCfadsIdrBillion',
  'modelDscr',
  'actualDscr',
];

function sameOptionalNumber(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  return Number.isFinite(a) && Number.isFinite(b) && Object.is(a, b);
}

function assessInputIdentity(
  input: PirOperatingPeriodInput,
  result: PirOperatingPeriodResult
): PirOperatingPeriodControlIssue[] {
  const issues: PirOperatingPeriodControlIssue[] = [];

  if (result.year !== input.year) {
    issues.push({
      year: input.year,
      code: 'PIR_PERIOD_YEAR_IDENTITY',
      severity: 'error',
      message: 'PIR operating-period result year does not match the explicitly supplied period input.',
    });
  }

  const requiredFields: Array<
    'modelEnergySalesGWh' |
    'actualEnergySalesGWh' |
    'modelRevenueIdrBillion' |
    'actualRevenueIdrBillion'
  > = [
    'modelEnergySalesGWh',
    'actualEnergySalesGWh',
    'modelRevenueIdrBillion',
    'actualRevenueIdrBillion',
  ];

  for (const field of requiredFields) {
    const inputValue = input[field];
    const resultValue = result[field];
    if (!Number.isFinite(inputValue) || !Number.isFinite(resultValue) || !Object.is(inputValue, resultValue)) {
      issues.push({
        year: input.year,
        code: `PIR_PERIOD_INPUT_IDENTITY_${field.toUpperCase()}`,
        severity: 'error',
        message: `PIR operating-period result does not preserve the explicit ${field} input value.`,
      });
    }
  }

  for (const field of OPTIONAL_NUMBER_FIELDS) {
    if (!sameOptionalNumber(input[field], result[field])) {
      issues.push({
        year: input.year,
        code: `PIR_PERIOD_INPUT_IDENTITY_${field.toUpperCase()}`,
        severity: 'error',
        message: `PIR operating-period result does not preserve the explicit optional ${field} input value.`,
      });
    }
  }

  return issues;
}

/**
 * Calculation-control handoff for explicit PIR operating-period input/result pairs.
 *
 * The exact caller-supplied input and result objects are retained on each row so
 * downstream governance can prove population continuity without reconstructing
 * operating-period evidence from year keys or summary values. This is deliberate
 * in-memory structural provenance only and does not claim persisted identity.
 *
 * This bundle intentionally does not establish lifecycle or PIR governance readiness.
 * It only proves that each supplied result preserves its explicit source input identity
 * and passes the independent operating-period arithmetic diagnostics.
 *
 * It does not:
 * - select Plan/Actual baselines or approve a PIR case;
 * - calculate or repair Energy Sales, revenue, tariff, OPEX, CFADS or DSCR;
 * - infer PPA, EBL, tariff-tier, commitment or other commercial terms;
 * - convert effective tariff arithmetic into a commercial entitlement.
 */
export function buildPirOperatingPeriodControlBundle(
  periods: Array<{
    input: PirOperatingPeriodInput;
    result: PirOperatingPeriodResult;
  }>
): PirOperatingPeriodControlBundle {
  const rows = periods.map(({ input, result }) => {
    const identityIssues = assessInputIdentity(input, result);
    const arithmetic = assessPirOperatingPeriodDiagnostics(input, result);
    const arithmeticIssues = arithmetic.issues.map<PirOperatingPeriodControlIssue>((issue) => ({
      ...issue,
      year: input.year,
    }));
    const issues = [...identityIssues, ...arithmeticIssues];

    return {
      year: input.year,
      input,
      result,
      inputIdentityPassed: identityIssues.length === 0,
      arithmetic,
      passed: !issues.some((issue) => issue.severity === 'error'),
      issues,
    };
  });

  const issues = rows.flatMap((row) => row.issues);
  const passedPeriods = rows.filter((row) => row.passed).length;

  return {
    ready: rows.length > 0 && passedPeriods === rows.length,
    periodsEvaluated: rows.length,
    passedPeriods,
    failedPeriods: rows.length - passedPeriods,
    rows,
    issues,
  };
}
