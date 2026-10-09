import type { FullModelAssumptions, AnnualOperatingRow, SourcesAndUses } from '../types';

interface SourceIdentity {
  evidenceUse: 'source_evidence'; projectId: string; modelProjectName: string;
  sourceReference: string; version: string; effectiveDate: string;
  currency: 'IDR'; amountScale: 1000000000;
}
export interface DsraSourceTerms extends SourceIdentity {
  facilityId: string;
  requirementBasis: 'NEXT_ANNUAL_DEBT_SERVICE_PRO_RATA';
  targetMonths: number;
  eligibleDebtService: 'SENIOR_PRINCIPAL_PLUS_INTEREST';
  openingBalance: number;
  fundingMechanics: 'CASH_TOP_UP_TO_TARGET';
  drawMechanics: 'NO_DRAW_MODELED';
  releaseMechanics: 'EXCESS_ABOVE_TARGET';
  reserveForm: 'CASH';
}
export interface PpeSourcePopulation extends SourceIdentity {
  depreciationPolicyReference: string;
  openingGross: number;
  openingAccumulatedDepreciation: number;
  /** Explicit source allocation of the current model CAPEX population. */
  codTransfers: Array<{ capexItemId: string; amount: number; sourceReference: string }>;
  otherOpeningCapitalization: number;
  populationComplete: true;
  rows: Array<{ year: number; additions: number; disposals: number; accumulatedDepreciationDisposed: number; depreciation: number; sourceReference: string }>;
}
export interface ReviewedScheduleRow { year: number; values: Record<string, number> }
export interface ScheduleSourceReview {
  ready: boolean; rows: ReviewedScheduleRow[]; blockers: string[];
  provenance: null | { source: Readonly<SourceIdentity>; assumptions: FullModelAssumptions; annualRows: AnnualOperatingRow[]; sourcesAndUses: SourcesAndUses };
}
const exact = (v: unknown) => typeof v === 'string' && v.length > 0 && v.trim() === v;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const equal = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8;

/** Reconcile explicit source terms/populations to the exact live run, without
 * overwriting compatibility economics. Source references are caller declarations,
 * not authentication, baseline approval, or durable evidence. */
export function reviewScheduleSource(kind: 'dsra' | 'ppe', input: unknown, assumptions: FullModelAssumptions, sourcesAndUses: SourcesAndUses, annualRows: AnnualOperatingRow[]): ScheduleSourceReview {
  const blockers: string[] = [];
  const rows: ReviewedScheduleRow[] = [];
  try {
    const source = input as SourceIdentity;
    if (source?.evidenceUse !== 'source_evidence') blockers.push('Explicit source evidence is required; demo/manual inputs do not qualify.');
    for (const key of ['projectId', 'modelProjectName', 'sourceReference', 'version'] as const) if (!exact(source[key])) blockers.push(`${key} is missing or malformed.`);
    if (source.modelProjectName !== assumptions.project.projectName) blockers.push('Source project binding differs from the live model.');
    const projectIds = Object.values(assumptions.workingInputs ?? {}).map(v => v.projectId);
    if (projectIds.some(id => id !== source.projectId)) blockers.push('Source project identity differs from active working inputs.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.effectiveDate) || !Number.isFinite(Date.parse(source.effectiveDate)) || new Date(source.effectiveDate).toISOString().slice(0,10) !== source.effectiveDate) blockers.push('A real effective calendar date is required.');
    if (source.effectiveDate > assumptions.project.codDate) blockers.push('Source must be effective at COD for this full-horizon review.');
    if (source.currency !== 'IDR' || source.amountScale !== 1e9) blockers.push('The live adapter requires explicit IDR billion; no currency/scale conversion is inferred.');
    if (annualRows.length !== assumptions.project.operatingPeriodYears || annualRows.some((r, i) => r.year !== i + 1)) blockers.push('The live operating period population is incomplete or unordered.');
    if (kind === 'dsra') {
      const terms = input as DsraSourceTerms;
      if (!exact(terms.facilityId)) blockers.push('Explicit facility identity is required.');
      const supported = { requirementBasis: 'NEXT_ANNUAL_DEBT_SERVICE_PRO_RATA', eligibleDebtService: 'SENIOR_PRINCIPAL_PLUS_INTEREST', fundingMechanics: 'CASH_TOP_UP_TO_TARGET', drawMechanics: 'NO_DRAW_MODELED', releaseMechanics: 'EXCESS_ABOVE_TARGET', reserveForm: 'CASH' };
      for (const [key,value] of Object.entries(supported)) if ((terms as any)[key] !== value) blockers.push(`${key} is missing or differs from the current model mechanics; a financing-engine extension is required.`);
      if (!amount(terms.targetMonths) || terms.targetMonths !== assumptions.funding.dsraRequirementMonths) blockers.push('Source target months must match the explicitly selected model input.');
      if (!amount(terms.openingBalance) || !equal(terms.openingBalance, sourcesAndUses.dsraPreFunding)) blockers.push('Source opening reserve must reconcile to current Sources & Uses prefunding.');
      if (annualRows.some(row => !equal(row.debtServiceIdrBillion, row.principalRepayment + row.interestPayment))) blockers.push('Eligible debt service does not reconcile to retained senior principal plus interest.');
      let opening = terms.openingBalance;
      annualRows.forEach((row, i) => {
        // Explicit model boundary: no debt period beyond the complete modeled horizon.
        const service = i + 1 < annualRows.length ? annualRows[i + 1].debtServiceIdrBillion : 0;
        const target = service * terms.targetMonths / 12;
        const funding = Math.max(0, target - opening), release = Math.max(0, opening - target), closing = opening + funding - release;
        if (!equal(row.requiredDsra,target) || !equal(row.openingDsra,opening) || !equal(row.dsraFunding,funding) || !equal(row.dsraRelease,release) || !equal(row.closingDsra,closing)) blockers.push(`DSRA year ${row.year} does not reconcile to source terms.`);
        rows.push({ year: row.year, values: { target, opening, funding, release, closing } }); opening = closing;
      });
    } else {
      const ppe = input as PpeSourcePopulation;
      if (!exact(ppe.depreciationPolicyReference) || ppe.populationComplete !== true) blockers.push('Complete PPE population and explicit depreciation policy reference are required.');
      if (!amount(ppe.openingGross) || !amount(ppe.openingAccumulatedDepreciation) || !amount(ppe.otherOpeningCapitalization)) blockers.push('Opening capitalization and accumulated depreciation must be explicit non-negative amounts.');
      if (!Array.isArray(ppe.codTransfers) || !Array.isArray(ppe.rows)) throw new Error('Missing source populations');
      const ids = ppe.codTransfers.map(t => t.capexItemId);
      if (new Set(ids).size !== ids.length || ids.length !== assumptions.capexItems.length || assumptions.capexItems.some(item => !ids.includes(item.id))) blockers.push('COD transfer allocation must identify every current CAPEX item exactly once.');
      for (const t of ppe.codTransfers) {
        const capex = assumptions.capexItems.find(item => item.id === t.capexItemId);
        if (!exact(t.sourceReference) || !amount(t.amount) || !capex || !equal(t.amount, capex.amountIdrBillion)) blockers.push(`CAPEX transfer ${t.capexItemId} is incomplete or mismatched; partial capitalization is not inferred.`);
      }
      if (!equal(ppe.openingGross, ppe.codTransfers.reduce((sum,t) => sum + t.amount, 0) + ppe.otherOpeningCapitalization)) blockers.push('Opening gross PPE must reconcile to explicit CAPEX transfers plus other capitalization.');
      if (ppe.rows.length !== annualRows.length) blockers.push('PPE source periods must cover the complete live horizon.');
      if (!annualRows[0] || !equal(ppe.openingGross, annualRows[0].grossFixedAssets) || !equal(ppe.openingAccumulatedDepreciation, annualRows[0].accumulatedDepreciationOpening)) blockers.push('Source opening PPE and accumulated depreciation differ from the live model opening.');
      let gross = ppe.openingGross, accumulated = ppe.openingAccumulatedDepreciation;
      ppe.rows.forEach((sourceRow, i) => {
        const model = annualRows[i];
        for (const k of ['additions','disposals','accumulatedDepreciationDisposed','depreciation'] as const) if (!amount(sourceRow[k])) blockers.push(`PPE year ${sourceRow.year}: ${k} must be explicit; missing is not zero.`);
        if (!model || sourceRow.year !== i + 1 || !exact(sourceRow.sourceReference)) { blockers.push('PPE source period identity/order/reference mismatch.'); return; }
        const opening = gross; gross += sourceRow.additions - sourceRow.disposals;
        accumulated += sourceRow.depreciation - sourceRow.accumulatedDepreciationDisposed;
        if (gross < 0 || accumulated < 0 || accumulated > gross || sourceRow.accumulatedDepreciationDisposed > sourceRow.disposals) blockers.push(`PPE year ${sourceRow.year}: invalid roll-forward.`);
        if (!equal(gross,model.grossFixedAssets) || !equal(accumulated,model.accountingAccumDepreciation) || !equal(sourceRow.depreciation,model.accountingDepreciation) || !equal(gross-accumulated,model.accountingNbv)) blockers.push(`PPE year ${sourceRow.year} differs from the live depreciation run; source does not replace model automatically.`);
        rows.push({ year: sourceRow.year, values: { opening, additions: sourceRow.additions, disposals: sourceRow.disposals, gross, depreciation: sourceRow.depreciation, accumulated, net: gross-accumulated } });
      });
    }
    if (rows.some(r => Object.values(r.values).some(v => !Number.isFinite(v)))) blockers.push('Source schedule contains a non-finite calculation.');
    if (blockers.length) return { ready: false, rows: [], blockers, provenance: null };
    // JSON ingress cannot carry cyclic payloads; retain a detached source snapshot.
    const retained = JSON.parse(JSON.stringify(source));
    const freeze = (v: any): any => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
    return { ready: true, rows, blockers, provenance: { source: freeze(retained), assumptions, annualRows, sourcesAndUses } };
  } catch { return { ready: false, rows: [], blockers: [...blockers, 'Malformed source package; schedule remains blocked.'], provenance: null }; }
}
