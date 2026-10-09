import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatPercent,
  formatNumber,
} from '../../utils/formatters';
import { Building, ShieldCheck, HelpCircle } from 'lucide-react';

interface DepreciationTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
}

export const DepreciationTab: React.FC<DepreciationTabProps> = ({
  assumptions,
  annualRows,
  currencyDisplay,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Fixed Assets Roll-Forward & Depreciation Schedule
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial accounting straight-line depreciation vs Indonesian fiscal tax depreciation rules.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Accounting Straight-Line (30-Yr Asset Life)</span>
        </div>
      </div>

      {/* Asset Schedule Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Fixed Assets Balance Sheet Roll-Forward (IDR Billion)</span>
          <span>Asset Class: Clean Hydro Power Plant Infrastructure</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-center py-2.5 px-3">Year</th>
                <th className="text-right py-2.5 px-3">Opening Gross PP&E</th>
                <th className="text-right py-2.5 px-3">Capex Additions</th>
                <th className="text-right py-2.5 px-3">Closing Gross PP&E</th>
                <th className="text-right py-2.5 px-3">Opening Acc. Depr.</th>
                <th className="text-right py-2.5 px-3">Annual Depr. Expense</th>
                <th className="text-right py-2.5 px-3">Closing Acc. Depr.</th>
                <th className="text-right py-2.5 px-3">Ending Net Book Value (NBV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {annualRows.map((row) => (
                <tr key={row.year} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-center font-bold text-slate-800">
                    Yr {row.year}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700">
                    {row.grossFixedAssets.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400">
                    0.00
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700">
                    {(row.grossFixedAssets ?? row.bsPpeNbv ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-500">
                    {(row.accumulatedDepreciationOpening ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-rose-700">
                    {(row.depreciationExpense ?? row.accountingDepreciation ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700">
                    {(row.accumulatedDepreciationEnding ?? row.accountingAccumDepreciation ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">
                    {(row.netFixedAssetsEnding ?? row.accountingNbv ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 font-mono">
              <tr>
                <td colSpan={5} className="py-2.5 px-3 text-left font-sans">
                  Cumulative Depreciated Over Concession
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700">
                  {annualRows.reduce((s, r) => s + r.depreciationExpense, 0).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  {annualRows[annualRows.length - 1]?.accumulatedDepreciationEnding.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900">
                  {annualRows[annualRows.length - 1]?.netFixedAssetsEnding.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
