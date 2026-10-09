import type { ControlledActualFieldReview } from './controlledActualFieldReview';
import { prepareCostCompletion } from './costCompletionPreparation';

export interface GovernedActualCostCompletionBasis {
  readonly projectId: string;
  readonly fieldId: string;
  readonly selectorIdentity: string;
  readonly cutoffDate: string;
  readonly currency: string;
  readonly amountUnit: string;
  readonly amountScale: number;
  readonly projectBindingSourceReference: string;
  readonly amountBasisSourceReference: string;
}

export interface GovernedActualCostCompletionHandoff {
  readonly ready: boolean;
  readonly amount: number | null;
  readonly basis: Readonly<GovernedActualCostCompletionBasis> | null;
  readonly sourceReview: ControlledActualFieldReview | null;
  readonly blockingReasons: readonly string[];
}

const exactIdentity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

/**
 * Asset-generic admission boundary from the existing Controlled Actual review into
 * cost-completion. This deliberately accepts the governed review object rather than
 * a caller-supplied Actual scalar/basis pair, so later EAC composition has a path to
 * retain the exact reviewed source lineage instead of reconstructing it from UI state.
 *
 * This is not EAC authority and does not create Commitment, ETC, baseline, approval,
 * persistence, or commercial evidence. The source references are retained evidence;
 * they are not authenticated by this boundary.
 */
export function buildGovernedActualCostCompletionHandoff(
  review: ControlledActualFieldReview | null,
): GovernedActualCostCompletionHandoff {
  const prepared = prepareCostCompletion(review);
  const blockers = [...prepared.actualBlockers];
  const basis = prepared.actualBasis;

  if (!prepared.actualReady || prepared.actualToDate === null || basis === null) {
    if (blockers.length === 0) blockers.push('Governed Actual-to-Date is not ready for cost-completion.');
  } else {
    if (!Number.isFinite(prepared.actualToDate) || prepared.actualToDate < 0) {
      blockers.push('Governed Actual-to-Date must be a finite non-negative amount.');
    }
    if (!exactIdentity(basis.projectId) || !exactIdentity(basis.fieldId) || !exactIdentity(basis.selectorIdentity)) {
      blockers.push('Governed Actual cost-completion identities must be exact non-blank values.');
    }
    if (!exactIdentity(basis.currency) || !exactIdentity(basis.amountUnit)) {
      blockers.push('Governed Actual monetary basis identities must be exact non-blank values.');
    }
    if (!Number.isFinite(basis.amountScale) || basis.amountScale <= 0) {
      blockers.push('Governed Actual amountScale must be finite and greater than zero.');
    }
    if (!exactIdentity(basis.projectBindingSourceReference) || !exactIdentity(basis.amountBasisSourceReference)) {
      blockers.push('Governed Actual must retain exact project-binding and monetary-basis source references.');
    }
  }

  const ready = blockers.length === 0 && prepared.actualReady && prepared.actualToDate !== null && basis !== null;
  const retainedBasis = ready && basis
    ? Object.freeze({
        projectId: basis.projectId,
        fieldId: basis.fieldId,
        selectorIdentity: basis.selectorIdentity,
        cutoffDate: basis.cutoffDate,
        currency: basis.currency,
        amountUnit: basis.amountUnit,
        amountScale: basis.amountScale,
        projectBindingSourceReference: basis.projectBindingSourceReference,
        amountBasisSourceReference: basis.amountBasisSourceReference,
      })
    : null;

  return Object.freeze({
    ready,
    amount: ready ? prepared.actualToDate : null,
    basis: retainedBasis,
    sourceReview: ready ? prepared.sourceReview : null,
    blockingReasons: Object.freeze(blockers),
  });
}
