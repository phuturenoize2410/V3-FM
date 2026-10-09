import type { EnergySalesContract, TariffTier } from './investmentLifecycleEngine';

export type EnergySalesCommercialTermSeverity = 'error' | 'warning';

export interface EnergySalesCommercialTermIssue {
  code: string;
  severity: EnergySalesCommercialTermSeverity;
  message: string;
  tierId?: string;
}

export interface EnergySalesCommercialTermDiagnostics {
  passed: boolean;
  blockingIssueCount: number;
  warningCount: number;
  issues: EnergySalesCommercialTermIssue[];
}

function isRuntimeObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function runtimeTierId(tier: TariffTier): string | undefined {
  return typeof tier.id === 'string' ? tier.id : undefined;
}

/**
 * Validates whether the commercial definition consumed by Energy Sales is explicit
 * enough to be represented as governed evidence.
 *
 * This diagnostic deliberately does not change the underlying calculation. The
 * legacy calculator currently uses zero escalation when no escalation is supplied;
 * this layer prevents that mechanical fallback from being confused with an
 * explicitly approved fixed-tariff commercial term.
 *
 * Governance boundaries:
 * - no escalation, tariff, tier, commitment, PPA or EBL term is invented;
 * - explicit 0% escalation remains valid and distinguishable from an omitted term;
 * - a flat tariff supplied alongside tariff tiers is surfaced as ambiguous/unused
 *   metadata rather than silently represented as part of the governed tier result;
 * - retained/deserialized commercial evidence fails closed when the contract,
 *   tariff-tier population or an individual tier row no longer matches its runtime
 *   envelope; malformed evidence is never reinterpreted as a valid flat contract;
 * - electricity-specific commercial governance remains isolated from the
 *   asset-generic investment lifecycle core.
 */
export function assessEnergySalesCommercialTerms(
  contract: EnergySalesContract
): EnergySalesCommercialTermDiagnostics {
  const issues: EnergySalesCommercialTermIssue[] = [];
  const runtimeContract = contract as unknown;

  if (!isRuntimeObject(runtimeContract)) {
    issues.push({
      code: 'ENERGY_CONTRACT_EVIDENCE_INVALID',
      severity: 'error',
      message: 'Energy Sales commercial evidence must be supplied as a contract object.',
    });

    return {
      passed: false,
      blockingIssueCount: 1,
      warningCount: 0,
      issues,
    };
  }

  const rawTiers = runtimeContract.tiers;
  const tierPopulationSupplied = rawTiers !== undefined;
  const tierPopulationValid = !tierPopulationSupplied || Array.isArray(rawTiers);

  if (!tierPopulationValid) {
    issues.push({
      code: 'ENERGY_TIER_POPULATION_INVALID',
      severity: 'error',
      message: 'Tariff-tier evidence must be an array when supplied; malformed evidence cannot be treated as a flat-tariff contract.',
    });
  }

  const tierPopulation = Array.isArray(rawTiers) ? rawTiers : [];
  const tiers: TariffTier[] = [];

  tierPopulation.forEach((tier, index) => {
    if (!isRuntimeObject(tier)) {
      issues.push({
        code: 'ENERGY_TIER_EVIDENCE_INVALID',
        severity: 'error',
        message: `Tariff-tier evidence at index ${index} must be an object.`,
      });
      return;
    }

    tiers.push(tier as unknown as TariffTier);
  });

  if (tierPopulationValid && tierPopulation.length === 0) {
    if (
      runtimeContract.flatTariffIdrPerKWh !== undefined &&
      runtimeContract.annualEscalationPct === undefined
    ) {
      issues.push({
        code: 'ENERGY_FLAT_ESCALATION_UNSPECIFIED',
        severity: 'error',
        message:
          'Flat-tariff escalation is not explicitly supplied. Use an explicit 0% only when the governed commercial term is fixed with no escalation.',
      });
    }
  } else if (tierPopulation.length > 0) {
    if (runtimeContract.flatTariffIdrPerKWh !== undefined) {
      issues.push({
        code: 'ENERGY_FLAT_TARIFF_UNUSED_WITH_TIERS',
        severity: 'warning',
        message:
          'A flat tariff is supplied together with tariff tiers. Tiered calculation takes precedence, so confirm whether the flat tariff is intentionally retained as non-operative metadata.',
      });
    }

    for (const tier of tiers) {
      if (
        tier.annualEscalationPct === undefined &&
        runtimeContract.annualEscalationPct === undefined
      ) {
        const tierId = runtimeTierId(tier);
        issues.push({
          code: 'ENERGY_TIER_ESCALATION_UNSPECIFIED',
          severity: 'error',
          tierId,
          message:
            `Tariff tier ${tierId || '<unnamed>'} has no explicit tier or contract escalation term. Use an explicit 0% only when the governed commercial term is fixed with no escalation.`,
        });
      }
    }
  }

  const blockingIssueCount = issues.filter(
    (issue) => issue.severity === 'error'
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === 'warning'
  ).length;

  return {
    passed: blockingIssueCount === 0,
    blockingIssueCount,
    warningCount,
    issues,
  };
}
