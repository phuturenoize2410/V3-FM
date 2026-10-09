import { formatNumber } from '../../utils/formatters';
import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  CurrencyDisplay,
} from '../../types';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

interface BalanceSheetTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const BalanceSheetTab: React.FC<BalanceSheetTabProps> = ({
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

  const maxDiff = Math.max(...annualRows.map((r) => Math.abs(r.bsDifference)));
  const isBalanced = maxDiff < 0.001;

  return (
    <div className="space-y-4 text-xs">
      {/* Title Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            15
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Balance Sheet & Accounting Balance Proof
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              30-Year Financial Position, Net PPE, Senior Debt, Equity & Cumulative Retained Earnings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded border font-bold flex items-center gap-1.5 ${
              isBalanced
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isBalanced ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>
              {isBalanced ? 'BALANCE SHEET PERFECTLY BALANCED (0.000 DIFF)' : 'BALANCE SHEET OUT OF BALANCE'}
            </span>
          </div>

          <button
            disabled
            title="Formula trace unavailable for bs_balance: no live trace node is supplied."
            className="disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium text-slate-700 flex items-center gap-1 cursor-default transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            Trace Balance
          </button>
        </div>
      </div>

      {/* Balance Sheet Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-slate-600" />
            30-Year Statement of Financial Position (Years 1 - 30)
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2.5 text-left sticky left-0 bg-slate-100 z-10 w-64 finmod-sticky-col">Balance Sheet Item</th>
                {annualRows.map((r) => (
                  <th key={r.year} className="p-2.5 min-w-[70px]">
                    Y{r.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* ASSETS */}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={annualRows.length + 1} className="p-2.5 text-left text-slate-900 uppercase font-sans finmod-sticky-col">
                  Assets
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  Cash and Cash Equivalents
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {((r.bsCash) * mult).toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  DSRA Reserve Account (Restricted Cash)
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {((r.bsDsra) * mult).toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  Property, Plant & Equipment (Net PPE)
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {formatNumber(r.bsPpeNbv * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  Working capital asset
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {formatNumber(r.bsWorkingCapital * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50 font-black border-t border-slate-300 text-slate-900">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans finmod-sticky-col">
                  Total Assets
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-900 font-bold">
                    {formatNumber(r.bsTotalAssets * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>

              {/* LIABILITIES */}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={annualRows.length + 1} className="p-2.5 text-left text-slate-900 uppercase font-sans finmod-sticky-col">
                  Liabilities
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  Senior Bank Loan Outstanding
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {((r.bsDebt) * mult).toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans finmod-sticky-col">
                  Total Liabilities
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-900 font-bold">
                    {formatNumber(r.totalLiabilities * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>

              {/* EQUITY */}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={annualRows.length + 1} className="p-2.5 text-left text-slate-900 uppercase font-sans finmod-sticky-col">
                  Equity
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  Paid-in Share Capital
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {formatNumber(r.bsShareCapital * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="p-2.5 text-left text-slate-700 sticky left-0 bg-white z-10 font-sans pl-4 finmod-sticky-col">
                  Retained Earnings
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-700">
                    {formatNumber(r.bsRetainedEarnings * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                <td className="p-2.5 text-left text-slate-900 sticky left-0 bg-slate-50 z-10 font-sans finmod-sticky-col">
                  Total Equity
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-slate-900 font-bold">
                    {formatNumber(r.totalEquity * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>

              {/* TOTAL LIABILITIES & EQUITY */}
              <tr className="bg-blue-50/80 font-black border-t-2 border-slate-400 text-blue-950">
                <td className="p-2.5 text-left text-blue-950 sticky left-0 bg-blue-50/95 z-10 font-sans finmod-sticky-col">
                  Total Liabilities & Equity
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-blue-950 font-black">
                    {formatNumber(r.bsTotalLiabEquity * mult, 1, 'Blocked')}
                  </td>
                ))}
              </tr>

              {/* AUDIT CHECK */}
              <tr className="bg-emerald-50/70 font-bold border-t border-emerald-300 text-emerald-900">
                <td className="p-2.5 text-left text-emerald-900 sticky left-0 bg-emerald-50/90 z-10 font-sans finmod-sticky-col">
                  Balance Difference (Assets - L&E)
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="p-2.5 text-emerald-800 font-mono font-bold">
                    {formatNumber(r.balanceSheetDifference * mult, 3, 'Blocked')}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
