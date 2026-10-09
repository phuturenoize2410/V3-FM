import React, { useState } from 'react';
import type { FullModelAssumptions, AnnualOperatingRow, SourcesAndUses } from '../types';
import { reviewScheduleSource } from '../application/scheduleSourceReview';
export function ScheduleSourceReviewPanel({ kind, assumptions, sourcesAndUses, annualRows }: { kind: 'dsra' | 'ppe'; assumptions: FullModelAssumptions; sourcesAndUses: SourcesAndUses; annualRows: AnnualOperatingRow[] }) {
  const [draft, setDraft] = useState('');
  const [session, setSession] = useState<{ result: ReturnType<typeof reviewScheduleSource>; draft: string } | null>(null);
  const p = session?.result.provenance;
  const current = session?.draft === draft && (!p || (p.assumptions === assumptions && p.annualRows === annualRows && p.sourcesAndUses === sourcesAndUses)) ? session.result : null;
  return <section className="rounded-lg border border-stone-200 bg-[#fffdfa] p-4 text-xs space-y-3" aria-label={`${kind} source review`}>
    <h3 className="font-semibold">{kind.toUpperCase()} · source-to-model reconciliation</h3>
    <p>Paste an explicit source package. Reconciliation is read-only and never replaces the model or authenticates source declarations. Changes to the source or live calculation invalidate the retained result.</p>
    <details><summary className="cursor-pointer">Required source fields</summary><p className="mt-2">Common fields: evidenceUse: source_evidence, projectId, modelProjectName, sourceReference, version, effectiveDate, currency: IDR, amountScale: 1000000000.</p>
      <p className="mt-2">{kind === 'dsra' ? 'DSRA: facilityId, targetMonths, openingBalance, requirementBasis: NEXT_ANNUAL_DEBT_SERVICE_PRO_RATA, eligibleDebtService: SENIOR_PRINCIPAL_PLUS_INTEREST, fundingMechanics: CASH_TOP_UP_TO_TARGET, drawMechanics: NO_DRAW_MODELED, releaseMechanics: EXCESS_ABOVE_TARGET, reserveForm: CASH. Other contractual mechanics remain unsupported; do not relabel them to pass this gate.' : 'PPE: depreciationPolicyReference, openingGross, openingAccumulatedDepreciation, otherOpeningCapitalization, populationComplete: true; codTransfers: capexItemId, amount, sourceReference for each model CAPEX item; rows: year, additions, disposals, accumulatedDepreciationDisposed, depreciation, sourceReference for every operating year. Explicit source zero is required when no movement occurred; absence is not zero. Partial capitalization or a different depreciation policy requires a separate engine migration.'}</p>
    </details>
    <textarea aria-label={`${kind} source JSON`} value={draft} onChange={e => { setDraft(e.target.value); setSession(null); }} className="block w-full min-h-28 rounded border border-stone-300 bg-white p-2 font-mono" placeholder="No source values or commercial terms are prefilled." />
    <button className="rounded bg-slate-900 text-white px-3 py-2" onClick={() => { let input: unknown; try { input = JSON.parse(draft); } catch { input = null; } setSession({ draft, result: reviewScheduleSource(kind, input, assumptions, sourcesAndUses, annualRows) }); }}>Review {kind.toUpperCase()} source</button>
    <p role="status" className="font-semibold">{current?.ready ? 'RECONCILED · READ ONLY · Source declarations not authenticated' : 'BLOCKED / AWAITING SOURCE'}</p>
    {current?.blockers.map((b,i) => <p key={i} className="text-amber-800">{b}</p>)}
    {current?.ready && <div className="overflow-auto"><table className="w-full text-right"><thead><tr><th className="p-2">Year</th>{Object.keys(current.rows[0]?.values ?? {}).map(k => <th key={k} className="p-2">{k}</th>)}</tr></thead><tbody>{current.rows.map(r => <tr key={r.year}><th className="p-2">Y{r.year}</th>{Object.entries(r.values).map(([k,v]) => <td key={k} className="p-2 font-mono">{typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 3 }) : 'Blocked'}</td>)}</tr>)}</tbody></table></div>}
  </section>;
}
