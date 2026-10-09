import React, { useState } from 'react';
import {
  FullModelAssumptions,
  SourcesAndUses,
  DebtScheduleRow,
  AnnualOperatingRow,
  ModelMetrics,
  ReconciliationItem,
  CurrencyDisplay,
} from '../../types';
import { calculateReconciliation } from '../../calculations/financialEngine';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Filter,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ReconciliationTabProps {
  assumptions: FullModelAssumptions;
  sourcesAndUses: SourcesAndUses;
  debtSchedule: DebtScheduleRow[];
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const ReconciliationTab: React.FC<ReconciliationTabProps> = ({
  assumptions,
  sourcesAndUses,
  debtSchedule,
  annualRows,
  metrics,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCH' | 'EXPECTED_DIFFERENCE' | 'ERROR'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const reconciliationItems: ReconciliationItem[] = calculateReconciliation(
    assumptions,
    sourcesAndUses,
    debtSchedule,
    annualRows,
    metrics
  );

  const categories = Array.from(new Set(reconciliationItems.map((item) => item.category)));

  const filteredItems = reconciliationItems.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
    return true;
  });

  const countMatch = reconciliationItems.filter((i) => i.status === 'MATCH').length;
  const countExpected = reconciliationItems.filter((i) => i.status === 'EXPECTED_DIFFERENCE').length;
  const countError = reconciliationItems.filter((i) => i.status === 'ERROR').length;

  return (
    <div className="space-y-4 text-xs">
      {/* Title Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            29
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Original Model vs Rebuilt Model Reconciliation Module
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Audit Comparison Matrix, Variance Decomposition & Structural Resolution Log
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-1 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {countMatch} Matches | {countExpected} Expected Variances | {countError} Errors
          </span>
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-blue-50/70 border border-blue-200 rounded p-3 text-blue-950 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed text-[11px]">
          <span className="font-bold">Project Finance Audit Notice: </span>
          The original model contained several fatal structural weaknesses, including a 10-year equal-principal amortization schedule that breached lender covenants (Min DSCR 0.77x &lt; 1.20x), double-counted capitalized IDC, and an imbalanced Balance Sheet. The Rebuilt Model resolves these flaws by implementing a 15-year mortgage annuity profile, fully reconciled 3-way financial statements, and an integrated DSRA waterfall. Every variance below is documented with an explicit project finance audit explanation.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-300 rounded p-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Filter Status:</span>
          {(['ALL', 'MATCH', 'EXPECTED_DIFFERENCE', 'ERROR'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="p-1 px-2 border border-slate-300 rounded bg-white text-[11px] font-medium text-slate-800 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px] font-mono">
              <tr>
                <th className="p-2.5 w-60">Metric</th>
                <th className="p-2.5 w-24">Category</th>
                <th className="p-2.5 w-24">Unit</th>
                <th className="p-2.5 text-right w-28">Original Model</th>
                <th className="p-2.5 text-right w-28 text-blue-700 font-bold">Rebuilt Model</th>
                <th className="p-2.5 text-right w-24">Variance</th>
                <th className="p-2.5 text-right w-20">Var %</th>
                <th className="p-2.5 text-center w-36">Status</th>
                <th className="p-2.5">Audit Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((item) => {
                const isMatch = item.status === 'MATCH';
                const isExpected = item.status === 'EXPECTED_DIFFERENCE';
                const isError = item.status === 'ERROR';

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-bold text-slate-900 font-sans">{item.metric}</td>
                    <td className="p-2.5 text-slate-500 font-sans text-[10px] uppercase font-medium">
                      {item.category}
                    </td>
                    <td className="p-2.5 font-mono text-slate-500 text-[10px]">{item.unit}</td>
                    <td className="p-2.5 text-right font-mono text-slate-600">
                      {typeof item.originalValue === 'number'
                        ? item.originalValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : item.originalValue}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-900 bg-blue-50/30">
                      {typeof item.rebuiltValue === 'number'
                        ? item.rebuiltValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : item.rebuiltValue}
                    </td>
                    <td
                      className={`p-2.5 text-right font-mono font-semibold ${
                        typeof item.variance === 'number' && Math.abs(item.variance) < 0.001
                          ? 'text-slate-400'
                          : typeof item.variance === 'number' && item.variance > 0
                          ? 'text-emerald-700'
                          : 'text-slate-800'
                      }`}
                    >
                      {typeof item.variance === 'number'
                        ? (item.variance > 0 ? '+' : '') +
                          item.variance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : item.variance}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[10px] text-slate-500">
                      {item.variancePct !== null
                        ? `${item.variancePct > 0 ? '+' : ''}${item.variancePct.toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider uppercase ${
                          isMatch
                            ? 'bg-emerald-100 text-emerald-800'
                            : isExpected
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600 leading-relaxed font-sans text-[11px]">
                      {item.explanation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
