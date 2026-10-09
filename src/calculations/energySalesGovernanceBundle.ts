import type {
  EnergySalesContract,
  EnergySalesResult,
} from './investmentLifecycleEngine';
import {
  assessEnergySalesControls,
  type EnergySalesControlResult,
} from './energySalesControls';
import {
  assessEnergySalesOutputIdentity,
  type EnergySalesOutputIdentityDiagnostics,
} from './energySalesOutputIdentityDiagnostics';
import {
  assessEnergySalesCommercialTerms,
  type EnergySalesCommercialTermDiagnostics,
} from './energySalesCommercialTermDiagnostics';

export interface EnergySalesGovernanceBundle {
  readonly passed: boolean;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly sourceEnergySalesGWh: number;
  readonly contract: EnergySalesContract;
  readonly result: EnergySalesResult;
  readonly calculationControls: EnergySalesControlResult;
  readonly outputIdentity: EnergySalesOutputIdentityDiagnostics;
  readonly commercialTerms: EnergySalesCommercialTermDiagnostics;
}

const snapshotContract = (contract: EnergySalesContract): EnergySalesContract =>
  Object.freeze({
    ...contract,
    ...(contract.tiers === undefined
      ? {}
      : {
          tiers: Object.freeze(
            contract.tiers.map((tier) => Object.freeze({ ...tier }))
          ) as unknown as EnergySalesContract['tiers'],
        }),
  });

const snapshotResult = (result: EnergySalesResult): EnergySalesResult =>
  Object.freeze({
    ...result,
    tierRevenueIdrBillion: Object.freeze({ ...result.tierRevenueIdrBillion }),
    tierEnergyGWh: Object.freeze({ ...result.tierEnergyGWh }),
  });

const snapshotCalculationControls = (
  controls: EnergySalesControlResult
): EnergySalesControlResult =>
  Object.freeze({
    ...controls,
    issues: Object.freeze(
      controls.issues.map((issue) => Object.freeze({ ...issue }))
    ) as unknown as EnergySalesControlResult['issues'],
  });

const snapshotOutputIdentity = (
  diagnostics: EnergySalesOutputIdentityDiagnostics
): EnergySalesOutputIdentityDiagnostics =>
  Object.freeze({
    ...diagnostics,
    expectedBucketIds: Object.freeze([...diagnostics.expectedBucketIds]) as unknown as string[],
    energyBucketIds: Object.freeze([...diagnostics.energyBucketIds]) as unknown as string[],
    revenueBucketIds: Object.freeze([...diagnostics.revenueBucketIds]) as unknown as string[],
    missingEnergyBucketIds: Object.freeze([...diagnostics.missingEnergyBucketIds]) as unknown as string[],
    missingRevenueBucketIds: Object.freeze([...diagnostics.missingRevenueBucketIds]) as unknown as string[],
    unexpectedEnergyBucketIds: Object.freeze([...diagnostics.unexpectedEnergyBucketIds]) as unknown as string[],
    unexpectedRevenueBucketIds: Object.freeze([...diagnostics.unexpectedRevenueBucketIds]) as unknown as string[],
    issues: Object.freeze(
      diagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ) as unknown as EnergySalesOutputIdentityDiagnostics['issues'],
  });

const snapshotCommercialTerms = (
  diagnostics: EnergySalesCommercialTermDiagnostics
): EnergySalesCommercialTermDiagnostics =>
  Object.freeze({
    ...diagnostics,
    issues: Object.freeze(
      diagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ) as unknown as EnergySalesCommercialTermDiagnostics['issues'],
  });

/**
 * Re-performs the independent Energy Sales control layers as one downstream
 * governance bundle without changing the underlying calculation result.
 *
 * The exact source volume and immutable snapshots of the contract/result supplied
 * to this governance run are retained as in-memory provenance so downstream module
 * handoffs cannot observe caller mutation after assessment. The independently
 * generated control/identity/commercial diagnostics are snapshotted as well, so a
 * consumer cannot rewrite the retained governance decision by mutating a nested
 * issue or bucket-identity population after admission. Snapshot retention is
 * structural evidence only; it is not persistence, authentication or proof of
 * external commercial authority.
 *
 * The caller-owned contract/result objects are never mutated or frozen. The bundle
 * owns frozen copies, including tariff-tier rows and result bucket maps, so the
 * governed decision and the evidence represented by that decision remain aligned.
 *
 * The bundle is intentionally read-only and module-specific:
 * - it does not calculate or mutate Energy Sales, tariff, revenue or allocation;
 * - it does not infer tariff tiers, commitment, escalation, PPA or EBL terms;
 * - omitted escalation is not allowed to masquerade as an explicitly governed
 *   fixed 0% term, even though the legacy calculator mechanically falls back to 0%;
 * - it does not promote electricity-specific concepts into the asset-generic
 *   investment lifecycle core;
 * - downstream callers may only represent the Energy Sales result as governed
 *   when calculation/reconciliation controls, output-identity controls and
 *   explicit commercial-term diagnostics all pass.
 *
 * Commercial-definition arithmetic validation remains in `energySalesControls.ts`,
 * output bucket provenance remains independently checked by
 * `energySalesOutputIdentityDiagnostics.ts`, and explicit-term completeness is
 * assessed by `energySalesCommercialTermDiagnostics.ts`.
 */
export function buildEnergySalesGovernanceBundle(
  sourceEnergySalesGWh: number,
  contract: EnergySalesContract,
  result: EnergySalesResult
): EnergySalesGovernanceBundle {
  const calculationControls = assessEnergySalesControls(
    sourceEnergySalesGWh,
    contract,
    result
  );
  const outputIdentity = assessEnergySalesOutputIdentity(contract, result);
  const commercialTerms = assessEnergySalesCommercialTerms(contract);

  const calculationErrors = calculationControls.issues.filter(
    (issue) => issue.severity === 'error'
  ).length;
  const identityErrors = outputIdentity.issues.filter(
    (issue) => issue.severity === 'error'
  ).length;
  const calculationWarnings = calculationControls.issues.filter(
    (issue) => issue.severity === 'warning'
  ).length;
  const identityWarnings = outputIdentity.issues.filter(
    (issue) => issue.severity === 'warning'
  ).length;

  const blockingIssueCount =
    calculationErrors +
    identityErrors +
    commercialTerms.blockingIssueCount;
  const warningCount =
    calculationWarnings +
    identityWarnings +
    commercialTerms.warningCount;

  const retainedContract = snapshotContract(contract);
  const retainedResult = snapshotResult(result);
  const retainedCalculationControls = snapshotCalculationControls(calculationControls);
  const retainedOutputIdentity = snapshotOutputIdentity(outputIdentity);
  const retainedCommercialTerms = snapshotCommercialTerms(commercialTerms);

  return Object.freeze({
    passed:
      calculationControls.passed &&
      outputIdentity.passed &&
      commercialTerms.passed &&
      blockingIssueCount === 0,
    blockingIssueCount,
    warningCount,
    sourceEnergySalesGWh,
    contract: retainedContract,
    result: retainedResult,
    calculationControls: retainedCalculationControls,
    outputIdentity: retainedOutputIdentity,
    commercialTerms: retainedCommercialTerms,
  });
}