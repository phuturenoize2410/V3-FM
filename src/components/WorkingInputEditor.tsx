import React, { useState } from 'react';
import type { FullModelAssumptions } from '../types';
import { admitWorkingOpexDraft } from '../application/workingOpexAdmission';
import { applyWorkingInput } from '../calculations/workingModelInputs';
import { calculateAuditedMonthlyCapex, calculateAuditedSourcesAndUses } from '../calculations/constructionFundingEngine';
import { calculateAuditedDebtAndOperations } from '../calculations/auditedOperatingEngine';

interface Props { kind: 'timeline' | 'opex'; assumptions: FullModelAssumptions; onUpdateAssumptions: (a: FullModelAssumptions) => void }
export function WorkingInputEditor({ kind, assumptions, onUpdateAssumptions }: Props) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [editBase, setEditBase] = useState<string | null>(null);
  const active = assumptions.workingInputs?.[kind];
  let editing: any = null;
  try { const parsed = JSON.parse(text); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) editing = parsed; } catch { /* Raw JSON remains editable while malformed. */ }
  const edit = (patch: Record<string, unknown>) => { setEditBase(base => base ?? JSON.stringify(assumptions)); setText(JSON.stringify({ ...editing, ...patch }, null, 2)); setMessage('Unapplied edits. The model still uses the last admitted inputs.'); };
  const numberInput = (value: string) => value === '' ? null : Number(value);
  const updateLine = (index: number, patch: Record<string, unknown>) => edit({ lines: editing.lines.map((line: any, i: number) => i === index ? { ...line, ...patch } : line) });
  const updateQuantity = (lineIndex: number, quantityIndex: number, patch: Record<string, unknown>) => {
    const line = editing.lines[lineIndex];
    const quantities = Array.isArray(line.quantities) ? line.quantities : [];
    updateLine(lineIndex, { quantities: quantities.map((quantity: any, i: number) => i === quantityIndex ? { ...quantity, ...patch } : quantity) });
  };

  const load = () => {
    const metadata = { projectId: '', modelProjectName: assumptions.project.projectName, sourceReference: '', version: '', effectiveDate: null, changeReason: '', status: 'DRAFT' };
    const template = kind === 'timeline' ? {
      ...metadata, constructionStartDate: assumptions.project.constructionStartDate, codDate: assumptions.project.codDate,
      constructionPeriodMonths: assumptions.project.constructionPeriodMonths, operatingPeriodYears: assumptions.project.operatingPeriodYears,
      repaymentPeriodYears: assumptions.funding.repaymentPeriodYears, milestones: [],
    } : { ...metadata, populationComplete: false, lines: [{ id: '', description: '', enabled: true, kind: 'FIXED_ANNUAL', amount: null, currency: 'IDR', amountScale: 1000000000, unit: 'IDR_BILLION_PER_YEAR', driver: 'NONE', quantities: [], escalationPct: null, firstOperatingYear: 1, lastOperatingYear: assumptions.project.operatingPeriodYears, sourceReference: '' }] };
    setEditBase(JSON.stringify(assumptions));
    setText(JSON.stringify(active ?? template, null, 2));
    setMessage('Template only. No inputs have been applied. Fill missing fields explicitly.');
  };
  const apply = () => {
    try {
      if (editBase !== null && editBase !== JSON.stringify(assumptions)) throw new Error('The model changed after editing began. Reload the admitted input and reapply your changes explicitly');
      const candidate = applyWorkingInput(assumptions, kind, JSON.parse(text));
      // Preflight the same command adapter as the controller; no raw-JSON bypass.
      const next = kind === 'opex' ? admitWorkingOpexDraft(assumptions, candidate).assumptions : candidate;
      // Execute the same engine before admitting the working population; no preview economics in the UI.
      const monthly = calculateAuditedMonthlyCapex(next);
      const uses = calculateAuditedSourcesAndUses(next, monthly);
      const result = calculateAuditedDebtAndOperations(next, uses);
      const fields = ['totalOpexIdrBillion', 'ebitdaIdrBillion', 'cfadsIdrBillion', 'equityCashFlow'] as const;
      if (result.annualRows.some(row => fields.some(k => !Number.isFinite(row[k])))) throw new Error('Working inputs produce a non-finite operating schedule.');
      onUpdateAssumptions(next);
      setEditBase(JSON.stringify(next));
      setMessage('Applied to the working model. DRAFT · In memory only · Not approved or persisted.');
    } catch (e) { setMessage(`Blocked: ${e instanceof Error ? e.message : 'Invalid input'}. The last admitted model is unchanged.`); }
  };
  return <section className="rounded-lg border border-stone-200 bg-[#fffdfa] p-4 space-y-3 text-xs" data-working-editor={kind}>
    <h3 className="font-bold text-slate-900">{kind === 'timeline' ? 'Timeline working input' : 'OPEX working input master'}</h3>
    <p>Explicit application replaces {kind === 'timeline' ? 'the five model timing inputs' : 'the complete legacy OPEX total'} for this session. No Actual, baseline, source verification or approval is created.</p>
    <p className="text-amber-800">{active ? `DRAFT · ${active.projectId} · ${active.version} · ${active.sourceReference}` : 'MODEL ASSUMPTION / LEGACY COMPATIBILITY · No working master admitted'}</p>
    {kind === 'timeline' ? <p>Milestone dates (development, financial close, notice to proceed, debt commencement, maturity, contract expiry or custom types) are retained as reference only. The current annual engine uses COD and repayment years; it does not implement milestone-specific debt timing.</p> : <p>Cost kinds: FIXED_ANNUAL, PER_UNIT, PERCENT_OF_DRIVER. PER_UNIT amounts are IDR billion per stated quantity unit with one explicit quantity per operating year. Percentage drivers: MODEL_REVENUE or MODEL_CAPITALIZED_BASIS (a compatibility PPE proxy). Escalation starts at operating year one. Disabled/out-of-period lines are Not Applicable. No automatic migration or FX.</p>}
    <button type="button" onClick={load} className="border border-stone-300 rounded px-3 py-1.5">{active ? 'Load admitted input for editing' : 'Prepare input template'}</button>
    {editing && <div className="space-y-4 border-t border-stone-200 pt-3">
      <div className="grid gap-3 sm:grid-cols-3">{['projectId', 'sourceReference', 'version', 'effectiveDate', 'changeReason'].map(key => <label key={key} className="block text-slate-600">{{ projectId: 'Project identity', sourceReference: 'Source / reference', version: 'Working version', effectiveDate: 'Effective date', changeReason: 'Change reason' }[key]}<input aria-label={`${kind} ${key}`} type={key === 'effectiveDate' ? 'date' : 'text'} value={editing[key] ?? ''} onChange={e => edit({ [key]: e.target.value })} className="mt-1 block w-full rounded border border-stone-300 bg-white p-2" /></label>)}</div>
      {kind === 'timeline' ? <>
        <div className="grid gap-3 sm:grid-cols-3">{['constructionStartDate', 'codDate', 'constructionPeriodMonths', 'operatingPeriodYears', 'repaymentPeriodYears'].map(key => <label key={key} className="block text-slate-600">{{ constructionStartDate: 'Construction start', codDate: 'COD', constructionPeriodMonths: 'Construction months', operatingPeriodYears: 'Operating years', repaymentPeriodYears: 'Repayment years' }[key]}<input aria-label={`timeline ${key}`} type={key.endsWith('Date') ? 'date' : 'number'} value={editing[key] ?? ''} onChange={e => edit({ [key]: key.endsWith('Date') ? e.target.value : numberInput(e.target.value) })} className="mt-1 block w-full rounded border border-stone-300 bg-white p-2" /></label>)}</div>
        <p>Additional milestones are reference inputs; they do not silently alter debt or concession economics.</p>
        {Array.isArray(editing.milestones) && editing.milestones.map((m: any, i: number) => m && typeof m === 'object' ? <div key={i} className="grid gap-2 sm:grid-cols-3">{['id','type','plannedDate','currentDate','actualDate','sourceReference'].map(key => <label key={key}>{key}<input aria-label={`Milestone ${i+1} ${key}`} type={key.endsWith('Date') ? 'date' : 'text'} value={m[key] ?? ''} onChange={e => edit({ milestones: editing.milestones.map((v: any,j: number) => i === j ? { ...v, [key]: e.target.value || null } : v) })} className="block w-full rounded border border-stone-300 bg-white p-2" /></label>)}<button type="button" onClick={() => edit({ milestones: editing.milestones.filter((_:unknown,j:number) => j !== i) })} className="text-left underline">Remove milestone</button></div> : <p key={i}>Malformed milestone: correct the JSON before applying.</p>)}
        <button type="button" onClick={() => edit({ milestones: [...(Array.isArray(editing.milestones) ? editing.milestones : []), { id:'', type:'', plannedDate:null, currentDate:null, actualDate:null, sourceReference:'' }] })} className="border rounded px-3 py-1.5">Add reference milestone</button>
      </> : <>
        <label className="block"><input type="checkbox" checked={editing.populationComplete === true} onChange={e => edit({ populationComplete: e.target.checked })} /> I explicitly confirm this is the complete working OPEX population</label>
        {Array.isArray(editing.lines) && editing.lines.map((line: any, i: number) => line && typeof line === 'object' ? <div key={i} className="border-t border-stone-200 pt-3 space-y-2">
          <div className="flex gap-4"><label><input type="checkbox" checked={line.enabled === true} onChange={e => updateLine(i,{enabled:e.target.checked})} /> Enabled</label><button type="button" onClick={() => edit({lines:editing.lines.filter((_:unknown,j:number) => j !== i)})} className="underline">Remove working line {i+1}</button></div>
          <div className="grid gap-2 sm:grid-cols-4">{['id','description','amount','unit','escalationPct','firstOperatingYear','lastOperatingYear','sourceReference'].map(key => <label key={key}>{key}<input aria-label={`OPEX line ${i+1} ${key}`} type={['amount','escalationPct','firstOperatingYear','lastOperatingYear'].includes(key) ? 'number' : 'text'} readOnly={key === 'id' && !!assumptions.workingInputs?.opex?.lines.some(admitted => admitted.id === line.id)} value={line[key] ?? ''} onChange={e => updateLine(i,{[key]:['amount','escalationPct','firstOperatingYear','lastOperatingYear'].includes(key) ? numberInput(e.target.value) : e.target.value})} className="block w-full rounded border border-stone-300 bg-white p-2" /></label>)}
          <label>Cost kind<select aria-label={`OPEX line ${i+1} kind`} value={line.kind ?? ''} onChange={e => updateLine(i,{kind:e.target.value})} className="block w-full rounded border p-2">{['FIXED_ANNUAL','PER_UNIT','PERCENT_OF_DRIVER'].map(k => <option key={k}>{k}</option>)}</select></label>
          <label>Driver<select aria-label={`OPEX line ${i+1} driver`} value={line.driver ?? ''} onChange={e => updateLine(i,{driver:e.target.value})} className="block w-full rounded border p-2">{['NONE','EXPLICIT_QUANTITY','MODEL_REVENUE','MODEL_CAPITALIZED_BASIS'].map(k => <option key={k}>{k}</option>)}</select></label></div>
          {line.kind === 'PER_UNIT' && <div className="rounded border border-stone-200 bg-stone-50/60 p-3 space-y-2" data-opex-quantities={line.id || i}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-slate-800">Annual quantity population</h4><p className="text-slate-500">One explicit quantity per operating year. No quantity is inferred from generation, revenue or another model driver.</p></div><button type="button" onClick={() => updateLine(i,{quantities:[...(Array.isArray(line.quantities) ? line.quantities : []),{year:null,quantity:null}]})} className="border border-stone-300 rounded px-2.5 py-1.5 bg-white">Add annual quantity</button></div>
            {Array.isArray(line.quantities) && line.quantities.length > 0 ? <div className="grid gap-2">{line.quantities.map((quantity:any,q:number) => quantity && typeof quantity === 'object' ? <div key={q} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end"><label>Operating year<input aria-label={`OPEX line ${i+1} quantity ${q+1} year`} type="number" min="1" value={quantity.year ?? ''} onChange={e => updateQuantity(i,q,{year:numberInput(e.target.value)})} className="block w-full rounded border border-stone-300 bg-white p-2" /></label><label>Quantity<input aria-label={`OPEX line ${i+1} quantity ${q+1} amount`} type="number" value={quantity.quantity ?? ''} onChange={e => updateQuantity(i,q,{quantity:numberInput(e.target.value)})} className="block w-full rounded border border-stone-300 bg-white p-2" /></label><button type="button" onClick={() => updateLine(i,{quantities:line.quantities.filter((_:unknown,j:number)=>j!==q)})} className="underline pb-2">Remove</button></div> : <p key={q}>Malformed quantity row: correct the Advanced JSON before applying.</p>)}</div> : <p className="text-amber-800">No annual quantities supplied. Apply will remain blocked until the governed working-input contract is satisfied.</p>}
          </div>}
          <p className="text-slate-500">IDR billion basis. Unit and driver must be selected explicitly; changing kind does not infer a conversion. Admitted row IDs are read-only here; changing an ID in Advanced JSON records a deletion and a new row, not a rename.</p>
        </div> : <p key={i}>Malformed cost line: correct the Advanced JSON before applying.</p>)}
        <button type="button" onClick={() => edit({ lines: [...(Array.isArray(editing.lines) ? editing.lines : []), { id:'',description:'',enabled:true,kind:'FIXED_ANNUAL',amount:null,currency:'IDR',amountScale:1000000000,unit:'IDR_BILLION_PER_YEAR',driver:'NONE',quantities:[],escalationPct:null,firstOperatingYear:1,lastOperatingYear:assumptions.project.operatingPeriodYears,sourceReference:'' }] })} className="border rounded px-3 py-1.5">Add working cost line</button>
      </>}
    </div>}
    <details className="border-t border-stone-200 pt-3"><summary className="cursor-pointer font-semibold text-slate-700">Advanced · exact working-input JSON</summary><p className="mt-2 text-slate-500">Use for exact payload inspection or recovery. Normal OPEX line and annual-quantity editing is available above.</p><textarea aria-label={`${kind} working input JSON`} value={text} onChange={e => { setEditBase(base => base ?? JSON.stringify(assumptions)); setText(e.target.value); setMessage('Unapplied edits. The model still uses the last admitted inputs.'); }} className="mt-2 block w-full min-h-44 rounded border border-stone-300 bg-white p-3 font-mono" spellCheck={false} /></details>
    <button type="button" onClick={apply} className="rounded bg-slate-900 text-white px-3 py-2">Apply {kind} working input</button>
    <p role="status">{message}</p>
  </section>;
}
