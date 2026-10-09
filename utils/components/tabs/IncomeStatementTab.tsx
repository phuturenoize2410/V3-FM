import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  CurrencyDisplay,
} from '../../types';
import {
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';

interface IncomeStatementTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const IncomeStatementTab: React.FC<IncomeStatementTabProps> = ({
  assumptions,
  annualRows,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
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

  // The audited operating engine uses the canonical AnnualOperatingRow field names.
  // Keep all P&L presentation derived from those fields so UI aliases cannot drift
  // from the model engine and render undefined -> NaN.
  const otherOpex = (r: AnnualOperatingRow) =>
    r.landWaterCharges + r.adminEmployees + r.maintenanceReserve;

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            14
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Income Statement (Profit & Loss)
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              30-Year Operational P&L, EBITDA, Depreciation, Financing & Net Income
            </p>
          </div>
        </div>

        <button
          disabled
            title="Formula trace unavailable for net_income: no live trace node is supplied."
          className="disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium text-slate-700 flex items-center gap-1 cursor-default transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          Trace Net Income
        </button>
      </div>

      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            30-Year Profit & Loss Statement (Operating Years 1 - 30)
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2.5 text-left sticky left-0 bg-slate-100 z-10 w-64 finmod-sticky-col">Line Item</th>
                {annualRows.map((r) => (
                  <th key={r.year} className="p-2.5 min-w-[70px]">Y{r.year}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-slate-50/70 font-semibold hover:bg-slate-100/50 transition-colors">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans finmod-sticky-col">Total Generation Revenue</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-900 font-bold">{(r.revenueIdrBillion * mult).toFixed(1)}</td>)}
              </tr>
              {assumptions.workingInputs?.opex ? (
                <>
                  <tr className="bg-amber-50/60 font-medium">
                    <td colSpan={annualRows.length + 1} className="p-2.5 text-left text-amber-800 sticky left-0 bg-amber-50 z-10 font-sans finmod-sticky-col">
                      Active Working OPEX Master ({assumptions.workingInputs.opex.lines.length} lines)
                    </td>
                  </tr>
                  {assumptions.workingInputs.opex.lines.map((line, lineIdx) => (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                        {line.description || line.id}
                      </td>
                      {annualRows.map((r) => {
                        const lineAmt = r.workingOpexLines?.[lineIdx]?.amount ?? 0;
                        return (
                          <td key={r.year} className="p-2.5 text-slate-500">
                            -{(lineAmt * mult).toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">Fixed O&M Expense</td>
                    {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-500">-{(r.fixedOpex * mult).toFixed(1)}</td>)}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">Variable O&M Expense</td>
                    {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-500">-{(r.variableOpex * mult).toFixed(1)}</td>)}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">Insurance Expense</td>
                    {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-500">-{(r.insurance * mult).toFixed(1)}</td>)}
                  </tr>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">Land, Water, Admin & Maintenance Reserve</td>
                    {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-500">-{(otherOpex(r) * mult).toFixed(1)}</td>)}
                  </tr>
                  {annualRows.some((r) => (r.customOpex || 0) > 0) && (
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">Custom & Manual OPEX</td>
                      {annualRows.map((r) => <td key={r.year} className="p-2.5 text-purple-700 font-mono">-{(Math.max(0, r.customOpex || 0) * mult).toFixed(1)}</td>)}
                    </tr>
                  )}
                </>
              )}
              <tr className="bg-slate-100 font-bold border-t border-slate-300">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-100 z-10 font-sans font-black finmod-sticky-col">EBITDA</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-900 font-bold">{(r.ebitdaIdrBillion * mult).toFixed(1)}</td>)}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans finmod-sticky-col">(-) Accounting Depreciation</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-rose-700">-{(r.accountingDepreciation * mult).toFixed(1)}</td>)}
              </tr>
              <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans finmod-sticky-col">Operating Profit (EBIT)</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-800 font-semibold">{(r.ebitIdrBillion * mult).toFixed(1)}</td>)}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans finmod-sticky-col">(-) Senior Debt Interest Expense</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-rose-700">-{(r.debtInterestExpense * mult).toFixed(1)}</td>)}
              </tr>
              <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans finmod-sticky-col">Earnings Before Tax (EBT)</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-slate-800 font-semibold">{(r.ebtIdrBillion * mult).toFixed(1)}</td>)}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-600 sticky left-0 bg-white z-10 font-sans finmod-sticky-col">(-) Corporate Income Tax ({assumptions.tax.corporateIncomeTaxRatePct.toFixed(0)}%)</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-rose-700">-{(r.corporateTax * mult).toFixed(1)}</td>)}
              </tr>
              <tr className="bg-blue-50/80 font-black border-t-2 border-slate-400 text-blue-950">
                <td className="p-2.5 text-left text-blue-950 sticky left-0 bg-blue-50/95 z-10 font-sans finmod-sticky-col">Net Income (PAT)</td>
                {annualRows.map((r) => <td key={r.year} className="p-2.5 text-blue-950 font-black">{(r.netIncomeIdrBillion * mult).toFixed(1)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
