import type { EnergySalesGovernanceBundle } from './energySalesGovernanceBundle';
import type { EnergyPirSourceIdentityDiagnostics } from './energyPirSourceIdentityDiagnostics';
import type { PirOperatingPeriodControlledRow } from './pirOperatingPeriodControlBundle';

export interface ControlledEnergyPirOperatingGovernanceIssue {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly source: 'energy_sales' | 'energy_pir_source_identity' | 'pir_operating_period_control';
  readonly message: string;
}

export interface ControlledEnergyPirOperatingGovernance {
  readonly ready: boolean;
  readonly year: number;
  readonly side: EnergyPirSourceIdentityDiagnostics['side'];
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly energySalesGovernance: EnergySalesGovernanceBundle;
  readonly sourceIdentity: EnergyPirSourceIdentityDiagnostics;
  readonly operatingPeriodControl: PirOperatingPeriodControlledRow;
  readonly issues: readonly ControlledEnergyPirOperatingGovernanceIssue[];
}

const ENERGY_TOLERANCE_GWH = 1e-9;
const REVENUE_TOLERANCE_IDR_BILLION = 1e-9;
const TARIFF_TOLERANCE_IDR_PER_KWH = 1e-9;

function differs(a: number, b: number, tolerance: number): boolean {
  return !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > tolerance;
}

/**
 * Preferred electricity-module governance handoff for one controlled PIR operating period.
 *
 * This wrapper composes:
 * - authoritative Energy Sales / effective-tariff governance;
 * - explicit Energy Sales -> PIR source-identity diagnostics for a caller-selected
 *   model or Actual side; and
 * - a PIR operating-period control row that has already proven explicit input/result
 *   identity plus independent arithmetic re-performance.
 *
 * The additional source-identity layer prevents a governed Energy Sales result from
 * being treated as the source of a PIR period merely because both upstream controls
 * pass independently. The caller must explicitly identify whether the Energy Sales
 * evidence feeds the model or Actual side, and that evidence must reconcile to the
 * same controlled PIR year. Readiness also cross-checks the source-identity amounts
 * against the retained Energy Sales calculation-control totals so downstream
 * composition cannot silently pair source identity from a different Energy Sales run.
 *
 * It is intentionally module-specific. The asset-generic lifecycle/PIR core remains
 * unaware of electricity assumptions and commercial constructs.
 *
 * It returns immutable governance evidence while retaining the exact caller-supplied
 * upstream evidence references; this wrapper does not mutate or deep-freeze them.
 *
 * This wrapper does not:
 * - calculate or repair Energy Sales, tariff, revenue, OPEX, CFADS or DSCR;
 * - establish Actual provenance, baseline approval or PIR release readiness;
 * - select Plan / Actual baselines;
 * - infer PPA, EBL, tariff-tier, commitment, escalation or other commercial terms;
 * - reinterpret effective tariff as a commercial entitlement;
 * - claim persisted-record or cryptographic identity across external evidence stores.
 */
export function buildControlledEnergyPirOperatingGovernance(input: Readonly<{
  energySalesGovernance: EnergySalesGovernanceBundle;
  sourceIdentity: EnergyPirSourceIdentityDiagnostics;
  operatingPeriodControl: PirOperatingPeriodControlledRow;
}>): ControlledEnergyPirOperatingGovernance {
  const issues: ControlledEnergyPirOperatingGovernanceIssue[] = [];

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

  for (const issue of input.energySalesGovernance.commercialTerms.issues) {
    issues.push({
      code: `ENERGY_COMMERCIAL_${issue.code}`,
      severity: issue.severity,
      source: 'energy_sales',
      message: issue.message,
    });
  }

  for (const issue of input.sourceIdentity.issues) {
    issues.push({
      code: issue.code,
      severity: issue.severity,
      source: 'energy_pir_source_identity',
      message: issue.message,
    });
  }

  if (input.sourceIdentity.year !== input.operatingPeriodControl.year) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_CONTROL_YEAR_MISMATCH',
      severity: 'error',
      source: 'energy_pir_source_identity',
      message: 'Energy Sales source identity and controlled PIR operating-period evidence refer to different years.',
    });
  }

  const controls = input.energySalesGovernance.calculationControls;
  if (
    differs(
      input.sourceIdentity.energySalesGWh,
      controls.allocatedEnergyGWh,
      ENERGY_TOLERANCE_GWH
    )
  ) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_GOVERNANCE_VOLUME_MISMATCH',
      severity: 'error',
      source: 'energy_pir_source_identity',
      message: 'Energy Sales source identity volume does not reconcile to the retained governed Energy Sales allocation total.',
    });
  }

  if (
    differs(
      input.sourceIdentity.revenueIdrBillion,
      controls.tierRevenueSumIdrBillion,
      REVENUE_TOLERANCE_IDR_BILLION
    )
  ) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_GOVERNANCE_REVENUE_MISMATCH',
      severity: 'error',
      source: 'energy_pir_source_identity',
      message: 'Energy Sales source identity revenue does not reconcile to the retained governed tariff-bucket revenue total.',
    });
  }

  if (
    differs(
      input.sourceIdentity.effectiveTariffIdrPerKWh,
      controls.recalculatedEffectiveTariffIdrPerKWh,
      TARIFF_TOLERANCE_IDR_PER_KWH
    )
  ) {
    issues.push({
      code: 'ENERGY_PIR_SOURCE_GOVERNANCE_EFFECTIVE_TARIFF_MISMATCH',
      severity: 'error',
      source: 'energy_pir_source_identity',
      message: 'Energy Sales source identity effective tariff does not reconcile to the retained governed Energy Sales arithmetic.',
    });
  }

  for (const issue of input.operatingPeriodControl.issues) {
    issues.push({
      code: issue.code,
      severity: issue.severity,
      source: 'pir_operating_period_control',
      message: issue.message,
    });
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const frozenIssues = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    ready:
      input.energySalesGovernance.passed &&
      input.sourceIdentity.passed &&
      input.operatingPeriodControl.passed &&
      input.operatingPeriodControl.inputIdentityPassed &&
      blockingIssueCount === 0,
    year: input.operatingPeriodControl.year,
    side: input.sourceIdentity.side,
    blockingIssueCount,
    warningCount,
    energySalesGovernance: input.energySalesGovernance,
    sourceIdentity: input.sourceIdentity,
    operatingPeriodControl: input.operatingPeriodControl,
    issues: frozenIssues,
  });
}
