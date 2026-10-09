import type {
  PirLifeToDateSummary,
  PirOperatingPeriodResult,
} from './investmentLifecycleEngine';

export type PirLifeToDateDiagnosticSeverity = 'error' | 'warning';

export interface PirLifeToDateDiagnosticIssue {
  code: string;
  severity: PirLifeToDateDiagnosticSeverity;
  message: string;
  year?: number;
}

export interface PirLifeToDateDiagnostics {
  passed: boolean;
  blockingIssueCount: number;
  warningCount: number;
  periodCount: number;
  uniqueYearCount: number;
  recalculated: PirLifeToDateSummary;
  issues: PirLifeToDateDiagnosticIssue[];
}

const ENERGY_TOLERANCE_GWH = 1e-9;
const REVENUE_TOLERANCE_IDR_BILLION = 1e-9;

function differs(a: number, b: number, tolerance: number): boolean {
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance;
}

function emptySummary(): PirLifeToDateSummary {
  return {
    periods: 0,
    modelEnergySalesGWh: 0,
    actualEnergySalesGWh: 0,
    energySalesVarianceGWh: 0,
    modelRevenueIdrBillion: 0,
    actualRevenueIdrBillion: 0,
    revenueVarianceIdrBillion: 0,
    volumeRevenueImpactIdrBillion: 0,
    tariffMixRevenueImpactIdrBillion: 0,
  };
}

/**
 * Independently re-performs one PIR life-to-date population summary and checks
 * that the supplied period population is safe to aggregate.
 *
 * This control is deliberately asset-generic and calculation-only. It does not:
 * - select or approve Plan / Actual baselines;
 * - establish Actual provenance or Mapping Master evidence;
 * - infer missing periods or choose a reporting cutoff;
 * - repair duplicate years;
 * - infer PPA, EBL, tariff-tier, escalation or other commercial terms;
 * - mutate PIR operating-period results or the supplied life-to-date summary.
 *
 * Duplicate years are blocking because silently summing the same operating period
 * more than once would overstate life-to-date volume, revenue and variance metrics.
 */
export function assessPirLifeToDateDiagnostics(
  periods: PirOperatingPeriodResult[],
  summary: PirLifeToDateSummary
): PirLifeToDateDiagnostics {
  const issues: PirLifeToDateDiagnosticIssue[] = [];
  const seenYears = new Set<number>();

  const recalculated = periods.reduce<PirLifeToDateSummary>((acc, row) => {
    if (!Number.isFinite(row.year)) {
      issues.push({
        code: 'PIR_LTD_YEAR_INVALID',
        severity: 'error',
        message: 'Every PIR operating period must have a finite year before life-to-date aggregation.',
      });
    } else if (seenYears.has(row.year)) {
      issues.push({
        code: 'PIR_LTD_DUPLICATE_YEAR',
        severity: 'error',
        year: row.year,
        message: `PIR operating year ${row.year} appears more than once; life-to-date aggregation is blocked to prevent double counting.`,
      });
    } else {
      seenYears.add(row.year);
    }

    const numericFields: Array<[keyof PirLifeToDateSummary, number]> = [
      ['modelEnergySalesGWh', row.modelEnergySalesGWh],
      ['actualEnergySalesGWh', row.actualEnergySalesGWh],
      ['energySalesVarianceGWh', row.energySalesVarianceGWh],
      ['modelRevenueIdrBillion', row.modelRevenueIdrBillion],
      ['actualRevenueIdrBillion', row.actualRevenueIdrBillion],
      ['revenueVarianceIdrBillion', row.revenueVarianceIdrBillion],
      ['volumeRevenueImpactIdrBillion', row.volumeRevenueImpactIdrBillion],
      ['tariffMixRevenueImpactIdrBillion', row.tariffMixRevenueImpactIdrBillion],
    ];

    for (const [field, value] of numericFields) {
      if (!Number.isFinite(value)) {
        issues.push({
          code: 'PIR_LTD_PERIOD_VALUE_INVALID',
          severity: 'error',
          year: row.year,
          message: `PIR operating period ${row.year} has a non-finite ${String(field)} value and cannot be represented as reconciled life-to-date evidence.`,
        });
      }
    }

    return {
      periods: acc.periods + 1,
      modelEnergySalesGWh: acc.modelEnergySalesGWh + row.modelEnergySalesGWh,
      actualEnergySalesGWh: acc.actualEnergySalesGWh + row.actualEnergySalesGWh,
      energySalesVarianceGWh: acc.energySalesVarianceGWh + row.energySalesVarianceGWh,
      modelRevenueIdrBillion: acc.modelRevenueIdrBillion + row.modelRevenueIdrBillion,
      actualRevenueIdrBillion: acc.actualRevenueIdrBillion + row.actualRevenueIdrBillion,
      revenueVarianceIdrBillion: acc.revenueVarianceIdrBillion + row.revenueVarianceIdrBillion,
      volumeRevenueImpactIdrBillion:
        acc.volumeRevenueImpactIdrBillion + row.volumeRevenueImpactIdrBillion,
      tariffMixRevenueImpactIdrBillion:
        acc.tariffMixRevenueImpactIdrBillion + row.tariffMixRevenueImpactIdrBillion,
    };
  }, emptySummary());

  if (summary.periods !== recalculated.periods) {
    issues.push({
      code: 'PIR_LTD_PERIOD_COUNT_RECONCILIATION',
      severity: 'error',
      message: 'PIR life-to-date period count does not reconcile to the supplied operating-period population.',
    });
  }

  const energyChecks: Array<[keyof PirLifeToDateSummary, number, number]> = [
    ['modelEnergySalesGWh', summary.modelEnergySalesGWh, recalculated.modelEnergySalesGWh],
    ['actualEnergySalesGWh', summary.actualEnergySalesGWh, recalculated.actualEnergySalesGWh],
    ['energySalesVarianceGWh', summary.energySalesVarianceGWh, recalculated.energySalesVarianceGWh],
  ];

  for (const [field, supplied, expected] of energyChecks) {
    if (differs(supplied, expected, ENERGY_TOLERANCE_GWH)) {
      issues.push({
        code: 'PIR_LTD_ENERGY_RECONCILIATION',
        severity: 'error',
        message: `PIR life-to-date ${String(field)} does not reconcile to the supplied operating-period population.`,
      });
    }
  }

  const revenueChecks: Array<[keyof PirLifeToDateSummary, number, number]> = [
    ['modelRevenueIdrBillion', summary.modelRevenueIdrBillion, recalculated.modelRevenueIdrBillion],
    ['actualRevenueIdrBillion', summary.actualRevenueIdrBillion, recalculated.actualRevenueIdrBillion],
    ['revenueVarianceIdrBillion', summary.revenueVarianceIdrBillion, recalculated.revenueVarianceIdrBillion],
    ['volumeRevenueImpactIdrBillion', summary.volumeRevenueImpactIdrBillion, recalculated.volumeRevenueImpactIdrBillion],
    ['tariffMixRevenueImpactIdrBillion', summary.tariffMixRevenueImpactIdrBillion, recalculated.tariffMixRevenueImpactIdrBillion],
  ];

  for (const [field, supplied, expected] of revenueChecks) {
    if (differs(supplied, expected, REVENUE_TOLERANCE_IDR_BILLION)) {
      issues.push({
        code: 'PIR_LTD_REVENUE_RECONCILIATION',
        severity: 'error',
        message: `PIR life-to-date ${String(field)} does not reconcile to the supplied operating-period population.`,
      });
    }
  }

  const recalculatedRevenueBridge =
    recalculated.volumeRevenueImpactIdrBillion +
    recalculated.tariffMixRevenueImpactIdrBillion -
    recalculated.revenueVarianceIdrBillion;

  if (
    !Number.isFinite(recalculatedRevenueBridge) ||
    Math.abs(recalculatedRevenueBridge) > REVENUE_TOLERANCE_IDR_BILLION
  ) {
    issues.push({
      code: 'PIR_LTD_REVENUE_BRIDGE_IDENTITY',
      severity: 'error',
      message: 'PIR life-to-date volume impact plus tariff/mix impact does not reconcile to total revenue variance.',
    });
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    passed: blockingIssueCount === 0,
    blockingIssueCount,
    warningCount,
    periodCount: periods.length,
    uniqueYearCount: seenYears.size,
    recalculated,
    issues,
  };
}
