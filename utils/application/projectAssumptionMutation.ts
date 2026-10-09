import { admitWorkingOpexDraft, type WorkingOpexDraftReceipt } from './workingOpexAdmission';
import { validateWorkingInput } from '../calculations/workingModelInputs';
import type { FullModelAssumptions } from '../types';

export type TransientAssumptionAuthority = 'DEMO_DEFAULT' | 'DRAFT';

export interface TransientAssumptionState {
  assumptions: FullModelAssumptions;
  authority: TransientAssumptionAuthority;
  rejectionReasons?: readonly string[];
  opexReceipts?: readonly WorkingOpexDraftReceipt[];
}

export type AssumptionMutation =
  | FullModelAssumptions
  | ((previous: FullModelAssumptions) => FullModelAssumptions);

/**
 * Single calculation-free transition primitive for live in-memory assumption edits.
 *
 * Any accepted mutation moves transient assumptions to DRAFT. This deliberately
 * creates no persistence, actor, saved version or approval. OPEX admissions retain
 * detached session receipts; these are not a durable audit ledger.
 */
export function applyTransientAssumptionMutation(
  current: TransientAssumptionState,
  mutation: AssumptionMutation
): TransientAssumptionState {
  let assumptions =
    typeof mutation === 'function'
      ? mutation(current.assumptions.workingInputs?.opex ? structuredClone(current.assumptions) : current.assumptions)
      : mutation;

  const blockers: string[] = [];
  if (current.assumptions.workingInputs?.opex && !assumptions.workingInputs?.opex) blockers.push('Removing an active OPEX master through a population replacement is blocked. Use the explicit demo reset to restore defaults.');
  for (const kind of ['timeline', 'opex'] as const) {
    const input = assumptions.workingInputs?.[kind];
    if (input) blockers.push(...validateWorkingInput(kind, input, assumptions));
  }
  if (current.assumptions.workingInputs?.opex && assumptions.workingInputs?.opex &&
    (JSON.stringify(assumptions.opex) !== JSON.stringify(current.assumptions.opex) || assumptions.operating.annualOpexEscalationPct !== current.assumptions.operating.annualOpexEscalationPct)) blockers.push('Legacy OPEX edits cannot change an active working master. Edit the OPEX master explicitly.');
  const timeline = assumptions.workingInputs?.timeline;
  if (timeline && (['constructionStartDate', 'codDate', 'constructionPeriodMonths', 'operatingPeriodYears'] as const).some(k => timeline[k] !== assumptions.project[k])) blockers.push('Active timeline must be changed through its working input boundary.');
  if (timeline && timeline.repaymentPeriodYears !== assumptions.funding.repaymentPeriodYears) blockers.push('Active repayment timing must be changed through the timeline boundary.');
  if (blockers.length) return { ...current, rejectionReasons: Object.freeze(blockers) };
  let opexReceipts = current.opexReceipts;
  if (assumptions.workingInputs?.opex && JSON.stringify(assumptions.workingInputs.opex) !== JSON.stringify(current.assumptions.workingInputs?.opex)) {
    try {
      const admission = admitWorkingOpexDraft(current.assumptions, assumptions);
      assumptions = admission.assumptions;
      opexReceipts = Object.freeze([...(opexReceipts ?? []), admission.receipt]);
    } catch (error) {
      return { ...current, rejectionReasons: Object.freeze([error instanceof Error ? error.message : 'Invalid OPEX admission.']) };
    }
  }
  return { assumptions, authority: 'DRAFT', ...(opexReceipts ? { opexReceipts } : {}) };
}

/**
 * Explicit reset transition for restoring a known demo/default population.
 * The caller owns construction of that population; this function does not infer
 * that arbitrary values are defaults.
 */
export function restoreDemoAssumptionPopulation(
  assumptions: FullModelAssumptions
): TransientAssumptionState {
  return {
    assumptions,
    authority: 'DEMO_DEFAULT',
  };
}
