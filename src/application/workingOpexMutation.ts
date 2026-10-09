import type { FullModelAssumptions } from '../types';
import type { WorkingOpex, WorkingOpexLine } from '../calculations/workingModelInputs';
import { validateWorkingInput } from '../calculations/workingModelInputs';

export type WorkingOpexMutation =
  | { type: 'ADD_LINE'; line: WorkingOpexLine }
  | { type: 'UPDATE_LINE'; lineId: string; patch: Partial<Omit<WorkingOpexLine, 'id'>> }
  | { type: 'RENAME_LINE'; lineId: string; description: string }
  | { type: 'SET_LINE_ACTIVE'; lineId: string; enabled: boolean }
  | { type: 'DELETE_DRAFT_LINE'; lineId: string };

export interface WorkingOpexMutationRecord {
  module: 'OPEX';
  lifecycleState: 'DRAFT';
  targetId: string;
  operation: WorkingOpexMutation['type'];
  before: WorkingOpexLine | null;
  after: WorkingOpexLine | null;
  sourceReference: string;
}

export interface WorkingOpexMutationResult {
  master: WorkingOpex;
  record: WorkingOpexMutationRecord;
}

export interface WorkingOpexMutationBatchResult {
  master: WorkingOpex;
  records: readonly WorkingOpexMutationRecord[];
}

const clone = <T>(value: T): T => structuredClone(value);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** Detached, recursively frozen session snapshot, not an approved version. */
export function retainDraftSnapshot<T>(value: T): T {
  return deepFreeze(clone(value));
}

const lineKeys = ['id', 'description', 'enabled', 'kind', 'amount', 'currency', 'amountScale', 'unit', 'driver', 'quantities', 'escalationPct', 'firstOperatingYear', 'lastOperatingYear', 'sourceReference'];
export function assertWorkingOpexShape(master: WorkingOpex): void {
  const masterKeys = ['projectId', 'modelProjectName', 'sourceReference', 'version', 'effectiveDate', 'changeReason', 'status', 'populationComplete', 'lines'];
  if (Object.keys(master).some(key => !masterKeys.includes(key))) throw new Error('Unsupported OPEX master fields; no authority or formula extensions are admitted.');
  for (const line of master.lines) {
    if (Object.keys(line).some(key => !lineKeys.includes(key))) throw new Error('Unsupported OPEX line fields.');
    for (const quantity of line.quantities) {
      if (typeof quantity === 'object' && quantity !== null && Object.keys(quantity).some(key => !['year', 'quantity'].includes(key))) throw new Error('Unsupported annual quantity fields.');
    }
  }
}

function applyMutationWithoutAdmission(master: WorkingOpex, mutation: WorkingOpexMutation): WorkingOpexMutationRecord {
  if (!['ADD_LINE', 'UPDATE_LINE', 'RENAME_LINE', 'SET_LINE_ACTIVE', 'DELETE_DRAFT_LINE'].includes(mutation.type)) throw new Error('Unsupported OPEX command.');
  const targetId = mutation.type === 'ADD_LINE' ? mutation.line.id : mutation.lineId;
  if (typeof targetId !== 'string' || !targetId || targetId.trim() !== targetId) throw new Error('Mutation requires an exact stable line identity.');

  if (master.lines.filter(line => line.id === targetId).length > 1) throw new Error('Ambiguous OPEX line identity.');
  const index = master.lines.findIndex(line => line.id === targetId);
  const before = index >= 0 ? clone(master.lines[index]) : null;

  if (mutation.type === 'ADD_LINE') {
    if (index >= 0) throw new Error(`OPEX line ${targetId} already exists.`);
    master.lines.push(clone(mutation.line));
  } else {
    if (index < 0) throw new Error(`OPEX line ${targetId} does not exist.`);
    if (mutation.type === 'DELETE_DRAFT_LINE') master.lines.splice(index, 1);
    else if (mutation.type === 'RENAME_LINE') master.lines[index] = { ...master.lines[index], description: mutation.description };
    else if (mutation.type === 'SET_LINE_ACTIVE') master.lines[index] = { ...master.lines[index], enabled: mutation.enabled };
    else {
      if (Object.keys(mutation.patch).some(key => key === 'id' || !lineKeys.includes(key))) throw new Error('Update cannot change row identity or add unsupported fields.');
      master.lines[index] = { ...master.lines[index], ...clone(mutation.patch) };
    }
  }

  const afterIndex = master.lines.findIndex(line => line.id === targetId);
  const after = afterIndex >= 0 ? clone(master.lines[afterIndex]) : null;
  return {
    module: 'OPEX',
    lifecycleState: 'DRAFT',
    targetId,
    operation: mutation.type,
    before,
    after,
    sourceReference: after?.sourceReference ?? before?.sourceReference ?? master.sourceReference,
  };
}

/**
 * Canonical DRAFT structural/value mutation boundary for the working OPEX population.
 * Stable line identity is never inferred from or changed with the display description.
 * This boundary creates no approval, persistence, actor or authoritative timestamp.
 */
export function mutateWorkingOpex(
  master: WorkingOpex,
  mutation: WorkingOpexMutation,
  assumptions: FullModelAssumptions,
): WorkingOpexMutationResult {
  const result = mutateWorkingOpexBatch(master, [mutation], assumptions);
  return { master: result.master, record: result.records[0] };
}

/**
 * Atomic DRAFT admission boundary for a staged set of OPEX row mutations.
 * Intermediate staged states may be incomplete; only the final population is admitted.
 * Failure leaves the supplied master untouched and emits no mutation evidence.
 */
export function mutateWorkingOpexBatch(
  master: WorkingOpex,
  mutations: readonly WorkingOpexMutation[],
  assumptions: FullModelAssumptions,
): WorkingOpexMutationBatchResult {
  if (master.status !== 'DRAFT') throw new Error('Only DRAFT working OPEX can be mutated.');
  if (mutations.length === 0) throw new Error('At least one OPEX mutation is required.');

  const current = clone(master);
  const records: WorkingOpexMutationRecord[] = [];
  for (const mutation of mutations) records.push(applyMutationWithoutAdmission(current, mutation));

  const blockers = validateWorkingInput('opex', current, assumptions);
  if (blockers.length) throw new Error(blockers.join(' '));
  assertWorkingOpexShape(current);

  return {
    master: current,
    records: deepFreeze(records.map(record => deepFreeze(record))),
  };
}
