import type {
  EnergySalesContract,
  EnergySalesResult,
  TariffTier,
} from './investmentLifecycleEngine';

export type EnergySalesControlSeverity = 'error' | 'warning';

export interface EnergySalesControlIssue {
  code: string;
  severity: EnergySalesControlSeverity;
  message: string;
  tierId?: string;
}

export interface EnergySalesControlResult {
  passed: boolean;
  issues: EnergySalesControlIssue[];
  allocatedEnergyGWh: number;
  unallocatedEnergyGWh: number;
  overallocatedEnergyGWh: number;
  tierRevenueSumIdrBillion: number;
  revenueReconciliationIdrBillion: number;
  recalculatedEffectiveTariffIdrPerKWh: number;
  effectiveTariffReconciliationIdrPerKWh: number;
}

const ENERGY_TOLERANCE_GWH = 1e-9;
const REVENUE_TOLERANCE_IDR_BILLION = 1e-9;
const TARIFF_TOLERANCE_IDR_PER_KWH = 1e-9;

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isRuntimeObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function failClosedControlResult(
  issues: EnergySalesControlIssue[]
): EnergySalesControlResult {
  return {
    passed: false,
    issues,
    allocatedEnergyGWh: Number.NaN,
    unallocatedEnergyGWh: Number.NaN,
    overallocatedEnergyGWh: Number.NaN,
    tierRevenueSumIdrBillion: Number.NaN,
    revenueReconciliationIdrBillion: Number.NaN,
    recalculatedEffectiveTariffIdrPerKWh: Number.NaN,
    effectiveTariffReconciliationIdrPerKWh: Number.NaN,
  };
}

function runtimeTierId(tier: TariffTier): string | null {
  return typeof tier.id === 'string' ? tier.id : null;
}

function validateTier(tier: TariffTier, issues: EnergySalesControlIssue[]): void {
  const tierId = runtimeTierId(tier);
  const tierLabel = tierId && tierId.trim() ? tierId : '<unnamed>';

  if (tierId === null) {
    issues.push({
      code: 'ENERGY_TIER_ID_INVALID',
      severity: 'error',
      message: 'Tariff tier ID must be runtime string evidence.',
    });
  } else if (!tierId.trim()) {
    issues.push({
      code: 'ENERGY_TIER_ID_MISSING',
      severity: 'error',
      message: 'Tariff tier ID must be explicit and non-empty.',
    });
  }

  if (!isFiniteNonNegative(tier.fromGWh)) {
    issues.push({
      code: 'ENERGY_TIER_FROM_INVALID',
      severity: 'error',
      tierId: tierId ?? undefined,
      message: `Tier ${tierLabel} has an invalid lower energy bound.`,
    });
  }

  if (tier.toGWh !== undefined) {
    if (!isFiniteNonNegative(tier.toGWh) || tier.toGWh <= tier.fromGWh) {
      issues.push({
        code: 'ENERGY_TIER_TO_INVALID',
        severity: 'error',
        tierId: tierId ?? undefined,
        message: `Tier ${tierLabel} must have an upper bound greater than its lower bound.`,
      });
    }
  }

  if (!isFiniteNonNegative(tier.tariffIdrPerKWh)) {
    issues.push({
      code: 'ENERGY_TIER_TARIFF_INVALID',
      severity: 'error',
      tierId: tierId ?? undefined,
      message: `Tier ${tierLabel} has an invalid tariff.`,
    });
  }

  if (
    tier.annualEscalationPct !== undefined &&
    !Number.isFinite(tier.annualEscalationPct)
  ) {
    issues.push({
      code: 'ENERGY_TIER_ESCALATION_INVALID',
      severity: 'error',
      tierId: tierId ?? undefined,
      message: `Tier ${tierLabel} has a non-finite escalation rate.`,
    });
  }
}

/**
 * Independently assesses Energy Sales / effective-tariff calculation controls.
 *
 * This function deliberately does not repair, infer or normalize commercial terms.
 * A gap, overlap, missing flat tariff or inconsistent allocation is surfaced to the
 * caller so the contract structure can be resolved explicitly before central-model use.
 * Runtime contract/result/tier envelopes are validated before nested access so retained
 * or deserialized evidence fails closed instead of throwing or being reinterpreted as a
 * valid flat-tariff contract. No malformed evidence is coerced into calculation inputs.
 * Runtime bucket scalar evidence is also validated before aggregate reconciliation so
 * malformed retained values cannot enter arithmetic or be converted into misleading
 * reconciliation diagnostics.
 */
export function assessEnergySalesControls(
  sourceEnergySalesGWh: number,
  contract: EnergySalesContract,
  result: EnergySalesResult
): EnergySalesControlResult {
  const issues: EnergySalesControlIssue[] = [];

  if (!isFiniteNonNegative(sourceEnergySalesGWh)) {
    issues.push({
      code: 'ENERGY_SALES_INPUT_INVALID',
      severity: 'error',
      message: 'Energy Sales input must be finite and non-negative; calculation clamping must not hide invalid source data.',
    });
  }

  const runtimeContract = contract as unknown;
  const runtimeResult = result as unknown;

  if (!isRuntimeObject(runtimeContract)) {
    issues.push({
      code: 'ENERGY_CONTRACT_ENVELOPE_INVALID',
      severity: 'error',
      message: 'Energy Sales contract evidence must remain an inspectable object envelope before calculation controls run.',
    });
  }

  if (!isRuntimeObject(runtimeResult)) {
    issues.push({
      code: 'ENERGY_RESULT_ENVELOPE_INVALID',
      severity: 'error',
      message: 'Energy Sales result evidence must remain an inspectable object envelope before calculation controls run.',
    });
  }

  if (!isRuntimeObject(runtimeContract) || !isRuntimeObject(runtimeResult)) {
    return failClosedControlResult(issues);
  }

  const controlledContract = runtimeContract as unknown as EnergySalesContract & { tiers?: unknown };
  const controlledResult = runtimeResult as unknown as EnergySalesResult;
  const rawTiers = controlledContract.tiers;

  if (rawTiers !== undefined && !Array.isArray(rawTiers)) {
    issues.push({
      code: 'ENERGY_TIER_POPULATION_INVALID',
      severity: 'error',
      message: 'Tariff-tier evidence must be an array when supplied; malformed evidence cannot be treated as a flat-tariff contract.',
    });
    return failClosedControlResult(issues);
  }

  const tierPopulation = Array.isArray(rawTiers) ? rawTiers : [];
  const malformedTierIndexes: number[] = [];
  const tiers: TariffTier[] = [];

  tierPopulation.forEach((tier, index) => {
    if (!isRuntimeObject(tier)) {
      malformedTierIndexes.push(index);
      return;
    }
    tiers.push(tier as unknown as TariffTier);
  });

  if (malformedTierIndexes.length > 0) {
    malformedTierIndexes.forEach((index) => {
      issues.push({
        code: 'ENERGY_TIER_EVIDENCE_INVALID',
        severity: 'error',
        message: `Tariff-tier evidence at index ${index} must remain an inspectable object envelope.`,
      });
    });
    return failClosedControlResult(issues);
  }

  const runtimeTierEnergy = controlledResult.tierEnergyGWh as unknown;
  const runtimeTierRevenue = controlledResult.tierRevenueIdrBillion as unknown;

  if (!isRuntimeObject(runtimeTierEnergy)) {
    issues.push({
      code: 'ENERGY_TIER_OUTPUT_POPULATION_INVALID',
      severity: 'error',
      message: 'Calculated tariff-bucket energy evidence must remain an inspectable object population.',
    });
  }

  if (!isRuntimeObject(runtimeTierRevenue)) {
    issues.push({
      code: 'ENERGY_TIER_REVENUE_POPULATION_INVALID',
      severity: 'error',
      message: 'Calculated tariff-bucket revenue evidence must remain an inspectable object population.',
    });
  }

  if (!isRuntimeObject(runtimeTierEnergy) || !isRuntimeObject(runtimeTierRevenue)) {
    return failClosedControlResult(issues);
  }

  if (!isFiniteNonNegative(controlledResult.energySalesGWh)) {
    issues.push({
      code: 'ENERGY_SALES_OUTPUT_INVALID',
      severity: 'error',
      message: 'Calculated Energy Sales must be finite and non-negative.',
    });
  } else if (
    isFiniteNonNegative(sourceEnergySalesGWh) &&
    Math.abs(controlledResult.energySalesGWh - sourceEnergySalesGWh) > ENERGY_TOLERANCE_GWH
  ) {
    issues.push({
      code: 'ENERGY_SALES_SOURCE_RECONCILIATION',
      severity: 'error',
      message: 'Calculated Energy Sales does not reconcile to the valid source Energy Sales input.',
    });
  }

  if (
    controlledContract.committedEnergyGWh !== undefined &&
    !isFiniteNonNegative(controlledContract.committedEnergyGWh)
  ) {
    issues.push({
      code: 'ENERGY_COMMITMENT_INVALID',
      severity: 'error',
      message: 'Committed energy must be finite and non-negative when supplied.',
    });
  }

  if (
    controlledContract.committedEnergyGWh !== undefined &&
    isFiniteNonNegative(controlledContract.committedEnergyGWh)
  ) {
    if (
      controlledResult.committedEnergyGWh === null ||
      Math.abs(controlledResult.committedEnergyGWh - controlledContract.committedEnergyGWh) > ENERGY_TOLERANCE_GWH
    ) {
      issues.push({
        code: 'ENERGY_COMMITMENT_RECONCILIATION',
        severity: 'error',
        message: 'Reported committed energy does not reconcile to the supplied contract commitment.',
      });
    }

    const expectedCommitmentVariance = controlledResult.energySalesGWh - controlledContract.committedEnergyGWh;
    if (
      controlledResult.commitmentVarianceGWh === null ||
      !Number.isFinite(controlledResult.commitmentVarianceGWh) ||
      Math.abs(controlledResult.commitmentVarianceGWh - expectedCommitmentVariance) > ENERGY_TOLERANCE_GWH
    ) {
      issues.push({
        code: 'ENERGY_COMMITMENT_VARIANCE_RECONCILIATION',
        severity: 'error',
        message: 'Commitment variance does not reconcile to Energy Sales less committed energy.',
      });
    }
  } else if (
    controlledContract.committedEnergyGWh === undefined &&
    (controlledResult.committedEnergyGWh !== null || controlledResult.commitmentVarianceGWh !== null)
  ) {
    issues.push({
      code: 'ENERGY_COMMITMENT_UNSOURCED_OUTPUT',
      severity: 'error',
      message: 'Commitment outputs are populated even though no contract commitment was supplied.',
    });
  }

  if (
    controlledContract.annualEscalationPct !== undefined &&
    !Number.isFinite(controlledContract.annualEscalationPct)
  ) {
    issues.push({
      code: 'ENERGY_ESCALATION_INVALID',
      severity: 'error',
      message: 'Contract escalation must be finite when supplied.',
    });
  }

  if (tiers.length === 0) {
    if (controlledContract.flatTariffIdrPerKWh === undefined) {
      issues.push({
        code: 'ENERGY_FLAT_TARIFF_MISSING',
        severity: 'error',
        message: 'No tariff tiers are supplied and the flat tariff is undefined; a zero tariff must not be inferred.',
      });
    } else if (!isFiniteNonNegative(controlledContract.flatTariffIdrPerKWh)) {
      issues.push({
        code: 'ENERGY_FLAT_TARIFF_INVALID',
        severity: 'error',
        message: 'Flat tariff must be finite and non-negative.',
      });
    }
  } else {
    const seenIds = new Set<string>();
    for (const tier of tiers) {
      validateTier(tier, issues);
      const tierId = runtimeTierId(tier);
      const normalizedId = tierId === null ? '' : tierId.trim().toLowerCase();
      if (normalizedId && seenIds.has(normalizedId)) {
        issues.push({
          code: 'ENERGY_TIER_ID_DUPLICATE',
          severity: 'error',
          tierId: tierId ?? undefined,
          message: `Tariff tier ID ${tierId} is duplicated.`,
        });
      }
      if (normalizedId) seenIds.add(normalizedId);
    }

    const validBounds = tiers
      .filter(
        (tier) =>
          isFiniteNonNegative(tier.fromGWh) &&
          (tier.toGWh === undefined ||
            (isFiniteNonNegative(tier.toGWh) && tier.toGWh > tier.fromGWh))
      )
      .sort((a, b) => a.fromGWh - b.fromGWh);

    for (let index = 1; index < validBounds.length; index += 1) {
      const previous = validBounds[index - 1];
      const current = validBounds[index];
      const previousUpper = previous.toGWh ?? Number.POSITIVE_INFINITY;
      const previousId = runtimeTierId(previous) ?? '<unnamed>';
      const currentId = runtimeTierId(current) ?? '<unnamed>';

      if (current.fromGWh < previousUpper) {
        issues.push({
          code: 'ENERGY_TIER_OVERLAP',
          severity: 'error',
          tierId: runtimeTierId(current) ?? undefined,
          message: `Tariff tier ${currentId} overlaps the preceding tier ${previousId}; overlapping volume would be double-counted.`,
        });
      } else if (current.fromGWh > previousUpper) {
        issues.push({
          code: 'ENERGY_TIER_GAP',
          severity: 'warning',
          tierId: runtimeTierId(current) ?? undefined,
          message: `There is an uncovered energy interval between tiers ${previousId} and ${currentId}.`,
        });
      }
    }
  }

  let bucketOutputEvidenceInvalid = false;

  for (const [tierId, energyGWh] of Object.entries(controlledResult.tierEnergyGWh)) {
    if (!isFiniteNonNegative(energyGWh)) {
      bucketOutputEvidenceInvalid = true;
      issues.push({
        code: 'ENERGY_TIER_OUTPUT_INVALID',
        severity: 'error',
        tierId,
        message: `Calculated energy allocation for tariff bucket ${tierId} must be finite and non-negative.`,
      });
    }
  }

  for (const [tierId, revenueIdrBillion] of Object.entries(controlledResult.tierRevenueIdrBillion)) {
    if (!isFiniteNonNegative(revenueIdrBillion)) {
      bucketOutputEvidenceInvalid = true;
      issues.push({
        code: 'ENERGY_TIER_REVENUE_OUTPUT_INVALID',
        severity: 'error',
        tierId,
        message: `Calculated revenue for tariff bucket ${tierId} must be finite and non-negative.`,
      });
    }
  }

  if (!isFiniteNonNegative(controlledResult.revenueIdrBillion)) {
    issues.push({
      code: 'ENERGY_REVENUE_OUTPUT_INVALID',
      severity: 'error',
      message: 'Calculated Energy Sales revenue must be finite and non-negative.',
    });
  } else if (
    isFiniteNonNegative(controlledResult.energySalesGWh) &&
    controlledResult.energySalesGWh <= ENERGY_TOLERANCE_GWH &&
    controlledResult.revenueIdrBillion > REVENUE_TOLERANCE_IDR_BILLION
  ) {
    issues.push({
      code: 'ENERGY_ZERO_VOLUME_NONZERO_REVENUE',
      severity: 'error',
      message: 'Energy Sales revenue cannot be positive when the reconciled Energy Sales volume is zero; effective tariff would otherwise be economically undefined.',
    });
  }

  if (!isFiniteNonNegative(controlledResult.effectiveTariffIdrPerKWh)) {
    issues.push({
      code: 'ENERGY_EFFECTIVE_TARIFF_OUTPUT_INVALID',
      severity: 'error',
      message: 'Calculated effective tariff must be finite and non-negative.',
    });
  }

  if (bucketOutputEvidenceInvalid) {
    return failClosedControlResult(issues);
  }

  const allocatedEnergyGWh = Object.values(controlledResult.tierEnergyGWh).reduce(
    (sum, value) => sum + value,
    0
  );
  const unallocatedEnergyGWh = Math.max(0, controlledResult.energySalesGWh - allocatedEnergyGWh);
  const overallocatedEnergyGWh = Math.max(0, allocatedEnergyGWh - controlledResult.energySalesGWh);

  if (unallocatedEnergyGWh > ENERGY_TOLERANCE_GWH) {
    issues.push({
      code: 'ENERGY_VOLUME_UNALLOCATED',
      severity: 'error',
      message: `${unallocatedEnergyGWh.toFixed(6)} GWh of Energy Sales is not allocated to a tariff bucket.`,
    });
  }

  if (overallocatedEnergyGWh > ENERGY_TOLERANCE_GWH) {
    issues.push({
      code: 'ENERGY_VOLUME_OVERALLOCATED',
      severity: 'error',
      message: `${overallocatedEnergyGWh.toFixed(6)} GWh of Energy Sales is allocated more than once.`,
    });
  }

  const tierRevenueSumIdrBillion = Object.values(controlledResult.tierRevenueIdrBillion).reduce(
    (sum, value) => sum + value,
    0
  );
  const revenueReconciliationIdrBillion =
    tierRevenueSumIdrBillion - controlledResult.revenueIdrBillion;

  if (Math.abs(revenueReconciliationIdrBillion) > REVENUE_TOLERANCE_IDR_BILLION) {
    issues.push({
      code: 'ENERGY_REVENUE_RECONCILIATION',
      severity: 'error',
      message: 'Energy Sales revenue does not reconcile to the sum of tariff-bucket revenue.',
    });
  }

  const recalculatedEffectiveTariffIdrPerKWh =
    controlledResult.energySalesGWh > 0
      ? (controlledResult.revenueIdrBillion * 1e9) / (controlledResult.energySalesGWh * 1e6)
      : 0;
  const effectiveTariffReconciliationIdrPerKWh =
    recalculatedEffectiveTariffIdrPerKWh - controlledResult.effectiveTariffIdrPerKWh;

  if (
    Math.abs(effectiveTariffReconciliationIdrPerKWh) >
    TARIFF_TOLERANCE_IDR_PER_KWH
  ) {
    issues.push({
      code: 'ENERGY_EFFECTIVE_TARIFF_RECONCILIATION',
      severity: 'error',
      message: 'Reported effective tariff does not reconcile independently to revenue divided by Energy Sales.',
    });
  }

  return {
    passed: !issues.some((issue) => issue.severity === 'error'),
    issues,
    allocatedEnergyGWh,
    unallocatedEnergyGWh,
    overallocatedEnergyGWh,
    tierRevenueSumIdrBillion,
    revenueReconciliationIdrBillion,
    recalculatedEffectiveTariffIdrPerKWh,
    effectiveTariffReconciliationIdrPerKWh,
  };
}
