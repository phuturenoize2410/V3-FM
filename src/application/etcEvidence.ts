export interface EtcEvidenceRow {
  rowId: string;
  forecastItemId: string;
  amount: number;
  coverage: 'UNCOMMITTED';
}

export interface EtcEvidence {
  projectId: string;
  fieldId: string;
  selectorIdentity: string;
  asOfDate: string;
  completionHorizonDate: string;
  currency: string;
  amountUnit: string;
  amountScale: number;
  sourceReference: string;
  forecastRevisionId: string;
  authorityReference: string;
  populationComplete: boolean;
  rows: readonly EtcEvidenceRow[];
}

export interface GovernedEtcHandoff {
  ready: boolean;
  amount: number | null;
  evidence: EtcEvidence;
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
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const snapshotEvidence = (evidence: EtcEvidence): EtcEvidence =>
  Object.freeze({
    ...evidence,
    rows: Object.freeze(evidence.rows.map(row => Object.freeze({ ...row }))),
  });

/**
 * Fail-closed, asset-generic ingress for uncommitted estimate-to-complete evidence.
 *
 * This boundary retains the supplied forecast revision and authority references,
 * but does not authenticate them or infer approval. It does not infer ETC from
 * budget headroom, commitment, Actual, model assumptions, or electricity-specific
 * economics. Zero is admitted only from an explicitly complete source population.
 *
 * The returned handoff retains an immutable snapshot of the admitted evidence so
 * downstream cost-completion/EAC consumers cannot observe source-object mutation
 * after governance checks have already passed.
 */
export function buildGovernedEtcHandoff(evidence: EtcEvidence): GovernedEtcHandoff {
  const blockers: string[] = [];
  const identities: Array<[string, unknown]> = [
    ['projectId', evidence.projectId],
    ['fieldId', evidence.fieldId],
    ['selectorIdentity', evidence.selectorIdentity],
    ['currency', evidence.currency],
    ['amountUnit', evidence.amountUnit],
    ['sourceReference', evidence.sourceReference],
    ['forecastRevisionId', evidence.forecastRevisionId],
    ['authorityReference', evidence.authorityReference],
  ];
  for (const [name, value] of identities) {
    if (!exactIdentity(value)) blockers.push(`${name} must be a non-empty exact identity without surrounding whitespace.`);
  }

  if (!exactCalendarDate(evidence.asOfDate)) blockers.push('asOfDate must be an explicit valid YYYY-MM-DD calendar date.');
  if (!exactCalendarDate(evidence.completionHorizonDate)) blockers.push('completionHorizonDate must be an explicit valid YYYY-MM-DD calendar date.');
  if (exactCalendarDate(evidence.asOfDate) && exactCalendarDate(evidence.completionHorizonDate) && evidence.completionHorizonDate < evidence.asOfDate) {
    blockers.push('completionHorizonDate must not precede asOfDate.');
  }
  if (!Number.isFinite(evidence.amountScale) || evidence.amountScale <= 0) blockers.push('amountScale must be finite and greater than zero.');
  if (evidence.populationComplete !== true) blockers.push('ETC population completeness must be explicitly evidenced.');

  const rowIds = new Set<string>();
  const forecastItemIds = new Set<string>();
  let amount = 0;
  for (const row of evidence.rows) {
    if (!exactIdentity(row.rowId)) blockers.push('Every ETC row requires an exact rowId.');
    else if (rowIds.has(row.rowId)) blockers.push(`Duplicate ETC rowId: ${row.rowId}.`);
    else rowIds.add(row.rowId);

    if (!exactIdentity(row.forecastItemId)) blockers.push('Every ETC row requires an exact forecastItemId.');
    else if (forecastItemIds.has(row.forecastItemId)) blockers.push(`Duplicate ETC forecastItemId: ${row.forecastItemId}.`);
    else forecastItemIds.add(row.forecastItemId);

    if (row.coverage !== 'UNCOMMITTED') blockers.push('Only explicitly UNCOMMITTED forecast coverage is admissible as ETC.');
    if (!Number.isFinite(row.amount) || row.amount < 0) blockers.push('ETC row amounts must be finite and non-negative.');
    else amount += row.amount;
  }

  if (!Number.isFinite(amount)) blockers.push('Aggregated ETC amount must remain finite.');

  const retainedEvidence = snapshotEvidence(evidence);
  return Object.freeze({
    ready: blockers.length === 0,
    amount: blockers.length === 0 ? amount : null,
    evidence: retainedEvidence,
    blockingReasons: Object.freeze(blockers),
  });
}
