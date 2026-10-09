import type { FullModelAssumptions } from '../types';
import type { WorkingOpex, WorkingOpexLine } from '../calculations/workingModelInputs';
import { validateWorkingInput } from '../calculations/workingModelInputs';
import { assertWorkingOpexShape, mutateWorkingOpexBatch, retainDraftSnapshot, type WorkingOpexMutation, type WorkingOpexMutationRecord } from './workingOpexMutation';

export interface WorkingOpexDraftReceipt {
  module: 'OPEX';
  lifecycleState: 'DRAFT';
  persisted: false;
  approved: false;
  actorId: null;
  occurredAt: null;
  savedVersionId: null;
  calculationResultId: null;
  reason: string;
  sourceReference: string;
  before: WorkingOpex | null;
  after: WorkingOpex;
  records: readonly WorkingOpexMutationRecord[];
  inputSnapshot: FullModelAssumptions;
}

/**
 * Forms and bulk JSON share one population-to-command adapter. Identity is exact;
 * a changed ID is a delete/add, never inferred from display labels. Ordering and
 * master metadata are retained explicitly in the before/after snapshots.
 */
export function admitWorkingOpexDraft(previous: FullModelAssumptions, proposed: FullModelAssumptions): { assumptions: FullModelAssumptions; receipt: WorkingOpexDraftReceipt } {
  const target = proposed.workingInputs?.opex;
  if (!target) throw new Error('An explicit complete working OPEX population is required.');
  const blockers = validateWorkingInput('opex', target, proposed);
  if (blockers.length) throw new Error(blockers.join(' '));
  assertWorkingOpexShape(target);
  const before = previous.workingInputs?.opex ?? null;
  if (before && (before.projectId !== target.projectId || before.modelProjectName !== target.modelProjectName)) throw new Error('An admitted OPEX master cannot be reassigned to another project.');
  const mutations: WorkingOpexMutation[] = [];
  const oldLines = before?.lines ?? [];
  for (const line of oldLines) if (!target.lines.some(next => next.id === line.id)) mutations.push({ type: 'DELETE_DRAFT_LINE', lineId: line.id });
  for (const line of target.lines) {
    const old = oldLines.find(item => item.id === line.id);
    if (!old) { mutations.push({ type: 'ADD_LINE', line }); continue; }
    if (old.description !== line.description) mutations.push({ type: 'RENAME_LINE', lineId: line.id, description: line.description });
    if (old.enabled !== line.enabled) mutations.push({ type: 'SET_LINE_ACTIVE', lineId: line.id, enabled: line.enabled });
    const patch: Partial<Omit<WorkingOpexLine, 'id'>> = {};
    for (const key of Object.keys(line) as (keyof WorkingOpexLine)[]) {
      if (key !== 'id' && key !== 'description' && key !== 'enabled' && JSON.stringify(old[key]) !== JSON.stringify(line[key])) Object.assign(patch, { [key]: line[key] });
    }
    if (Object.keys(patch).length) mutations.push({ type: 'UPDATE_LINE', lineId: line.id, patch });
  }
  // Metadata changes are explicit in the transaction snapshots; validate the final
  // population atomically so coordinated basis or horizon edits need no fake values.
  const result = mutations.length
    ? mutateWorkingOpexBatch({ ...target, lines: oldLines }, mutations, proposed)
    : { master: structuredClone(target), records: [] }; // Metadata/order only; no invented row command.
  const byId = new Map(result.master.lines.map(line => [line.id, line]));
  const after = { ...result.master, lines: target.lines.map(line => byId.get(line.id)!) };
  const assumptions = structuredClone({ ...proposed, workingInputs: { ...proposed.workingInputs, opex: after } });
  const receipt: WorkingOpexDraftReceipt = retainDraftSnapshot({
    module: 'OPEX', lifecycleState: 'DRAFT', persisted: false, approved: false,
    actorId: null, occurredAt: null, savedVersionId: null, calculationResultId: null,
    reason: target.changeReason, sourceReference: target.sourceReference,
    before, after, records: result.records, inputSnapshot: assumptions,
  });
  return { assumptions, receipt };
}
