export interface OutstandingCommitmentRow {
  rowId: string;
  obligationId: string;
  amount: number;
  status: 'OUTSTANDING';
}

export interface OutstandingCommitmentEvidence {
  projectId: string;
  fieldId: string;
  selectorIdentity: string;
  cutoffDate: string;
  currency: string;
  amountUnit: string;
  amountScale: number;
  sourceReference: string;
  populationId: string;
  populationComplete: boolean;
  rows: readonly OutstandingCommitmentRow[];
}

export interface GovernedOutstandingCommitmentHandoff {
  ready: boolean;
  amount: number | null;
  evidence: OutstandingCommitmentEvidence;
  blockingReasons: readonly string[];
}

const exactIdentity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

const exactCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const snapshotEvidence = (evidence: OutstandingCommitmentEvidence): OutstandingCommitmentEvidence =>
  Object.freeze({
    ...evidence,
    rows: Object.freeze(evidence.rows.map(row => Object.freeze({ ...row }))),
  });

/**
 * Fail-closed, asset-generic ingress for outstanding commitment evidence.
 *
 * This boundary does not infer commitment from budget, awarded value, Actual,
 * ETC, project assumptions, or electricity-specific economics. Zero is admitted
 * only when a complete source population explicitly evidences zero outstanding
 * rows for the governed scope. Source references are retained declarations, not
 * authentication of the external system.
 *
 * The returned handoff retains an immutable snapshot of the admitted evidence so
 * downstream cost-completion/EAC consumers cannot observe source-object mutation
 * after governance checks have already passed.
 */
export function buildGovernedOutstandingCommitmentHandoff(
  evidence: OutstandingCommitmentEvidence
): GovernedOutstandingCommitmentHandoff {
  const blockers: string[] = [];
  const identities: Array<[string, unknown]> = [
    ['projectId', evidence.projectId],
    ['fieldId', evidence.fieldId],
    ['selectorIdentity', evidence.selectorIdentity],
    ['currency', evidence.currency],
    ['amountUnit', evidence.amountUnit],
    ['sourceReference', evidence.sourceReference],
    ['populationId', evidence.populationId],
  ];
  for (const [name, value] of identities) {
    if (!exactIdentity(value)) blockers.push(`${name} must be a non-empty exact identity without surrounding whitespace.`);
  }

  if (!exactCalendarDate(evidence.cutoffDate)) {
    blockers.push('cutoffDate must be an explicit valid YYYY-MM-DD calendar date.');
  }
  if (!Number.isFinite(evidence.amountScale) || evidence.amountScale <= 0) {
    blockers.push('amountScale must be finite and greater than zero.');
  }
  if (evidence.populationComplete !== true) {
    blockers.push('Outstanding commitment population completeness must be explicitly evidenced.');
  }

  const rowIds = new Set<string>();
  const obligationIds = new Set<string>();
  let amount = 0;
  for (const row of evidence.rows) {
    if (!exactIdentity(row.rowId)) blockers.push('Every commitment row requires an exact rowId.');
    else if (rowIds.has(row.rowId)) blockers.push(`Duplicate commitment rowId: ${row.rowId}.`);
    else rowIds.add(row.rowId);

    if (!exactIdentity(row.obligationId)) blockers.push('Every commitment row requires an exact obligationId.');
    else if (obligationIds.has(row.obligationId)) blockers.push(`Duplicate outstanding obligationId: ${row.obligationId}.`);
    else obligationIds.add(row.obligationId);

    if (row.status !== 'OUTSTANDING') blockers.push('Only explicitly OUTSTANDING obligations are admissible.');
    if (!Number.isFinite(row.amount) || row.amount < 0) blockers.push('Commitment row amounts must be finite and non-negative.');
    else amount += row.amount;
  }

  if (!Number.isFinite(amount)) blockers.push('Aggregated outstanding commitment amount must remain finite.');

  const retainedEvidence = snapshotEvidence(evidence);
  return Object.freeze({
    ready: blockers.length === 0,
    amount: blockers.length === 0 ? amount : null,
    evidence: retainedEvidence,
    blockingReasons: Object.freeze(blockers),
  });
}
