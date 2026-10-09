import type { GovernedEtcHandoff } from './etcEvidence';
import type { GovernedOutstandingCommitmentHandoff } from './outstandingCommitmentEvidence';

export interface CostCompletionCoveragePartitionEvidence {
  projectId: string;
  fieldId: string;
  selectorIdentity: string;
  asOfDate: string;
  currency: string;
  amountUnit: string;
  amountScale: number;
  sourceReference: string;
  commitmentCoverageKeys: readonly string[];
  etcCoverageKeys: readonly string[];
  populationComplete: boolean;
}

export interface GovernedForwardCostBasis {
  projectId: string;
  fieldId: string;
  selectorIdentity: string;
  cutoffDate: string;
  currency: string;
  amountUnit: string;
  amountScale: number;
  coveragePartitionSourceReference: string;
}

export interface GovernedForwardCostProvenance {
  commitment: GovernedOutstandingCommitmentHandoff;
  etc: GovernedEtcHandoff;
  coveragePartition: CostCompletionCoveragePartitionEvidence;
}

export interface GovernedCostCompletionComposition {
  ready: boolean;
  outstandingCommitment: number | null;
  uncommittedEtc: number | null;
  forwardCost: number | null;
  basis: GovernedForwardCostBasis | null;
  provenance: GovernedForwardCostProvenance | null;
  blockingReasons: readonly string[];
}

const exactIdentity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

/** Preserve upstream vetoes across composition; a retained ready flag is not
 * permission to discard blockers. Invalid populations remain explicit blockers. */
export function retainCostCompletionBlockers(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) return [`${label} blocking-reason population is malformed.`];
  const strings = value.filter((reason): reason is string => typeof reason === 'string');
  return strings.length === value.length
    ? strings
    : [...strings, `${label} blocking-reason entries are malformed.`];
}

const exactUniqueKeys = (label: string, values: readonly string[], blockers: string[]): Set<string> => {
  const keys = new Set<string>();
  for (const value of values) {
    if (!exactIdentity(value)) blockers.push(`Every ${label} coverage key must be an exact non-empty identity.`);
    else if (keys.has(value)) blockers.push(`Duplicate ${label} coverage key: ${value}.`);
    else keys.add(value);
  }
  return keys;
};

const snapshotPartition = (partition: CostCompletionCoveragePartitionEvidence): CostCompletionCoveragePartitionEvidence =>
  Object.freeze({
    ...partition,
    commitmentCoverageKeys: Object.freeze([...partition.commitmentCoverageKeys]),
    etcCoverageKeys: Object.freeze([...partition.etcCoverageKeys]),
  });

/**
 * Asset-generic composition gate for forward cost.
 *
 * This gate performs no inference about procurement, contracts, budget headroom,
 * electricity, or other asset economics. It admits arithmetic only when both
 * governed ingress handoffs are ready, their common basis is identical, and a
 * complete external coverage partition explicitly proves Commitment and ETC do
 * not cover the same future-work population.
 *
 * A ready result retains the exact governed component handoffs plus an immutable
 * snapshot of the coverage partition. This preserves provenance for downstream
 * EAC/PIR consumers without pretending that external coverage keys are themselves
 * source-authenticated mappings to obligation or forecast rows.
 */
export function composeGovernedForwardCost(
  commitment: GovernedOutstandingCommitmentHandoff,
  etc: GovernedEtcHandoff,
  partition: CostCompletionCoveragePartitionEvidence
): GovernedCostCompletionComposition {
  const blockers: string[] = [
    ...retainCostCompletionBlockers(commitment.blockingReasons, 'Outstanding Commitment'),
    ...retainCostCompletionBlockers(etc.blockingReasons, 'ETC'),
  ];

  if (!commitment.ready || commitment.amount === null) blockers.push('Governed Outstanding Commitment is not ready.');
  if (!etc.ready || etc.amount === null) blockers.push('Governed uncommitted ETC is not ready.');

  const commonBasis: Array<[string, unknown, unknown, unknown]> = [
    ['projectId', commitment.evidence.projectId, etc.evidence.projectId, partition.projectId],
    ['fieldId', commitment.evidence.fieldId, etc.evidence.fieldId, partition.fieldId],
    ['selectorIdentity', commitment.evidence.selectorIdentity, etc.evidence.selectorIdentity, partition.selectorIdentity],
    ['asOfDate', commitment.evidence.cutoffDate, etc.evidence.asOfDate, partition.asOfDate],
    ['currency', commitment.evidence.currency, etc.evidence.currency, partition.currency],
    ['amountUnit', commitment.evidence.amountUnit, etc.evidence.amountUnit, partition.amountUnit],
    ['amountScale', commitment.evidence.amountScale, etc.evidence.amountScale, partition.amountScale],
  ];
  for (const [name, commitmentValue, etcValue, partitionValue] of commonBasis) {
    if (commitmentValue !== etcValue || commitmentValue !== partitionValue) {
      blockers.push(`${name} must match exactly across Commitment, ETC and coverage-partition evidence.`);
    }
  }

  if (!exactIdentity(partition.sourceReference)) blockers.push('Coverage-partition sourceReference must be an exact non-empty identity.');
  if (partition.populationComplete !== true) blockers.push('Commitment/ETC coverage partition must be explicitly complete.');

  const commitmentKeys = exactUniqueKeys('commitment', partition.commitmentCoverageKeys, blockers);
  const etcKeys = exactUniqueKeys('ETC', partition.etcCoverageKeys, blockers);
  for (const key of commitmentKeys) {
    if (etcKeys.has(key)) blockers.push(`Commitment/ETC coverage overlap detected: ${key}.`);
  }

  const ready = blockers.length === 0;
  const forwardCost = ready ? (commitment.amount as number) + (etc.amount as number) : null;
  if (forwardCost !== null && !Number.isFinite(forwardCost)) blockers.push('Composed forward cost must remain finite.');

  const finalReady = blockers.length === 0;
  const basis = finalReady ? Object.freeze({
    projectId: partition.projectId,
    fieldId: partition.fieldId,
    selectorIdentity: partition.selectorIdentity,
    cutoffDate: partition.asOfDate,
    currency: partition.currency,
    amountUnit: partition.amountUnit,
    amountScale: partition.amountScale,
    coveragePartitionSourceReference: partition.sourceReference,
  }) : null;
  const provenance = finalReady ? Object.freeze({
    commitment,
    etc,
    coveragePartition: snapshotPartition(partition),
  }) : null;

  return Object.freeze({
    ready: finalReady,
    outstandingCommitment: finalReady ? commitment.amount : null,
    uncommittedEtc: finalReady ? etc.amount : null,
    forwardCost: finalReady ? forwardCost : null,
    basis,
    provenance,
    blockingReasons: Object.freeze(blockers),
  });
}
