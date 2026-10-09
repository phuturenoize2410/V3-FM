import { ScheduleSourceReviewPanel } from '../ScheduleSourceReviewPanel';
import React from 'react';
import {
  FullModelAssumptions,
  SourcesAndUses,
  AnnualOperatingRow,
  CurrencyDisplay,
} from '../../types';
import {
  Building,
  AlertTriangle,
} from 'lucide-react';

interface FixedAssetsTabProps {
  assumptions: FullModelAssumptions;
  sourcesAndUses: SourcesAndUses;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const FixedAssetsTab: React.FC<FixedAssetsTabProps> = ({
  assumptions,
  sourcesAndUses,
  annualRows,
  currencyDisplay,
}) => {
  const { capexItems, project } = assumptions;

  const mult =
    currencyDisplay === 'IDR_B'
      ? 1
      : currencyDisplay === 'IDR_M'
      ? 1000
      : currencyDisplay === 'USD_M'
      ? 1 / (assumptions.revenue.fxIdrPerUsd / 1000)
      : (1000 / assumptions.revenue.fxIdrPerUsd) * 1000;

  const unitLabel =
    currencyDisplay === 'IDR_B'
      ? 'IDR Billion'
      : currencyDisplay === 'IDR_M'
      ? 'IDR Million'
      : currencyDisplay === 'USD_M'
      ? 'USD Million'
      : 'USD Thousand';

  // Legacy model-derived proxy only. The live path does not currently retain
  // capitalization-policy evidence proving that every residual use is PPE.
  const initialGrossPpeProxy =
    sourcesAndUses.totalUses -
    sourcesAndUses.initialWorkingCapital -
    sourcesAndUses.dsraPreFunding;

  return (
    <div className="space-y-4 text-xs">
      <ScheduleSourceReviewPanel kind="ppe" assumptions={assumptions} annualRows={annualRows} sourcesAndUses={sourcesAndUses} />
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            11
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Fixed Asset Register & Capitalization Engine
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              CWIP to In-Service Asset Transfer, Asset Classes & Gross PPE Roll-Forward
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-amber-800 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Capitalization Evidence Not Connected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Model-Derived PPE Proxy</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {(initialGrossPpeProxy * mult).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{unitLabel} · not a verified capitalization amount</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Base Physical Capex</div>
          <div className="text-base font-black text-slate-800 mt-1">
            {(sourcesAndUses.baseCapexTotal * mult).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">{unitLabel}</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Project COD</div>
          <div className="text-base font-black text-blue-700 mt-1">{project.codDate}</div>
          <div className="text-[10px] text-blue-600 font-sans mt-0.5">Transfer verification unavailable</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Asset Useful Lives</div>
          <div className="text-base font-black text-slate-900 mt-1">Per CAPEX Item</div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">Compatibility engine uses operating horizon</div>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-700" />
            CAPEX Item Reference Schedule
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2 text-left">Asset Category / Item</th>
                <th className="p-2 text-left">Classification</th>
                <th className="p-2">Useful Life</th>
                <th className="p-2">Model Period</th>
                <th className="p-2">Transfer Evidence</th>
                <th className="p-2 text-blue-700">% of PPE Proxy</th>
                <th className="p-2 font-black">Model CAPEX Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {capexItems.map((item) => {
                const pct = (item.amountIdrBillion / initialGrossPpeProxy) * 100;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2 text-left font-bold text-slate-900 font-sans">{item.name}</td>
                    <td className="p-2 text-left font-sans text-slate-500 uppercase text-[10px]">{item.category.replace('_', ' ')}</td>
                    <td className="p-2 text-slate-600">{item.usefulLifeYears} Yrs</td>
                    <td className="p-2 text-slate-500">M{item.startMonth} - M{item.endMonth}</td>
                    <td className="p-2 text-amber-700 font-semibold">Unavailable</td>
                    <td className="p-2 text-blue-700 font-medium">{Number.isFinite(pct) ? pct.toFixed(1) + '%' : 'Not Calculated'}</td>
                    <td className="p-2 font-bold text-slate-900">{(item.amountIdrBillion * mult).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td colSpan={5} className="p-2 text-left font-sans uppercase">Model-Derived Initial Gross PPE Proxy</td>
                <td className="p-2 text-blue-700">100.0%</td>
                <td className="p-2">{(initialGrossPpeProxy * mult).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="font-bold uppercase tracking-wider text-slate-800">PPE SCHEDULE = BLOCKED</span>
            <div className="text-[10px] text-amber-700 mt-0.5">Opening PPE, CIP capitalization, additions, disposals and depreciation policy require explicit source populations. Closing gross, accumulated depreciation and net PPE are blocked together. The existing engine still uses a residual Sources & Uses proxy depreciated over the operating horizon; it is not this governed schedule.</div>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2 text-left sticky left-0 bg-slate-100 z-10 w-44">Metric</th>
                {annualRows.map((r) => <th key={r.year} className="p-2 min-w-[70px]">Y{r.year}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 text-left font-bold text-slate-800 sticky left-0 bg-white z-10 font-sans">Gross PPE Opening</td>
                {annualRows.map((r) => <td key={r.year} className="p-2 text-slate-600">Blocked</td>)}
              </tr>
              <tr>
                <td className="p-2 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans">Additions / Sustaining Capex</td>
                {annualRows.map((r) => <td key={r.year} className="p-2 text-amber-700">Missing</td>)}
              </tr>
              <tr>
                <td className="p-2 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans">Disposals / Retirements</td>
                {annualRows.map((r) => <td key={r.year} className="p-2 text-amber-700">Missing</td>)}
              </tr>
              <tr className="bg-slate-50 font-bold border-t border-slate-300">
                <td className="p-2 text-left font-bold text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans">Gross PPE Model Output</td>
                {annualRows.map((r) => <td key={r.year} className="p-2 text-slate-900 font-bold">Blocked</td>)}
              </tr>
              <tr>
                <td className="p-2 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans">Accumulated Depreciation</td>
                {annualRows.map((r) => <td key={r.year} className="p-2 text-rose-700">Blocked</td>)}
              </tr>
              <tr className="bg-blue-50/50 font-black border-t-2 border-slate-300 text-blue-900">
                <td className="p-2 text-left font-black text-blue-900 sticky left-0 bg-blue-50/80 z-10 font-sans">Net PPE Model Output</td>
                {annualRows.map((r) => <td key={r.year} className="p-2 text-blue-900">Blocked</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
