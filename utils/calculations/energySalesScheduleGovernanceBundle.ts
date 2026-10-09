import type {
  EnergySalesContract,
  EnergySalesResult,
} from './investmentLifecycleEngine';
import {
  buildEnergySalesGovernanceBundle,
  type EnergySalesGovernanceBundle,
} from './energySalesGovernanceBundle';

export type EnergySalesScheduleIssueSeverity = 'error' | 'warning';

export interface EnergySalesScheduleIssue {
  code: string;
  severity: EnergySalesScheduleIssueSeverity;
  message: string;
  periodId?: string;
}

export interface EnergySalesSchedulePeriodInput {
  periodId: string;
  sourceReference: string;
  sourceEnergySalesGWh: number;
  contract: EnergySalesContract;
  result: EnergySalesResult;
}

export interface EnergySalesSchedulePeriodGovernance {
  periodId: string;
  sourceReference: string;
  governance: EnergySalesGovernanceBundle;
}

export interface EnergySalesScheduleGovernanceBundle {
  passed: boolean;
  periodCount: number;
  governedPeriodCount: number;
  blockingIssueCount: number;
  warningCount: number;
  totalEnergySalesGWh: number;
  totalRevenueIdrBillion: number;
  portfolioEffectiveTariffIdrPerKWh: number;
  periods: EnergySalesSchedulePeriodGovernance[];
  issues: EnergySalesScheduleIssue[];
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Read-only schedule governance for Energy Sales / effective-tariff results.
 *
 * The single-period calculation and commercial-term controls remain authoritative
 * in `energySalesGovernanceBundle.ts`. This layer only binds an explicit period
 * population into one governed schedule so downstream PIR/reporting consumers do
 * not silently combine duplicate periods, unsourced period rows or individually
 * blocked Energy Sales results.
 *
 * Boundaries:
 * - period IDs and source references are caller-supplied evidence; none are invented;
 * - no tariff, tier, escalation, PPA/EBL commitment or commercial term is inferred;
 * - no period result is recalculated or mutated;
 * - the aggregate effective tariff is a transparent arithmetic summary of the
 *   supplied governed period population, not a replacement commercial term;
 * - this module remains electricity-specific and does not alter the asset-generic
 *   investment lifecycle core.
 */
export function buildEnergySalesScheduleGovernanceBundle(
  inputs: EnergySalesSchedulePeriodInput[]
): EnergySalesScheduleGovernanceBundle {
  const issues: EnergySalesScheduleIssue[] = [];
  const periods: EnergySalesSchedulePeriodGovernance[] = [];
  const seenPeriodIds = new Set<string>();

  for (const input of inputs) {
    const normalizedPeriodId = normalizeIdentity(input.periodId);
    const sourceReference = input.sourceReference.trim();

    if (!normalizedPeriodId) {
      issues.push({
        code: 'ENERGY_SCHEDULE_PERIOD_ID_MISSING',
        severity: 'error',
        message: 'Each Energy Sales schedule row requires an explicit period ID.',
      });
    } else if (seenPeriodIds.has(normalizedPeriodId)) {
      issues.push({
        code: 'ENERGY_SCHEDULE_PERIOD_ID_DUPLICATE',
        severity: 'error',
        periodId: input.periodId,
        message: `Energy Sales period ${input.periodId} is duplicated in the governed schedule population.`,
      });
    } else {
      seenPeriodIds.add(normalizedPeriodId);
    }

    if (!sourceReference) {
      issues.push({
        code: 'ENERGY_SCHEDULE_SOURCE_REFERENCE_MISSING',
        severity: 'error',
        periodId: input.periodId || undefined,
        message: 'Each Energy Sales schedule row requires an explicit source reference.',
      });
    }

    const governance = buildEnergySalesGovernanceBundle(
      input.sourceEnergySalesGWh,
      input.contract,
      input.result
    );

    if (!governance.passed) {
      issues.push({
        code: 'ENERGY_SCHEDULE_PERIOD_GOVERNANCE_BLOCKED',
        severity: 'error',
        periodId: input.periodId || undefined,
        message: `Energy Sales period ${input.periodId || '<unidentified>'} is blocked by its underlying calculation, output-identity or commercial-term controls.`,
      });
    }

    periods.push({
      periodId: input.periodId,
      sourceReference,
      governance,
    });
  }

  const totalEnergySalesGWh = inputs.reduce(
    (sum, input) => sum + input.result.energySalesGWh,
    0
  );
  const totalRevenueIdrBillion = inputs.reduce(
    (sum, input) => sum + input.result.revenueIdrBillion,
    0
  );

  if (!Number.isFinite(totalEnergySalesGWh) || !Number.isFinite(totalRevenueIdrBillion)) {
    issues.push({
      code: 'ENERGY_SCHEDULE_AGGREGATE_NON_FINITE',
      severity: 'error',
      message: 'Energy Sales schedule aggregates are non-finite; the period population cannot be represented as a governed schedule.',
    });
  }

  const portfolioEffectiveTariffIdrPerKWh =
    Number.isFinite(totalEnergySalesGWh) &&
    Number.isFinite(totalRevenueIdrBillion) &&
    totalEnergySalesGWh > 0
      ? (totalRevenueIdrBillion * 1e9) / (totalEnergySalesGWh * 1e6)
      : 0;

  const periodBlockingIssueCount = periods.reduce(
    (sum, period) => sum + period.governance.blockingIssueCount,
    0
  );
  const periodWarningCount = periods.reduce(
    (sum, period) => sum + period.governance.warningCount,
    0
  );
  const scheduleBlockingIssueCount = issues.filter(
    (issue) => issue.severity === 'error'
  ).length;
  const scheduleWarningCount = issues.filter(
    (issue) => issue.severity === 'warning'
  ).length;
  const blockingIssueCount = periodBlockingIssueCount + scheduleBlockingIssueCount;
  const warningCount = periodWarningCount + scheduleWarningCount;
  const governedPeriodCount = periods.filter((period) => period.governance.passed).length;

  return {
    passed:
      inputs.length > 0 &&
      governedPeriodCount === inputs.length &&
      blockingIssueCount === 0,
    periodCount: inputs.length,
    governedPeriodCount,
    blockingIssueCount,
    warningCount,
    totalEnergySalesGWh,
    totalRevenueIdrBillion,
    portfolioEffectiveTariffIdrPerKWh,
    periods,
    issues,
  };
}
