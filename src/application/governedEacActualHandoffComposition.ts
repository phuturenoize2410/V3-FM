import type { GovernedCostCompletionComposition } from './costCompletionComposition';
import type { GovernedActualCostCompletionHandoff } from './governedActualCostCompletionHandoff';
import { composeGovernedEac, type GovernedEacComposition } from './governedEacComposition';

export interface GovernedEacActualHandoffComposition {
  readonly ready: boolean;
  readonly eacComposition: GovernedEacComposition;
  readonly actualHandoff: GovernedActualCostCompletionHandoff | null;
  readonly blockingReasons: readonly string[];
}

const retainBlockers = (reasons: readonly string[], label: string): string[] => {
  if (!Array.isArray(reasons)) return [`${label} blocking reasons must be an array.`];
  const blockers: string[] = [];
  for (const reason of reasons) {
    if (typeof reason !== 'string' || reason.length === 0 || reason !== reason.trim()) {
      blockers.push(`${label} contains an invalid blocking reason.`);
    } else {
      blockers.push(reason);
    }
  }
  return blockers;
};

const blockedEacComposition = (
  reasons: readonly string[],
  forwardCost: GovernedCostCompletionComposition,
): GovernedEacComposition => {
  const blockers = [
    ...reasons,
    ...retainBlockers(forwardCost.blockingReasons, 'Forward cost'),
  ];
  if (!forwardCost.ready || forwardCost.forwardCost === null || forwardCost.basis === null) {
    blockers.push('Governed forward cost and its retained basis are not ready.');
  }
  if (forwardCost.provenance == null) {
    blockers.push('Governed forward cost must retain exact component and coverage-partition provenance.');
  }

  return Object.freeze({
    ready: false,
    actualToDate: null,
    forwardCost: null,
    eac: null,
    provenance: null,
    blockingReasons: Object.freeze(blockers.length > 0 ? blockers : ['Governed EAC admission is blocked.']),
  });
};

/**
 * Source-lineage-preserving EAC admission from the existing governed Actual handoff.
 *
 * This wrapper deliberately removes the loose caller-supplied Actual scalar/basis
 * pair from the new admission path. Actual amount and basis are derived only from
 * the exact GovernedActualCostCompletionHandoff, and the admitted result retains
 * that handoff (including its exact Controlled Actual source review) for downstream
 * lineage consumers.
 *
 * This does not authenticate Commitment/ETC coverage mappings and therefore does
 * not make EAC live/VERIFIED by itself. Callers must still supply a governed forward
 * cost composition whose own coverage/source controls are ready.
 */
export function composeGovernedEacFromActualHandoff(
  actualHandoff: GovernedActualCostCompletionHandoff | null,
  forwardCost: GovernedCostCompletionComposition,
): GovernedEacActualHandoffComposition {
  const blockers: string[] = [];

  if (actualHandoff === null) {
    blockers.push('Governed Actual cost-completion handoff is required.');
  } else {
    blockers.push(...retainBlockers(actualHandoff.blockingReasons, 'Governed Actual handoff'));
    if (!actualHandoff.ready || actualHandoff.amount === null || actualHandoff.basis === null) {
      blockers.push('Governed Actual cost-completion handoff is not ready.');
    }
    if (actualHandoff.sourceReview === null) {
      blockers.push('Governed Actual handoff must retain its exact Controlled Actual source review.');
    }
  }

  if (blockers.length > 0 || actualHandoff === null || actualHandoff.amount === null || actualHandoff.basis === null) {
    const blockedEac = blockedEacComposition(blockers, forwardCost);
    return Object.freeze({
      ready: false,
      eacComposition: blockedEac,
      actualHandoff: null,
      blockingReasons: blockedEac.blockingReasons,
    });
  }

  const eacComposition = composeGovernedEac(
    actualHandoff.amount,
    actualHandoff.basis,
    forwardCost,
    forwardCost.basis ?? actualHandoff.basis,
  );
  blockers.push(...retainBlockers(eacComposition.blockingReasons, 'Governed EAC'));

  const ready = blockers.length === 0 && eacComposition.ready;
  return Object.freeze({
    ready,
    eacComposition,
    actualHandoff: ready ? actualHandoff : null,
    blockingReasons: Object.freeze(blockers),
  });
}
