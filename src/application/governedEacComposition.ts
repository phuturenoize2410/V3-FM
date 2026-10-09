import type { GovernedCostCompletionComposition } from './costCompletionComposition';
import { retainCostCompletionBlockers } from './costCompletionComposition';

export interface GovernedActualCostCompletionBasis {
  projectId: string;
  fieldId: string;
  selectorIdentity: string;
  cutoffDate: string;
  currency: string;
  amountUnit: string;
  amountScale: number;
}

export interface GovernedEacComponentProvenance {
  actualBasis: Readonly<GovernedActualCostCompletionBasis>;
  forwardBasis: Readonly<NonNullable<GovernedCostCompletionComposition['basis']>>;
  forwardCostProvenance: NonNullable<GovernedCostCompletionComposition['provenance']>;
  outstandingCommitment: number;
  uncommittedEtc: number;
}

export interface GovernedEacComposition {
  ready: boolean;
  actualToDate: number | null;
  forwardCost: number | null;
  eac: number | null;
  provenance: GovernedEacComponentProvenance | null;
  blockingReasons: readonly string[];
}

const exactIdentity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

const exactCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

/**
 * Asset-generic final arithmetic gate for one governed cost-completion field.
 *
 * It does not construct Actual, Commitment, ETC, coverage partition, baseline,
 * variance, or commercial evidence. It only admits EAC arithmetic after the
 * independently governed forward-cost gate is ready and its retained common
 * basis exactly matches the governed Actual-to-Date basis.
 *
 * `forwardBasis` is retained for call-site compatibility, but it is no longer
 * trusted independently: it must exactly match the basis retained by the
 * governed forward-cost composition itself. A ready EAC also requires the
 * forward-cost composition to retain its exact governed component provenance;
 * reconstructed scalar-only envelopes fail closed rather than becoming
 * decision-grade evidence.
 */
export function composeGovernedEac(
  actualToDate: number | null,
  actualBasis: GovernedActualCostCompletionBasis | null,
  forwardCost: GovernedCostCompletionComposition,
  forwardBasis: GovernedActualCostCompletionBasis
): GovernedEacComposition {
  const blockers = retainCostCompletionBlockers(forwardCost.blockingReasons, 'Forward cost');

  if (actualToDate === null || !Number.isFinite(actualToDate) || actualToDate < 0) {
    blockers.push('Governed Actual-to-Date must be a finite non-negative amount.');
  }
  if (actualBasis === null) blockers.push('Governed Actual-to-Date basis is required.');
  if (!forwardCost.ready || forwardCost.forwardCost === null || forwardCost.basis === null) {
    blockers.push('Governed forward cost and its retained basis are not ready.');
  }
  if (forwardCost.provenance == null) {
    blockers.push('Governed forward cost must retain exact component and coverage-partition provenance.');
  }
  if (forwardCost.outstandingCommitment === null || forwardCost.uncommittedEtc === null) {
    blockers.push('Governed forward cost must retain both Commitment and ETC components.');
  } else {
    if (!Number.isFinite(forwardCost.outstandingCommitment) || forwardCost.outstandingCommitment < 0) {
      blockers.push('Retained Outstanding Commitment must be a finite non-negative amount.');
    }
    if (!Number.isFinite(forwardCost.uncommittedEtc) || forwardCost.uncommittedEtc < 0) {
      blockers.push('Retained uncommitted ETC must be a finite non-negative amount.');
    }
    if (forwardCost.forwardCost !== null) {
      const recomposedForwardCost = forwardCost.outstandingCommitment + forwardCost.uncommittedEtc;
      if (!Number.isFinite(recomposedForwardCost) || recomposedForwardCost !== forwardCost.forwardCost) {
        blockers.push('Governed forward cost must equal its retained Commitment plus ETC components exactly.');
      }
    }
  }

  const basisFields: Array<keyof GovernedActualCostCompletionBasis> = [
    'projectId', 'fieldId', 'selectorIdentity', 'cutoffDate',
    'currency', 'amountUnit', 'amountScale',
  ];

  if (forwardCost.basis !== null) {
    for (const field of basisFields) {
      if (forwardBasis[field] !== forwardCost.basis[field]) {
        blockers.push(`${field} must match the basis retained by governed forward cost.`);
      }
    }
  }

  if (actualBasis !== null && forwardCost.basis !== null) {
    for (const field of basisFields) {
      if (actualBasis[field] !== forwardCost.basis[field]) {
        blockers.push(`${field} must match exactly between Actual-to-Date and governed forward cost.`);
      }
    }
  }

  if (forwardCost.basis !== null) {
    for (const field of ['projectId', 'fieldId', 'selectorIdentity', 'currency', 'amountUnit'] as const) {
      if (!exactIdentity(forwardCost.basis[field])) blockers.push(`${field} must be an exact non-empty identity.`);
    }
    if (!exactCalendarDate(forwardCost.basis.cutoffDate)) {
      blockers.push('cutoffDate must be an exact valid calendar date in YYYY-MM-DD format.');
    }
    if (!Number.isFinite(forwardCost.basis.amountScale) || forwardCost.basis.amountScale <= 0) {
      blockers.push('amountScale must be a finite positive number.');
    }
    if (!exactIdentity(forwardCost.basis.coveragePartitionSourceReference)) {
      blockers.push('Governed forward cost must retain an exact coverage-partition source reference.');
    }
  }

  const ready = blockers.length === 0;
  const eac = ready ? (actualToDate as number) + (forwardCost.forwardCost as number) : null;
  if (eac !== null && !Number.isFinite(eac)) blockers.push('Governed EAC must remain finite.');

  const finalReady = blockers.length === 0;
  const provenance = finalReady && actualBasis !== null && forwardCost.basis !== null && forwardCost.provenance != null
    ? Object.freeze({
        actualBasis: Object.freeze({ ...actualBasis }),
        forwardBasis: Object.freeze({ ...forwardCost.basis }),
        forwardCostProvenance: forwardCost.provenance,
        outstandingCommitment: forwardCost.outstandingCommitment as number,
        uncommittedEtc: forwardCost.uncommittedEtc as number,
      })
    : null;

  return Object.freeze({
    ready: finalReady,
    actualToDate: finalReady ? actualToDate : null,
    forwardCost: finalReady ? forwardCost.forwardCost : null,
    eac: finalReady ? eac : null,
    provenance,
    blockingReasons: Object.freeze(blockers),
  });
}
