import type { ControlledActualFieldReview } from './controlledActualFieldReview';
import { buildCostCompletionSelectorIdentity } from './costCompletionSelectorIdentity';
import { assessControlledHandoffUiAttachment } from '../components/actual/usePlanVsActualGovernance';

/** Read-only preparation for ONE reviewed field, not a project total or an EAC
 * authority. Consume the existing live session result; never accept loose amounts
 * or infer commitment/ETC/baseline from the legacy comparison. The exact review
 * retains selector, released rows, mapping snapshot, batch, cutoff and basis.
 * Source declarations remain unauthenticated. Missing components deliberately
 * have no input route until their governed contracts exist. */
export function prepareCostCompletion(review: ControlledActualFieldReview | null) {
  const admission = review?.handoff
    ? assessControlledHandoffUiAttachment(review.handoff)
    : null;
  const fields = review?.review?.migrationControl.reconciliation.fields;
  const field = fields?.length === 1 ? fields[0] : null;
  const selectorIdentity = review?.fieldSelector
    ? buildCostCompletionSelectorIdentity(review.fieldSelector)
    : null;
  const actualReady = review?.ready === true &&
    review.workflowBundle?.actualToDateEvidenceReady === true &&
    review.handoff?.reviewBundle === review.review &&
    admission?.attached === true &&
    review.projectBinding !== null && review.amountBasis !== null && review.fieldSelector !== null &&
    selectorIdentity?.ready === true &&
    field?.fieldId === review.target.fieldId && field?.migrationEligible === true &&
    typeof field.governedActualAmount === 'number' && Number.isFinite(field.governedActualAmount);

  const actualBlockers = actualReady ? [] : [
    'A current, reconciled Controlled Actual field review is required.',
    ...(review?.blockingReasons ?? []),
    ...(admission?.blockingReasons ?? []),
    ...(selectorIdentity?.blockingReasons ?? []),
  ];

  // Retain the exact governed selector, its canonical identity, and monetary basis
  // beside Actual-to-Date so a later EAC gate can compare independently supplied
  // forward-cost evidence without reconstructing identity, cutoff, or unit metadata
  // from loose UI state. This is provenance only: it does not authenticate the
  // caller's project binding or create Commitment/ETC/baseline evidence.
  const actualBasis = actualReady && review?.projectBinding && review.amountBasis && review.fieldSelector && review.workflowBundle && selectorIdentity?.identity
    ? Object.freeze({
        projectId: review.projectBinding.projectId,
        fieldId: review.target.fieldId,
        selector: review.fieldSelector,
        selectorIdentity: selectorIdentity.identity,
        cutoffDate: review.workflowBundle.inputEvidence.cutoffDate,
        currency: review.amountBasis.currency,
        amountUnit: review.amountBasis.unit,
        amountScale: review.amountBasis.scale,
        projectBindingSourceReference: review.projectBinding.sourceReference,
        amountBasisSourceReference: review.amountBasis.sourceReference,
      })
    : null;

  return Object.freeze({
    sourceReview: review,
    actualReady,
    actualToDate: actualReady ? field.governedActualAmount : null,
    actualBasis,
    actualBlockers: Object.freeze(actualBlockers),
    approvedBaseline: null,
    commitmentOutstanding: null,
    etc: null,
    eac: null,
    eacReady: false,
    realizedVariance: null,
    completionVariance: null,
    missingEvidence: Object.freeze({
      approvedBaseline: 'No approved baseline metric and version are linked to this field.',
      commitmentOutstanding: 'No governed outstanding commitment at the same cutoff and field scope is linked.',
      etc: 'No governed uncommitted ETC at the same cutoff and field scope is linked.',
      eac: 'EAC requires Actual-to-Date + Outstanding Commitment + ETC on one explicit basis, without overlap.',
      realizedVariance: 'Execution variance requires an approved, period-matched plan for the selected field.',
      completionVariance: 'Completion variance requires a governed EAC and comparable approved total baseline.',
    }),
  });
}
