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
import { TrendingUp, ArrowUpRight, CheckCircle2, Shield } from 'lucide-react';

interface ProjectCashFlowTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const ProjectCashFlowTab: React.FC<ProjectCashFlowTabProps> = ({
  assumptions,
  annualRows,
  metrics,
  sourcesAndUses,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Valuation Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Unlevered Project Cash Flow (FCFF) & Valuation
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Free Cash Flow to Firm (FCFF) before financing structure. Evaluates asset quality independent of gearing.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Project IRR (XIRR)</span>
            <span className="text-blue-800 text-sm font-bold font-mono">
              {formatPercent(metrics.projectIrrPct, 2)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Discount Rate (WACC)</span>
            <span className="text-slate-800 text-sm font-bold font-mono">
              {formatPercent(metrics.waccPct, 2)}
            </span>
          </div>

          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Project NPV (XNPV)</span>
            <span className="text-emerald-800 text-sm font-bold font-mono">
              {formatCurrencyValue(metrics.projectNpvIdrBillion, currencyDisplay, fx, 1)}
            </span>
          </div>

          <button
            data-audit-key="project_irr"
            onClick={() => onOpenAuditTrace('project_irr')}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Audit XIRR Trace</span>
          </button>
        </div>
      </div>

      {/* FCFF Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Unlevered Free Cash Flow Schedule (IDR Billion)</span>
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
                <td className="py-2 px-3 font-sans text-slate-900 font-semibold">Total Capital Expenditure</td>
                <td className="py-2 px-3 text-right text-rose-700 font-bold">
                  ({sourcesAndUses.totalUses.toFixed(2)})
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-slate-400">
                    -
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">Operating EBITDA</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2 px-3 text-right text-slate-800 font-medium">
                    {r.ebitdaIdrBillion.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">Unlevered Operating Taxes</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => {
                  const tax = r.corporateTax ?? r.incomeTaxIdrBillion ?? 0;
                  return (
                    <td key={r.year} className="py-2 px-3 text-right text-rose-700">
                      {tax > 0.001 ? `(${tax.toFixed(2)})` : '-'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-700">Change in Working Capital</td>
                <td className="py-2 px-3 text-right text-slate-400">-</td>
                {annualRows.map((r) => {
                  const wc = r.workingCapitalChange ?? 0;
                  return (
                    <td key={r.year} className="py-2 px-3 text-right text-slate-600">
                      {wc > 0.001
                        ? `(${wc.toFixed(2)})`
                        : wc < -0.001
                        ? `+${Math.abs(wc).toFixed(2)}`
                        : '-'}
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-blue-50 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="py-2.5 px-3 font-sans text-sm">FREE CASH FLOW TO FIRM (FCFF)</td>
                <td className="py-2.5 px-3 text-right text-rose-700 text-sm font-bold">
                  ({sourcesAndUses.totalUses.toFixed(2)})
                </td>
                {annualRows.map((r) => (
                  <td key={r.year} className="py-2.5 px-3 text-right text-blue-900 text-sm">
                    {r.fcffIdrBillion.toFixed(2)}
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
