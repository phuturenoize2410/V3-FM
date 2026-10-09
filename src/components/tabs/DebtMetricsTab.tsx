import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  ModelMetrics,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatMultiple,
  formatNumber,
} from '../../utils/formatters';
import { ShieldCheck, AlertTriangle, ArrowUpRight, Award } from 'lucide-react';

interface DebtMetricsTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const DebtMetricsTab: React.FC<DebtMetricsTabProps> = ({
  assumptions,
  annualRows,
  metrics,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const { funding } = assumptions;
  const fx = assumptions.revenue.fxIdrPerUsd;
  const covenantLimit = 1.2;
  const isCovenantBreached = metrics.minDscr < covenantLimit;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with Banking Covenant Scorecard */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Lender Credit Metrics & DSCR Covenant Testing
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict project finance covenant validation. Minimum DSCR threshold: <strong>1.20x</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div
            className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              !isCovenantBreached
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {!isCovenantBreached ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <div>
              <span className="block text-[10px] uppercase">Minimum DSCR</span>
              <span className="text-sm font-bold font-mono">
                {formatMultiple(metrics.minDscr, 2)}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Average DSCR</span>
            <span className="text-slate-800 text-sm font-bold font-mono">
              {formatMultiple(metrics.avgDscr, 2)}
            </span>
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Minimum LLCR</span>
            <span className="text-blue-800 text-sm font-bold font-mono">
              {formatMultiple(metrics.minLlcr, 2)}
            </span>
          </div>

          <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Project Life PLCR</span>
            <span className="text-purple-800 text-sm font-bold font-mono">
              {formatMultiple(metrics.minPlcr, 2)}
            </span>
          </div>

          <button
            onClick={() => onOpenAuditTrace('min_dscr')}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Audit DSCR Trace</span>
          </button>
        </div>
      </div>

      {/* CFADS Formula Box */}
      <div className="bg-slate-900 text-white rounded-lg p-4 border border-slate-800 text-xs font-mono">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
          Strict Banking Standard: Cash Flow Available for Debt Service (CFADS)
        </div>
        <div className="text-emerald-400 font-semibold mb-1">
          CFADS = Operating EBITDA - Corporate Income Tax Paid - (DSRA Required Transfer)
        </div>
        <div className="text-sky-300">
          DSCR = CFADS / (Senior Principal Repayment + External Loan Interest) • LLCR = NPV(CFADS over Debt Tenor) / Opening Debt
        </div>
      </div>

      {/* Annual Debt Service Coverage & DSRA Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Annual Banking Coverage Ratios & DSRA Roll-Forward (IDR Billion)</span>
          <span>Debt Repayment Tenor: {funding.repaymentPeriodYears} Years</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-center py-2.5 px-2">Year</th>
                <th className="text-right py-2.5 px-3">EBITDA</th>
                <th className="text-right py-2.5 px-3">Tax Paid</th>
                <th className="text-right py-2.5 px-3">DSRA Movement</th>
                <th className="text-right py-2.5 px-3">CFADS</th>
                <th className="text-right py-2.5 px-3">Principal</th>
                <th className="text-right py-2.5 px-3">Interest</th>
                <th className="text-right py-2.5 px-3">Debt Service</th>
                <th className="text-center py-2.5 px-3">DSCR</th>
                <th className="text-center py-2.5 px-3">LLCR</th>
                <th className="text-center py-2.5 px-3">Covenant Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {annualRows.map((row) => {
                const isActive = row.year <= funding.repaymentPeriodYears;
                const dscrPass = row.dscr >= covenantLimit;

                return (
                  <tr
                    key={row.year}
                    className={`hover:bg-slate-50 ${
                      !isActive ? 'bg-slate-50/50 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-2 px-2 text-center font-bold text-slate-800">
                      Yr {row.year}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      {row.ebitdaIdrBillion.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-700">
                      ({row.incomeTaxIdrBillion.toFixed(2)})
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      ({row.dsraMovement.toFixed(2)})
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-blue-700">
                      {row.cfadsIdrBillion.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {row.principalRepayment.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-700">
                      {row.interestExpense.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {row.totalDebtService.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {isActive ? (
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            dscrPass
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {formatMultiple(row.dscr, 2)}
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-800">
                      {isActive ? formatMultiple(row.llcr, 2) : <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      {isActive ? (
                        dscrPass ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            COMPLIANT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            BREACH
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400">Debt Free</span>
                      )}
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
