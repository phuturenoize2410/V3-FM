import React, { useState } from 'react';
import type { ControlledActualFieldReview } from '../../application/controlledActualFieldReview';
import { reviewExactEac } from '../../application/exactEacReview';
export function ExactEacReviewPanel({ actualReview }: { actualReview: ControlledActualFieldReview | null }) {
  const [draft, setDraft] = useState('');
  const [session, setSession] = useState<{ actual: ControlledActualFieldReview | null; draft: string; result: ReturnType<typeof reviewExactEac> } | null>(null);
  const [error, setError] = useState('');
  const current = session?.actual === actualReview && session?.draft === draft ? session.result : null;
  return <section className="mt-4 border-t border-stone-200 pt-4 text-xs" aria-label="Exact EAC review">
    <h3 className="font-semibold text-slate-950">EAC · exact component review</h3>
    <p className="my-2">Read-only selected field. Supply Commitment, uncommitted ETC, common-basis partition and a complete source-owned coverage mapping. Every released Actual row, commitment row and ETC row must map once to disjoint scope atoms. Partly realized obligations require explicit source-owned portions. No approved baseline, legacy replacement or economic KPI is created.</p>
    <details><summary className="cursor-pointer">Required EAC source package</summary><p className="mt-2">evidenceUse: source_evidence; commitment: OutstandingCommitmentEvidence; etc: EtcEvidence; partition: CostCompletionCoveragePartitionEvidence; coverage: sourceReference, revision, populationComplete: true, scopeAtoms, rows of component (ACTUAL/COMMITMENT/ETC), rowId, scopeAtoms. Forward coverage keys must equal the corresponding mapped atoms. All components must match the selected project's field, selector, cutoff, currency and scale. Source declarations remain unauthenticated.</p></details>
    <textarea aria-label="EAC source evidence JSON" value={draft} onChange={e => { setDraft(e.target.value); setSession(null); setError(''); }} className="my-2 block w-full min-h-28 rounded border border-stone-300 bg-white p-2 font-mono" placeholder="No demo or default evidence is preloaded." />
    <button className="rounded bg-slate-900 text-white px-3 py-2" onClick={() => { try { setSession({ actual: actualReview, draft, result: reviewExactEac(actualReview, JSON.parse(draft)) }); setError(''); } catch { setSession(null); setError('Blocked: malformed JSON.'); } }}>Review exact EAC evidence</button>
    <p role="status" data-testid="exact-eac-status" className="mt-2 font-semibold">{current?.ready ? `RECONCILED · READ ONLY · ${current.eac} IDR billion` : 'EAC BLOCKED / NOT REVIEWED'}</p>
    {error && <p>{error}</p>}{current?.blockingReasons.map((b, i) => <p key={i}>{b}</p>)}
    {current?.ready && <p>Retained Actual rows: {current.provenance.actualReview.review?.migrationControl.reconciliation.fields[0].matchedRowIds.join(', ')} · Coverage source: {current.provenance.coverage.sourceReference} · Revision: {current.provenance.coverage.revision}</p>}
  </section>;
}
