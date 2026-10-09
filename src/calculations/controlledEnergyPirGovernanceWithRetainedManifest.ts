import type { PirGovernanceBundleWithRetainedManifest } from './pirGovernanceBundleWithRetainedManifest';
import type { ControlledEnergyPirOperatingGovernance } from './controlledEnergyPirOperatingGovernance';

export interface ControlledEnergyPirGovernanceWithRetainedManifestIssue {
  code: string;
  severity: 'error' | 'warning';
  source: 'pir_governance' | 'energy_operating_period';
  year?: number;
  message: string;
}

export interface ControlledEnergyPirGovernanceWithRetainedManifest {
  ready: boolean;
  periodsEvaluated: number;
  passedPeriods: number;
  failedPeriods: number;
  blockingIssueCount: number;
  warningCount: number;
  pirGovernance: PirGovernanceBundleWithRetainedManifest;
  operatingPeriods: ControlledEnergyPirOperatingGovernance[];
  issues: ControlledEnergyPirGovernanceWithRetainedManifestIssue[];
}

/**
 * Strongest electricity-module PIR handoff when asset-generic PIR governance is
 * already bound to controlled Actual evidence, an exact Mapping Master snapshot,
 * and an independently retained Actual release manifest, while explicit electricity
 * operating periods have already passed Energy Sales/effective-tariff source identity
 * and PIR operating-period arithmetic controls.
 *
 * This wrapper deliberately composes authoritative upstream results rather than
 * rebuilding their calculations, provenance rules or commercial logic. It keeps the
 * lifecycle/PIR finance core asset-generic while requiring electricity-specific
 * operating evidence before an electricity PIR consumer may represent the combined
 * handoff as ready.
 *
 * Boundary: this function is read-only and fail-closed. It does not authenticate or
 * persist external evidence; import, map, repair or reclassify Actuals; create,
 * approve, supersede or select baselines; calculate PIR economics; calculate or
 * repair Energy Sales, tariff, revenue, OPEX, CFADS or DSCR; or infer PPA, EBL,
 * tariff-tier, commitment, escalation, entitlement or any other commercial term.
 * Passing this structural control is not cryptographic attestation of an external
 * evidence store.
 */
export function buildControlledEnergyPirGovernanceWithRetainedManifest(input: {
  pirGovernance: PirGovernanceBundleWithRetainedManifest;
  operatingPeriods: ControlledEnergyPirOperatingGovernance[];
}): ControlledEnergyPirGovernanceWithRetainedManifest {
  const issues: ControlledEnergyPirGovernanceWithRetainedManifestIssue[] = [];

  for (const reason of input.pirGovernance.blockingReasons) {
    issues.push({
      code: 'PIR_GOVERNANCE_BLOCKED',
      severity: 'error',
      source: 'pir_governance',
      message: reason,
    });
  }

  const yearCounts = new Map<number, number>();
  for (const period of input.operatingPeriods) {
    yearCounts.set(period.year, (yearCounts.get(period.year) ?? 0) + 1);

    for (const issue of period.issues) {
      issues.push({
        code: issue.code,
        severity: issue.severity,
        source: 'energy_operating_period',
        year: period.year,
        message: issue.message,
      });
    }

    if (!period.ready && !period.issues.some((issue) => issue.severity === 'error')) {
      issues.push({
        code: 'ENERGY_PIR_PERIOD_NOT_READY',
        severity: 'error',
        source: 'energy_operating_period',
        year: period.year,
        message: 'Electricity PIR operating-period governance is not ready despite having no blocking upstream issue.',
      });
    }
  }

  for (const [year, count] of yearCounts) {
    if (count > 1) {
      issues.push({
        code: 'ENERGY_PIR_DUPLICATE_YEAR',
        severity: 'error',
        source: 'energy_operating_period',
        year,
        message: `Electricity PIR governance received ${count} controlled operating-period rows for year ${year}; annual PIR schedule identity is ambiguous.`,
      });
    }
  }

  if (input.operatingPeriods.length === 0) {
    issues.push({
      code: 'ENERGY_PIR_NO_OPERATING_PERIODS',
      severity: 'error',
      source: 'energy_operating_period',
      message: 'Electricity PIR governance requires at least one explicitly controlled operating period.',
    });
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const passedPeriods = input.operatingPeriods.filter((period) => period.ready).length;

  return {
    ready:
      input.pirGovernance.ready &&
      input.operatingPeriods.length > 0 &&
      passedPeriods === input.operatingPeriods.length &&
      blockingIssueCount === 0,
    periodsEvaluated: input.operatingPeriods.length,
    passedPeriods,
    failedPeriods: input.operatingPeriods.length - passedPeriods,
    blockingIssueCount,
    warningCount,
    pirGovernance: input.pirGovernance,
    operatingPeriods: input.operatingPeriods,
    issues,
  };
}
