import { ExactEacReviewPanel } from './ExactEacReviewPanel';
import React from 'react';
import type { CapexRealizationItem } from '../../types';
import type { ControlledActualFieldReviewController } from '../../application/useControlledActualFieldReview';
import { PlanVsActualGovernancePanel } from './PlanVsActualGovernancePanel';
import { prepareCostCompletion } from '../../application/costCompletionPreparation';

export const monetaryFieldId = (id: string) => `capex:${id}:actualIncurredIdrBillion`;
export function ControlledActualFieldReviewPanel({ controller, items, population, projectName }: {
  controller: ControlledActualFieldReviewController;
  items: CapexRealizationItem[];
  population: object;
  projectName: string;
}) {
  const matches = items.filter(item => monetaryFieldId(item.id) === controller.selectedFieldId);
  const selected = matches.length === 1 ? matches[0] : null;
  const result = controller.resultFor(population);
  const completion = prepareCostCompletion(result);
  const field = result?.review?.migrationControl.reconciliation.fields[0];
  const workflowEvidence = result?.workflowBundle?.inputEvidence;
  const statusLabel = result
    ? (result.ready ? 'RECONCILED · READ ONLY' : 'BLOCKED')
    : 'NOT REVIEWED';
  const statusClass = result
    ? (result.ready
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-amber-200 bg-amber-50 text-amber-900')
    : 'border-stone-200 bg-stone-100 text-stone-600';

  return <section className="overflow-hidden rounded-xl border border-stone-200 bg-[#fbfaf7] shadow-sm" aria-label="Controlled Actual field review">
    <div className="border-b border-stone-200 bg-white/70 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Actual evidence control</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-950">Controlled Actual · one-field review</h2>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">Import source evidence for one explicitly selected field. Review is read-only. Source identity is caller supplied; reconciliation does not authenticate the source or approve a baseline.</p>
        </div>
        <div role="status" data-testid="controlled-review-status" className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${statusClass}`}>{statusLabel}</div>
      </div>
    </div>

    <div className="space-y-4 p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Monetary field · IDR billions
            <select aria-label="Controlled monetary field" className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-300" value={controller.selectedFieldId} onChange={e => controller.selectField(e.target.value)}>
              <option value="">Select one field</option>
              {items.map(item => <option key={item.id} value={monetaryFieldId(item.id)}>{item.id} — Actual incurred</option>)}
            </select>
          </label>
          {selected && <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
            <div className="flex items-start justify-between gap-3"><span>Field identity</span><code className="max-w-[70%] break-all text-right font-mono text-[11px] text-slate-900">{monetaryFieldId(selected.id)}</code></div>
            <div className="mt-1 flex items-start justify-between gap-3"><span>Model project</span><span className="text-right font-medium text-slate-900">{projectName}</span></div>
          </div>}
          <details className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"><summary className="cursor-pointer font-medium text-slate-700">Required source package</summary><p className="mt-2">Supply evidenceUse: source_evidence; projectBinding with projectId, modelProjectName and sourceReference; amountBasis with currency IDR, unit major_currency, scale 1000000000 and sourceReference; field with fieldId and explicit selector; workflow with rows, mappingRules, cutoffDate, metadata and an independently retained mappingMasterSnapshot. Every row must explicitly declare the same project, currency, amountUnit and amountScale.</p></details>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Source evidence package · JSON
            <textarea aria-label="Actual source evidence JSON" className="mt-1.5 block min-h-36 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs leading-5 text-slate-800 outline-none transition focus:border-slate-500 focus:ring-1 focus:ring-slate-300" rows={6} value={controller.draft} onChange={e => controller.changeDraft(e.target.value)} placeholder="Paste source rows, Mapping Master, expected snapshot, project binding, amount basis and selector. No demo evidence is preloaded." />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Missing or mismatched evidence remains blocked. No value is backfilled.</p>
            <button type="button" className="shrink-0 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={!selected} onClick={() => selected && controller.submit({ fieldId: monetaryFieldId(selected.id), displayLabel: `${selected.id} Actual incurred`, modelProjectName: projectName, legacyDisplayAmount: selected.actualIncurredIdrBillion }, population)}>Review source evidence</button>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-200 pt-4" aria-label="Cost completion preparation" data-testid="cost-completion-preparation">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-950">Cost completion · selected field</h3>
          <span className="text-[11px] font-semibold text-amber-800">EAC REQUIRES SEPARATE REVIEW</span>
        </div>
        <p className="mt-1 text-xs text-slate-600">{selected ? monetaryFieldId(selected.id) : 'Select a field to review.'} · IDR billions · Not a project total</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-y border-stone-200 text-left text-slate-500"><tr><th className="py-2 font-medium">Component</th><th className="py-2 pr-4 text-right font-medium">Amount</th><th className="py-2 font-medium">Evidence / requirement</th></tr></thead>
            <tbody className="divide-y divide-stone-100 text-slate-700">
              <tr><th className="py-2 text-left font-medium">Actual-to-Date</th><td data-testid="completion-actual" className="py-2 pr-4 text-right font-semibold tabular-nums text-slate-950">{completion.actualToDate ?? 'Unavailable'}</td><td className="py-2">{completion.actualReady ? 'Reviewed source field · caller-declared authority' : completion.actualBlockers[0]}</td></tr>
              {([
                ['approvedBaseline', 'Approved Baseline'],
                ['commitmentOutstanding', 'Outstanding Commitment'],
                ['etc', 'ETC'],
                ['eac', 'EAC'],
                ['realizedVariance', 'Execution variance'],
                ['completionVariance', 'Completion variance'],
              ] as const).map(([key, label]) => <tr key={key}><th className="py-2 text-left font-medium">{label}</th><td className="py-2 pr-4 text-right tabular-nums">Unavailable</td><td className="py-2">{completion.missingEvidence[key]}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Actual below a full-project budget does not establish savings. The legacy comparison is not an Approved Baseline.</p>
        {completion.actualReady && workflowEvidence && <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Actual provenance</summary><dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><dt>Project / cutoff</dt><dd className="font-mono">{result?.projectBinding?.projectId} · {workflowEvidence.cutoffDate}</dd></div>
          <div><dt>Import batch / Mapping Master version</dt><dd className="font-mono">{workflowEvidence.metadata.importBatchId} · {workflowEvidence.mappingMasterSnapshot.version}</dd></div>
          <div><dt>Source reference</dt><dd className="break-all font-mono">{workflowEvidence.metadata.sourceReference}</dd></div>
          <div><dt>Released row IDs</dt><dd className="break-all font-mono">{field?.matchedRowIds.join(', ')}</dd></div>
        </dl></details>}
      </div>

      <ExactEacReviewPanel actualReview={result} />

      {result && <div className="space-y-4 border-t border-stone-200 pt-4">
        {workflowEvidence && <div className="grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-5" aria-label="Retained workflow evidence summary">
          <div className="bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cutoff</p><p className="mt-1 font-mono text-xs text-slate-900">{workflowEvidence.cutoffDate}</p></div>
          <div className="bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mapping Master</p><p className="mt-1 font-mono text-xs text-slate-900">{workflowEvidence.mappingMasterSnapshot.version}</p></div>
          <div className="bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source rows</p><p className="mt-1 text-right text-sm font-semibold tabular-nums text-slate-950">{workflowEvidence.sourceRows.length}</p></div>
          <div className="bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mapping rules</p><p className="mt-1 text-right text-sm font-semibold tabular-nums text-slate-950">{workflowEvidence.mappingRules.length}</p></div>
          <div className="bg-white p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actual-to-date gate</p><p className={`mt-1 text-xs font-semibold ${result.workflowBundle?.actualToDateEvidenceReady ? 'text-emerald-800' : 'text-amber-800'}`}>{result.workflowBundle?.actualToDateEvidenceReady ? 'EVIDENCE READY' : 'NOT READY'}</p></div>
        </div>}

        {result.projectBinding && <div className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-slate-500">Project</p><p className="mt-0.5 font-medium text-slate-900">{result.projectBinding.projectId}</p></div>
          <div><p className="text-slate-500">Currency / scale</p><p className="mt-0.5 font-medium text-slate-900">IDR · billions</p></div>
          <div className="min-w-0"><p className="text-slate-500">Binding reference</p><p className="mt-0.5 truncate font-mono text-[11px] text-slate-900" title={result.projectBinding.sourceReference}>{result.projectBinding.sourceReference}</p></div>
          <div className="min-w-0"><p className="text-slate-500">Basis reference</p><p className="mt-0.5 truncate font-mono text-[11px] text-slate-900" title={result.amountBasis?.sourceReference}>{result.amountBasis?.sourceReference}</p></div>
        </div>}

        {field && <dl className="grid overflow-hidden rounded-lg border border-stone-200 bg-white sm:grid-cols-3">
          <div className="border-b border-stone-200 p-3 sm:border-b-0 sm:border-r"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Governed source amount</dt><dd data-testid="reviewed-amount" className="mt-1 text-right text-base font-semibold tabular-nums text-slate-950">{field.governedActualAmount ?? 'Unavailable'}</dd><p className="mt-0.5 text-right text-[11px] text-slate-500">IDR billions</p></div>
          <div className="border-b border-stone-200 p-3 sm:border-b-0 sm:border-r"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Legacy comparison</dt><dd className="mt-1 text-right text-base font-semibold tabular-nums text-slate-700">{field.legacyDisplayAmount}</dd><p className="mt-0.5 text-right text-[11px] text-amber-700">UNVERIFIED</p></div>
          <div className="p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Released row IDs</dt><dd data-testid="reviewed-row-ids" className="mt-1 break-words text-right font-mono text-xs text-slate-900">{field.matchedRowIds.join(', ') || 'None'}</dd></div>
        </dl>}

        {result.blockingReasons.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Blocking evidence</p><ul className="mt-2 space-y-1 text-sm leading-5 text-amber-950">{result.blockingReasons.map((reason, i) => <li key={i}>• {reason}</li>)}</ul></div>}

        {result.ready && result.review?.governance && result.handoff && <div data-testid="controlled-handoff" className="space-y-3 border-t border-stone-200 pt-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><span className="font-semibold">Scope of verification:</span> this evidence applies only to the selected source field. Legacy tax, revenue, IRR, DSCR and other metrics remain unverified.</div>
          <PlanVsActualGovernancePanel governance={result.review.governance} diagnostics={result.review.diagnostics} migration={result.handoff.migrationPresentation} />
        </div>}
      </div>}

      <div className="border-t border-stone-200 pt-3 text-xs leading-5 text-slate-500">Evidence readiness does not approve a baseline, authenticate the source, or create a forecast/PIR case. No legacy value is replaced.</div>
    </div>
  </section>;
}
