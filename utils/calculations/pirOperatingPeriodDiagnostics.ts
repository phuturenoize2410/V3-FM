import type {
  PirOperatingPeriodInput,
  PirOperatingPeriodResult,
} from './investmentLifecycleEngine';

export type PirOperatingPeriodDiagnosticSeverity = 'error' | 'warning';

export interface PirOperatingPeriodDiagnosticIssue {
  code: string;
  severity: PirOperatingPeriodDiagnosticSeverity;
  message: string;
}

export interface PirOperatingPeriodDiagnostics {
  passed: boolean;
  issues: PirOperatingPeriodDiagnosticIssue[];
  recalculatedModelEffectiveTariffIdrPerKWh: number;
  recalculatedActualEffectiveTariffIdrPerKWh: number;
  recalculatedVolumeRevenueImpactIdrBillion: number;
  recalculatedTariffMixRevenueImpactIdrBillion: number;
  recalculatedRevenueVarianceIdrBillion: number;
  revenueBridgeReconciliationIdrBillion: number;
}

const ENERGY_TOLERANCE_GWH = 1e-9;
const REVENUE_TOLERANCE_IDR_BILLION = 1e-9;
const TARIFF_TOLERANCE_IDR_PER_KWH = 1e-9;
const RATIO_TOLERANCE = 1e-9;

function isFiniteOrNull(value: number | null | undefined): boolean {
  return value === null || value === undefined || Number.isFinite(value);
}

function addNonFiniteIssue(
  issues: PirOperatingPeriodDiagnosticIssue[],
  value: number,
  code: string,
  label: string
): void {
  if (!Number.isFinite(value)) {
    issues.push({
      code,
      severity: 'error',
      message: `${label} must be finite before PIR bridge calculations can be represented as controlled.`,
    });
  }
}

function differs(a: number, b: number, tolerance: number): boolean {
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance;
}

/**
 * Independently re-performs the arithmetic identities of one PIR operating period.
 *
 * This diagnostic is intentionally calculation-only and commercial-term agnostic:
 * - it does not choose a Plan/Actual baseline;
 * - it does not validate or infer PPA, EBL, tariff-tier or commitment terms;
 * - it does not mutate Energy Sales, revenue, OPEX, CFADS or DSCR values;
 * - it does not turn a PIR result into an approved/governed PIR on its own.
 *
 * Its sole purpose is to prevent a malformed or stale PIR operating-period result
 * from being presented as reconciled when the independently re-performed volume /
 * effective-tariff revenue bridge does not agree with the supplied result.
 */
export function assessPirOperatingPeriodDiagnostics(
  input: PirOperatingPeriodInput,
  result: PirOperatingPeriodResult
): PirOperatingPeriodDiagnostics {
  const issues: PirOperatingPeriodDiagnosticIssue[] = [];

  addNonFiniteIssue(issues, input.modelEnergySalesGWh, 'PIR_MODEL_ENERGY_INVALID', 'Model Energy Sales');
  addNonFiniteIssue(issues, input.actualEnergySalesGWh, 'PIR_ACTUAL_ENERGY_INVALID', 'Actual Energy Sales');
  addNonFiniteIssue(issues, input.modelRevenueIdrBillion, 'PIR_MODEL_REVENUE_INVALID', 'Model revenue');
  addNonFiniteIssue(issues, input.actualRevenueIdrBillion, 'PIR_ACTUAL_REVENUE_INVALID', 'Actual revenue');

  if (Number.isFinite(input.modelEnergySalesGWh) && input.modelEnergySalesGWh < 0) {
    issues.push({
      code: 'PIR_MODEL_ENERGY_NEGATIVE',
      severity: 'error',
      message: 'Model Energy Sales is negative; the physical volume basis must be resolved explicitly before PIR bridge use.',
    });
  }

  if (Number.isFinite(input.actualEnergySalesGWh) && input.actualEnergySalesGWh < 0) {
    issues.push({
      code: 'PIR_ACTUAL_ENERGY_NEGATIVE',
      severity: 'error',
      message: 'Actual Energy Sales is negative; the physical volume basis must be resolved explicitly before PIR bridge use.',
    });
  }

  if (input.modelOpexIdrBillion !== undefined && !Number.isFinite(input.modelOpexIdrBillion)) {
    issues.push({ code: 'PIR_MODEL_OPEX_INVALID', severity: 'error', message: 'Model OPEX must be finite when supplied.' });
  }
  if (input.actualOpexIdrBillion !== undefined && !Number.isFinite(input.actualOpexIdrBillion)) {
    issues.push({ code: 'PIR_ACTUAL_OPEX_INVALID', severity: 'error', message: 'Actual OPEX must be finite when supplied.' });
  }
  if (input.modelCfadsIdrBillion !== undefined && !Number.isFinite(input.modelCfadsIdrBillion)) {
    issues.push({ code: 'PIR_MODEL_CFADS_INVALID', severity: 'error', message: 'Model CFADS must be finite when supplied.' });
  }
  if (input.actualCfadsIdrBillion !== undefined && !Number.isFinite(input.actualCfadsIdrBillion)) {
    issues.push({ code: 'PIR_ACTUAL_CFADS_INVALID', severity: 'error', message: 'Actual CFADS must be finite when supplied.' });
  }
  if (!isFiniteOrNull(input.modelDscr)) {
    issues.push({ code: 'PIR_MODEL_DSCR_INVALID', severity: 'error', message: 'Model DSCR must be finite or null when supplied.' });
  }
  if (!isFiniteOrNull(input.actualDscr)) {
    issues.push({ code: 'PIR_ACTUAL_DSCR_INVALID', severity: 'error', message: 'Actual DSCR must be finite or null when supplied.' });
  }

  const recalculatedModelEffectiveTariffIdrPerKWh =
    Number.isFinite(input.modelEnergySalesGWh) &&
    Number.isFinite(input.modelRevenueIdrBillion) &&
    input.modelEnergySalesGWh > 0
      ? (input.modelRevenueIdrBillion * 1e9) / (input.modelEnergySalesGWh * 1e6)
      : 0;

  const recalculatedActualEffectiveTariffIdrPerKWh =
    Number.isFinite(input.actualEnergySalesGWh) &&
    Number.isFinite(input.actualRevenueIdrBillion) &&
    input.actualEnergySalesGWh > 0
      ? (input.actualRevenueIdrBillion * 1e9) / (input.actualEnergySalesGWh * 1e6)
      : 0;

  const revenueAtActualVolumeModelTariff =
    Number.isFinite(input.actualEnergySalesGWh)
      ? (input.actualEnergySalesGWh * 1e6 * recalculatedModelEffectiveTariffIdrPerKWh) / 1e9
      : Number.NaN;

  const recalculatedVolumeRevenueImpactIdrBillion =
    revenueAtActualVolumeModelTariff - input.modelRevenueIdrBillion;
  const recalculatedTariffMixRevenueImpactIdrBillion =
    input.actualRevenueIdrBillion - revenueAtActualVolumeModelTariff;
  const recalculatedRevenueVarianceIdrBillion =
    input.actualRevenueIdrBillion - input.modelRevenueIdrBillion;
  const revenueBridgeReconciliationIdrBillion =
    result.volumeRevenueImpactIdrBillion +
    result.tariffMixRevenueImpactIdrBillion -
    result.revenueVarianceIdrBillion;

  if (differs(result.modelEffectiveTariffIdrPerKWh, recalculatedModelEffectiveTariffIdrPerKWh, TARIFF_TOLERANCE_IDR_PER_KWH)) {
    issues.push({
      code: 'PIR_MODEL_EFFECTIVE_TARIFF_RECONCILIATION',
      severity: 'error',
      message: 'PIR model effective tariff does not reconcile independently to Model revenue divided by Model Energy Sales.',
    });
  }

  if (differs(result.actualEffectiveTariffIdrPerKWh, recalculatedActualEffectiveTariffIdrPerKWh, TARIFF_TOLERANCE_IDR_PER_KWH)) {
    issues.push({
      code: 'PIR_ACTUAL_EFFECTIVE_TARIFF_RECONCILIATION',
      severity: 'error',
      message: 'PIR Actual effective tariff does not reconcile independently to Actual revenue divided by Actual Energy Sales.',
    });
  }

  if (differs(result.energySalesVarianceGWh, input.actualEnergySalesGWh - input.modelEnergySalesGWh, ENERGY_TOLERANCE_GWH)) {
    issues.push({
      code: 'PIR_ENERGY_VARIANCE_RECONCILIATION',
      severity: 'error',
      message: 'PIR Energy Sales variance does not reconcile to Actual less Model Energy Sales.',
    });
  }

  const expectedEnergyVariancePct =
    input.modelEnergySalesGWh > 0
      ? ((input.actualEnergySalesGWh - input.modelEnergySalesGWh) / input.modelEnergySalesGWh) * 100
      : null;

  if (expectedEnergyVariancePct === null) {
    if (result.energySalesVariancePct !== null) {
      issues.push({
        code: 'PIR_ENERGY_VARIANCE_PCT_UNSOURCED',
        severity: 'error',
        message: 'PIR Energy Sales variance percentage must remain null when the Model Energy Sales denominator is not positive.',
      });
    }
  } else if (
    result.energySalesVariancePct === null ||
    differs(result.energySalesVariancePct, expectedEnergyVariancePct, RATIO_TOLERANCE)
  ) {
    issues.push({
      code: 'PIR_ENERGY_VARIANCE_PCT_RECONCILIATION',
      severity: 'error',
      message: 'PIR Energy Sales variance percentage does not reconcile independently to its Model denominator.',
    });
  }

  if (differs(result.volumeRevenueImpactIdrBillion, recalculatedVolumeRevenueImpactIdrBillion, REVENUE_TOLERANCE_IDR_BILLION)) {
    issues.push({
      code: 'PIR_VOLUME_REVENUE_IMPACT_RECONCILIATION',
      severity: 'error',
      message: 'PIR volume revenue impact does not reconcile to Actual volume valued at the independently re-performed Model effective tariff.',
    });
  }

  if (differs(result.tariffMixRevenueImpactIdrBillion, recalculatedTariffMixRevenueImpactIdrBillion, REVENUE_TOLERANCE_IDR_BILLION)) {
    issues.push({
      code: 'PIR_TARIFF_MIX_REVENUE_IMPACT_RECONCILIATION',
      severity: 'error',
      message: 'PIR tariff/mix revenue impact does not reconcile independently to Actual revenue less revenue at Actual volume using Model effective tariff.',
    });
  }

  if (differs(result.revenueVarianceIdrBillion, recalculatedRevenueVarianceIdrBillion, REVENUE_TOLERANCE_IDR_BILLION)) {
    issues.push({
      code: 'PIR_REVENUE_VARIANCE_RECONCILIATION',
      severity: 'error',
      message: 'PIR revenue variance does not reconcile to Actual revenue less Model revenue.',
    });
  }

  if (
    !Number.isFinite(revenueBridgeReconciliationIdrBillion) ||
    Math.abs(revenueBridgeReconciliationIdrBillion) > REVENUE_TOLERANCE_IDR_BILLION
  ) {
    issues.push({
      code: 'PIR_REVENUE_BRIDGE_IDENTITY',
      severity: 'error',
      message: 'PIR volume impact plus tariff/mix impact does not reconcile to total revenue variance.',
    });
  }

  return {
    passed: !issues.some((issue) => issue.severity === 'error'),
    issues,
    recalculatedModelEffectiveTariffIdrPerKWh,
    recalculatedActualEffectiveTariffIdrPerKWh,
    recalculatedVolumeRevenueImpactIdrBillion,
    recalculatedTariffMixRevenueImpactIdrBillion,
    recalculatedRevenueVarianceIdrBillion,
    revenueBridgeReconciliationIdrBillion,
  };
}
