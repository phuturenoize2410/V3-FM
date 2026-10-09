import type {
  EnergySalesResult,
  PirOperatingPeriodInput,
} from './investmentLifecycleEngine';

export type EnergyPirSourceSide = 'model' | 'actual';
export type EnergyPirSourceIdentitySeverity = 'error' | 'warning';

export interface EnergyPirSourceIdentityIssue {
  readonly code: string;
  readonly severity: EnergyPirSourceIdentitySeverity;
  readonly message: string;
}

export interface EnergyPirSourceIdentityDiagnostics {
  readonly passed: boolean;
  readonly side: EnergyPirSourceSide;
  readonly year: number;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly energySalesGWh: number;
  readonly revenueIdrBillion: number;
  readonly effectiveTariffIdrPerKWh: number;
  readonly pirEnergySalesGWh: number;
  readonly pirRevenueIdrBillion: number;
  readonly pirEffectiveTariffIdrPerKWh: number;
  readonly issues: readonly EnergyPirSourceIdentityIssue[];
}

const ENERGY_TOLERANCE_GWH = 1e-9;
const REVENUE_TOLERANCE_IDR_BILLION = 1e-9;
const TARIFF_TOLERANCE_IDR_PER_KWH = 1e-9;

function differs(a: number, b: number, tolerance: number): boolean {
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance;
}

/**
 * Independently verifies that one already-calculated Energy Sales result is the
 * explicit source population used on a caller-selected side of a PIR operating
 * period.
 *
 * The side is mandatory because this diagnostic must never guess whether a governed
 * electricity result represents the model case or the Actual case. Runtime evidence
 * is therefore fail-closed when a retained/deserialized side token is not exactly
 * `model` or `actual`; an unknown token is never silently treated as Actual.
 * The check is deliberately narrow: Energy Sales volume, revenue and the resulting
 * effective tariff must reconcile to the explicitly supplied PIR period input.
 *
 * Boundary: this diagnostic does not calculate or repair Energy Sales; validate or
 * infer PPA/EBL/tariff-tier/commitment/escalation terms; select Plan/Actual baselines;
 * establish Actual provenance; approve PIR; or change any economics. It is an
 * electricity-module source-identity control only.
 */
export function assessEnergyPirSourceIdentity(input: Readonly<{
  side: EnergyPirSourceSide;
  energySalesResult: EnergySalesResult;
  pirPeriodInput: PirOperatingPeriodInput;
}>): EnergyPirSourceIdentityDiagnostics {
  const issues: EnergyPirSourceIdentityIssue[] = [];
  const result = input.energySalesResult;
  const period = input.pirPeriodInput;
  const sideIsValid = input.side === 'model' || input.side === 'actual';

  if (!sideIsValid) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_SIDE_INVALID',
      severity: 'error',
      message:
        'Energy Sales PIR source side must be exactly model or actual; unknown runtime evidence must not be interpreted as either side.',
    });
  }

  const pirEnergySalesGWh =
    input.side === 'model'
      ? period.modelEnergySalesGWh
      : input.side === 'actual'
        ? period.actualEnergySalesGWh
        : Number.NaN;
  const pirRevenueIdrBillion =
    input.side === 'model'
      ? period.modelRevenueIdrBillion
      : input.side === 'actual'
        ? period.actualRevenueIdrBillion
        : Number.NaN;
  const pirEffectiveTariffIdrPerKWh =
    sideIsValid &&
    Number.isFinite(pirEnergySalesGWh) &&
    Number.isFinite(pirRevenueIdrBillion) &&
    pirEnergySalesGWh > 0
      ? (pirRevenueIdrBillion * 1e9) / (pirEnergySalesGWh * 1e6)
      : sideIsValid
        ? 0
        : Number.NaN;

  if (!Number.isFinite(period.year)) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_YEAR_INVALID',
      severity: 'error',
      message: 'PIR operating-period year must be finite before Energy Sales source identity can be represented as controlled.',
    });
  }

  if (
    sideIsValid &&
    differs(result.energySalesGWh, pirEnergySalesGWh, ENERGY_TOLERANCE_GWH)
  ) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_VOLUME_MISMATCH',
      severity: 'error',
      message: `Governed Energy Sales volume does not match the explicitly supplied ${input.side} PIR Energy Sales input.`,
    });
  }

  if (
    sideIsValid &&
    differs(result.revenueIdrBillion, pirRevenueIdrBillion, REVENUE_TOLERANCE_IDR_BILLION)
  ) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_REVENUE_MISMATCH',
      severity: 'error',
      message: `Governed Energy Sales revenue does not match the explicitly supplied ${input.side} PIR revenue input.`,
    });
  }

  if (
    sideIsValid &&
    differs(
      result.effectiveTariffIdrPerKWh,
      pirEffectiveTariffIdrPerKWh,
      TARIFF_TOLERANCE_IDR_PER_KWH
    )
  ) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_EFFECTIVE_TARIFF_MISMATCH',
      severity: 'error',
      message: `Governed Energy Sales effective tariff does not reconcile to the explicitly supplied ${input.side} PIR volume and revenue.`,
    });
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const frozenIssues = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed: blockingIssueCount === 0,
    side: input.side,
    year: period.year,
    blockingIssueCount,
    warningCount,
    energySalesGWh: result.energySalesGWh,
    revenueIdrBillion: result.revenueIdrBillion,
    effectiveTariffIdrPerKWh: result.effectiveTariffIdrPerKWh,
    pirEnergySalesGWh,
    pirRevenueIdrBillion,
    pirEffectiveTariffIdrPerKWh,
    issues: frozenIssues,
  });
}
