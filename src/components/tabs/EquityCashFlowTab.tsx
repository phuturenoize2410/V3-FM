import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  ModelMetrics,
  SourcesAndUses,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatPercent,
  formatNumber,
} from '../../utils/formatters';
import { Users, ArrowUpRight, PieChart, Award } from 'lucide-react';

interface EquityCashFlowTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const EquityCashFlowTab: React.FC<EquityCashFlowTabProps> = ({
  assumptions,
  annualRows,
  metrics,
  sourcesAndUses,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const epnSharePct = assumptions.project.epnParticipationPct;
  const otherSharePct = assumptions.project.otherSponsorParticipationPct;

  const totalDividends = annualRows.reduce((s, r) => s + r.dividendsDistributed, 0);
  const epnDividends = totalDividends * (epnSharePct / 100);
  const otherDividends = totalDividends * (otherSharePct / 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Valuation Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Levered Equity Cash Flow (FCFE) & Investor Returns
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Free Cash Flow to Equity (FCFE) post-debt service, reserve accounts, and corporate taxes.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Equity IRR (XIRR)</span>
            <span className="text-emerald-800 text-sm font-bold font-mono">
              {formatPercent(metrics.equityIrrPct, 2)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Cost of Equity (Ke)</span>
            <span className="text-slate-800 text-sm font-bold font-mono">
              {formatPercent(assumptions.valuation.costOfEquityPct, 2)}
            </span>
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Equity NPV</span>
            <span className="text-blue-800 text-sm font-bold font-mono">
              {formatCurrencyValue(metrics.equityNpvIdrBillion, currencyDisplay, fx, 1)}
            </span>
          </div>

          <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Equity Payback</span>
            <span className="text-purple-800 text-sm font-bold font-mono">
              {metrics.equityPaybackPeriodYears.toFixed(1)} Yrs
            </span>
          </div>

          <button
            data-audit-key="equity_irr"
            onClick={() => onOpenAuditTrace('equity_irr')}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Audit XIRR Trace</span>
          </button>
        </div>
      </div>

      {/* Consortium Partnership Distribution Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                EPN Consortium Participation ({epnSharePct}%)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-600">Lead Sponsor</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Initial Equity Injection:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrencyValue(sourcesAndUses.equityAmount * (epnSharePct / 100), currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cumulative Concession Dividends:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {formatCurrencyValue(epnDividends, currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Equity Multiple (MoIC):</span>
              <span className="font-mono font-bold text-slate-900">
                {(epnDividends / (sourcesAndUses.equityAmount * (epnSharePct / 100))).toFixed(2)}x
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Other Consortium Partners ({otherSharePct}%)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600">Co-Sponsors</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Initial Equity Injection:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrencyValue(sourcesAndUses.equityAmount * (otherSharePct / 100), currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cumulative Concession Dividends:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {formatCurrencyValue(otherDividends, currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Equity Multiple (MoIC):</span>
              <span className="font-mono font-bold text-slate-900">
                {(otherDividends / (sourcesAndUses.equityAmount * (otherSharePct / 100))).toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FCFE Schedule Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Levered Free Cash Flow & Dividend Distribution Schedule (IDR Billion)</span>
          <span>Methodology: Date-based XIRR & XNPV</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-left py-2.5 px-3 min-w-[200px]">Cash Flow Element</th>
                <th className="text-right py-2.5 px-3 min-w-[100px]">Construction</th>
                {annualRows.map((r) => (
                  <th key={r.year} className="text-right py-2.5 px-3 min-w-[85px]">
                    Yr {r.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr>
                <td className="py-2 px-3 font-sans text-slate-900 font-semibold">Sponsor Equity Injected</td>
                <td className="py-2 px-3 text-right text-rose-700 font-bold">
                  ({sourcesAndUses.equityAmount.toFixed(2)})
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-slate-400">
                    -
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">Net Operating Cash Flow</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-slate-800">
                    {r.operatingCashFlow.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">Senior Debt Principal Repayment</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-rose-700">
                    ({r.principalRepayment.toFixed(2)})
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">Senior Debt Interest Paid</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-rose-700">
                    ({r.interestExpense.toFixed(2)})
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">DSRA Funding / Release</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => {
                  const m = r.dsraMovement ?? 0;
                  return (
                    <td key={r.year} className="py-2 px-3 text-right text-slate-600">
                      {m > 0.001
                        ? `(${m.toFixed(2)})`
                        : m < -0.001
                        ? `+${Math.abs(m).toFixed(2)}`
                        : '-'}
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-emerald-50 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2.5 px-3 font-sans text-sm">FREE CASH FLOW TO EQUITY (FCFE)</td>
                <td className="py-2.5 px-3 text-right text-rose-700 text-sm font-bold">
                  ({sourcesAndUses.equityAmount.toFixed(2)})
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2.5 px-3 text-right text-emerald-800 text-sm">
                    {r.fcfeIdrBillion.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans pl-6 text-blue-700 font-semibold">
                  EPN Share ({epnSharePct}%)
                </td>
                <td className="py-2 px-3 text-right text-rose-600">
                  ({(sourcesAndUses.equityAmount * (epnSharePct / 100)).toFixed(2)})
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-blue-700">
                    {(r.fcfeIdrBillion * (epnSharePct / 100)).toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans pl-6 text-slate-600">
                  Other Partners ({otherSharePct}%)
                </td>
                <td className="py-2 px-3 text-right text-rose-600">
                  ({(sourcesAndUses.equityAmount * (otherSharePct / 100)).toFixed(2)})
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-slate-600">
                    {(r.fcfeIdrBillion * (otherSharePct / 100)).toFixed(2)}
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
