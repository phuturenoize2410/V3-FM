import type {
  EnergySalesContract,
  EnergySalesResult,
} from './investmentLifecycleEngine';

export type EnergySalesOutputIdentitySeverity = 'error' | 'warning';

export interface EnergySalesOutputIdentityIssue {
  code: string;
  severity: EnergySalesOutputIdentitySeverity;
  message: string;
  bucketId?: string;
}

export interface EnergySalesOutputIdentityDiagnostics {
  passed: boolean;
  expectedBucketIds: string[];
  energyBucketIds: string[];
  revenueBucketIds: string[];
  missingEnergyBucketIds: string[];
  missingRevenueBucketIds: string[];
  unexpectedEnergyBucketIds: string[];
  unexpectedRevenueBucketIds: string[];
  issues: EnergySalesOutputIdentityIssue[];
}

function normalizeBucketId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function uniqueNormalized(values: unknown[]): string[] {
  return [...new Set(values.map(normalizeBucketId).filter(Boolean))].sort();
}

function invalidNormalizedIdentities(values: string[]): {
  blankIds: string[];
  duplicateIds: string[];
} {
  const normalizedValues = values.map(normalizeBucketId);
  const counts = new Map<string, number>();

  for (const value of normalizedValues) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return {
    blankIds: values.filter((value) => normalizeBucketId(value).length === 0),
    duplicateIds: [...counts.entries()]
      .filter(([value, count]) => value.length > 0 && count > 1)
      .map(([value]) => value)
      .sort(),
  };
}

function difference(source: string[], target: string[]): string[] {
  const targetSet = new Set(target);
  return source.filter((value) => !targetSet.has(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Independently verifies that Energy Sales calculation outputs use only bucket
 * identities explicitly established by the supplied contract structure.
 *
 * This diagnostic is intentionally commercial-term agnostic. It does not infer
 * tariff tiers, commitment structures, PPA/EBL terms, allocation priorities or
 * tariff values. It only checks the identity boundary between the caller-supplied
 * contract and the calculation result.
 *
 * Output bucket identity is also required to remain unambiguous under the same
 * trimmed/lower-case comparison used for contract-to-output reconciliation. This
 * prevents distinct raw object keys such as `Tier-1` and ` tier-1 ` from silently
 * collapsing into one normalized bucket during control reconciliation. Blank raw
 * bucket keys are likewise blocking identity evidence. The diagnostic does not
 * merge, rename or repair output buckets.
 *
 * Runtime contract-tier identities are normalized defensively so malformed retained
 * or deserialized evidence cannot throw before governance fails closed. A non-string
 * tier ID is treated as invalid identity evidence and never promoted into an expected
 * output bucket. A supplied non-array tier population is also blocking and is not
 * reinterpreted as a flat-tariff contract. Likewise, malformed energy/revenue output
 * bucket containers fail closed rather than being coerced into an empty valid result.
 * Malformed top-level contract/result envelopes also fail closed; an invalid contract
 * envelope is never reinterpreted as a valid flat-tariff contract.
 *
 * Convention:
 * - tiered contracts expect the normalized IDs supplied in `contract.tiers`;
 * - contracts without tiers expect the engine's structural `flat` bucket;
 * - missing/duplicate/invalid commercial definitions remain the responsibility
 *   of `energySalesControls.ts`; this module does not repair them.
 */
export function assessEnergySalesOutputIdentity(
  contract: EnergySalesContract,
  result: EnergySalesResult
): EnergySalesOutputIdentityDiagnostics {
  const issues: EnergySalesOutputIdentityIssue[] = [];
  const contractEnvelopeValid = isRecord(contract);
  const resultEnvelopeValid = isRecord(result);
  const runtimeContract = contractEnvelopeValid
    ? (contract as EnergySalesContract & { tiers?: unknown })
    : ({} as EnergySalesContract & { tiers?: unknown });
  const runtimeResult = resultEnvelopeValid
    ? (result as EnergySalesResult & {
        tierEnergyGWh?: unknown;
        tierRevenueIdrBillion?: unknown;
      })
    : ({} as EnergySalesResult & {
        tierEnergyGWh?: unknown;
        tierRevenueIdrBillion?: unknown;
      });
  const suppliedTiers = runtimeContract.tiers;
  const tiersPopulationValid =
    suppliedTiers === undefined || suppliedTiers === null || Array.isArray(suppliedTiers);
  const tierRows = Array.isArray(suppliedTiers) ? suppliedTiers : [];
  const tierIds = tierRows.map((tier) =>
    isRecord(tier) ? tier.id : undefined
  );
  const invalidContractTierIds = tierIds.filter(
    (tierId) => typeof tierId !== 'string' || normalizeBucketId(tierId).length === 0
  );
  const expectedBucketIds =
    contractEnvelopeValid && tiersPopulationValid && tierRows.length === 0
      ? ['flat']
      : uniqueNormalized(tierIds);

  const energyContainerValid = isRecord(runtimeResult.tierEnergyGWh);
  const revenueContainerValid = isRecord(runtimeResult.tierRevenueIdrBillion);
  const rawEnergyBucketIds = energyContainerValid
    ? Object.keys(runtimeResult.tierEnergyGWh)
    : [];
  const rawRevenueBucketIds = revenueContainerValid
    ? Object.keys(runtimeResult.tierRevenueIdrBillion)
    : [];
  const energyBucketIds = uniqueNormalized(rawEnergyBucketIds);
  const revenueBucketIds = uniqueNormalized(rawRevenueBucketIds);
  const energyIdentity = invalidNormalizedIdentities(rawEnergyBucketIds);
  const revenueIdentity = invalidNormalizedIdentities(rawRevenueBucketIds);

  if (!contractEnvelopeValid) {
    issues.push({
      code: 'ENERGY_CONTRACT_ENVELOPE_INVALID',
      severity: 'error',
      message: 'Energy Sales contract evidence is not an object envelope and cannot establish output bucket identity.',
    });
  }

  if (!resultEnvelopeValid) {
    issues.push({
      code: 'ENERGY_RESULT_ENVELOPE_INVALID',
      severity: 'error',
      message: 'Energy Sales calculation result evidence is not an object envelope and cannot establish output bucket identity.',
    });
  }

  if (!tiersPopulationValid) {
    issues.push({
      code: 'ENERGY_CONTRACT_TIER_POPULATION_INVALID',
      severity: 'error',
      message: 'Contract tariff-tier evidence was supplied but is not an array population; it cannot be interpreted as a flat-tariff contract.',
    });
  }

  if (invalidContractTierIds.length > 0) {
    issues.push({
      code: 'ENERGY_CONTRACT_BUCKET_ID_INVALID',
      severity: 'error',
      message: 'Contract tariff tiers contain blank, missing or non-string bucket identity evidence.',
    });
  }

  if (!energyContainerValid) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_POPULATION_INVALID',
      severity: 'error',
      message: 'Energy allocation bucket output is not a keyed object population.',
    });
  }

  if (!revenueContainerValid) {
    issues.push({
      code: 'REVENUE_OUTPUT_BUCKET_POPULATION_INVALID',
      severity: 'error',
      message: 'Revenue bucket output is not a keyed object population.',
    });
  }

  if (energyIdentity.blankIds.length > 0) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_ID_BLANK',
      severity: 'error',
      message: 'Energy allocation output contains a blank tariff-bucket identity.',
    });
  }

  if (revenueIdentity.blankIds.length > 0) {
    issues.push({
      code: 'REVENUE_OUTPUT_BUCKET_ID_BLANK',
      severity: 'error',
      message: 'Revenue output contains a blank tariff-bucket identity.',
    });
  }

  for (const bucketId of energyIdentity.duplicateIds) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_ID_DUPLICATE',
      severity: 'error',
      bucketId,
      message: `Energy allocation output contains multiple raw bucket keys that normalize to ${bucketId}.`,
    });
  }

  for (const bucketId of revenueIdentity.duplicateIds) {
    issues.push({
      code: 'REVENUE_OUTPUT_BUCKET_ID_DUPLICATE',
      severity: 'error',
      bucketId,
      message: `Revenue output contains multiple raw bucket keys that normalize to ${bucketId}.`,
    });
  }

  const missingEnergyBucketIds = difference(expectedBucketIds, energyBucketIds);
  const missingRevenueBucketIds = difference(expectedBucketIds, revenueBucketIds);
  const unexpectedEnergyBucketIds = difference(energyBucketIds, expectedBucketIds);
  const unexpectedRevenueBucketIds = difference(revenueBucketIds, expectedBucketIds);

  for (const bucketId of missingEnergyBucketIds) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_MISSING_ENERGY',
      severity: 'error',
      bucketId,
      message: `Energy allocation output is missing the contract-defined bucket ${bucketId}.`,
    });
  }

  for (const bucketId of missingRevenueBucketIds) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_MISSING_REVENUE',
      severity: 'error',
      bucketId,
      message: `Revenue output is missing the contract-defined bucket ${bucketId}.`,
    });
  }

  for (const bucketId of unexpectedEnergyBucketIds) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_UNSOURCED_ENERGY',
      severity: 'error',
      bucketId,
      message: `Energy allocation contains bucket ${bucketId}, which is not sourced from the supplied contract structure.`,
    });
  }

  for (const bucketId of unexpectedRevenueBucketIds) {
    issues.push({
      code: 'REVENUE_OUTPUT_BUCKET_UNSOURCED_REVENUE',
      severity: 'error',
      bucketId,
      message: `Revenue output contains bucket ${bucketId}, which is not sourced from the supplied contract structure.`,
    });
  }

  const energySet = new Set(energyBucketIds);
  const revenueSet = new Set(revenueBucketIds);
  const asymmetricBucketIds = uniqueNormalized([
    ...energyBucketIds.filter((bucketId) => !revenueSet.has(bucketId)),
    ...revenueBucketIds.filter((bucketId) => !energySet.has(bucketId)),
  ]);

  for (const bucketId of asymmetricBucketIds) {
    issues.push({
      code: 'ENERGY_OUTPUT_BUCKET_ASYMMETRY',
      severity: 'error',
      bucketId,
      message: `Tariff bucket ${bucketId} is not represented consistently in both energy and revenue outputs.`,
    });
  }

  return {
    passed: !issues.some((issue) => issue.severity === 'error'),
    expectedBucketIds,
    energyBucketIds,
    revenueBucketIds,
    missingEnergyBucketIds,
    missingRevenueBucketIds,
    unexpectedEnergyBucketIds,
    unexpectedRevenueBucketIds,
    issues,
  };
}
