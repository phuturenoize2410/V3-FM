import type { EnergySalesGovernanceBundle } from './energySalesGovernanceBundle';
import type { PirOperatingPeriodDiagnostics } from './pirOperatingPeriodDiagnostics';

export interface EnergyPirOperatingGovernanceIssue {
  code: string;
  severity: 'error' | 'warning';
  source: 'energy_sales' | 'pir_operating_period';
  message: string;
}

export interface EnergyPirOperatingGovernanceBundle {
  passed: boolean;
  blockingIssueCount: number;
  warningCount: number;
  energySalesGovernance: EnergySalesGovernanceBundle;
  operatingPeriodDiagnostics: PirOperatingPeriodDiagnostics;
  issues: EnergyPirOperatingGovernanceIssue[];
}

/**
 * Read-only electricity-module governance handoff for one PIR operating period.
 *
 * This bundle intentionally sits outside the asset-generic lifecycle/PIR core.
 * It composes two already-authoritative controls without recalculating economics:
 * - governed Energy Sales / effective-tariff output provenance; and
 * - independent PIR operating-period revenue-bridge arithmetic diagnostics.
 *
 * Downstream electricity PIR presentation may only represent the operating-period
 * bridge as governed when both controls pass. This bundle does not:
 * - select or approve Plan / Actual baselines;
 * - establish Actual provenance or lifecycle readiness;
 * - calculate or mutate Energy Sales, tariff, revenue, OPEX, CFADS or DSCR;
 * - infer PPA, EBL, tariff-tier, commitment, escalation or other commercial terms;
 * - convert effective tariff into a commercial entitlement.
 */
export function buildEnergyPirOperatingGovernanceBundle(input: {
  energySalesGovernance: EnergySalesGovernanceBundle;
  operatingPeriodDiagnostics: PirOperatingPeriodDiagnostics;
}): EnergyPirOperatingGovernanceBundle {
  const issues: EnergyPirOperatingGovernanceIssue[] = [];

  for (const issue of input.energySalesGovernance.calculationControls.issues) {
    issues.push({
      code: `ENERGY_${issue.code}`,
      severity: issue.severity,
      source: 'energy_sales',
      message: issue.message,
    });
  }

  for (const issue of input.energySalesGovernance.outputIdentity.issues) {
    issues.push({
      code: `ENERGY_OUTPUT_${issue.code}`,
      severity: issue.severity,
      source: 'energy_sales',
      message: issue.message,
    });
  }

  for (const issue of input.operatingPeriodDiagnostics.issues) {
    issues.push({
      code: issue.code,
      severity: issue.severity,
      source: 'pir_operating_period',
      message: issue.message,
    });
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    passed:
      input.energySalesGovernance.passed &&
      input.operatingPeriodDiagnostics.passed &&
      blockingIssueCount === 0,
    blockingIssueCount,
    warningCount,
    energySalesGovernance: input.energySalesGovernance,
    operatingPeriodDiagnostics: input.operatingPeriodDiagnostics,
    issues,
  };
}
