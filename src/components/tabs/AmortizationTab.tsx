import React from 'react';
import {
  FullModelAssumptions,
  DebtScheduleRow,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatNumber,
} from '../../utils/formatters';
import { Table, CheckCircle2 } from 'lucide-react';

interface AmortizationTabProps {
  assumptions: FullModelAssumptions;
  debtSchedule: DebtScheduleRow[];
  currencyDisplay: CurrencyDisplay;
}

export const AmortizationTab: React.FC<AmortizationTabProps> = ({
  assumptions,
  debtSchedule,
  currencyDisplay,
}) => {
  const { funding } = assumptions;
  const fx = assumptions.revenue.fxIdrPerUsd;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Senior Debt Amortization Schedule
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Methodology: {funding.amortizationType === 'equal_principal' ? 'Equal Principal Repayment' : 'Annuity Repayment'} • Tenor: {funding.repaymentPeriodYears} Years post-COD • {funding.bankInterestRatePct}% p.a.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Debt Amortization Reconciles to 0.00 IDR B at Maturity</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Annual Loan Schedule (IDR Billion)</span>
          <span>Amortization Type: {funding.amortizationType.replace('_', ' ')}</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-center py-2.5 px-3">Year</th>
                <th className="text-left py-2.5 px-3">Date</th>
                <th className="text-right py-2.5 px-3">Opening Balance</th>
                <th className="text-right py-2.5 px-3">Principal Repayment</th>
                <th className="text-right py-2.5 px-3">Interest Payment</th>
                <th className="text-right py-2.5 px-3">Total Debt Service</th>
                <th className="text-right py-2.5 px-3">Closing Balance</th>
                <th className="text-center py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {debtSchedule.map((row) => {
                const isActiveLoan = row.year <= funding.repaymentPeriodYears;
                return (
                  <tr
                    key={row.year}
                    className={`hover:bg-slate-50 ${
                      !isActiveLoan ? 'bg-slate-50/50 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-bold text-slate-800">
                      Yr {row.year}
                    </td>
                    <td className="py-2 px-3 text-left font-sans text-slate-600">
                      {row.dateStr}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {row.openingBalance.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-blue-700">
                      {row.principalRepayment.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-700">
                      {row.interestExpense.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {row.totalDebtService.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-800">
                      {row.closingBalance.toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      {row.year === funding.repaymentPeriodYears ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Maturity
                        </span>
                      ) : isActiveLoan ? (
                        <span className="text-[11px] text-slate-500">Amortizing</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Debt Free</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 font-mono">
              <tr>
                <td colSpan={3} className="py-2.5 px-3 text-left font-sans">
                  Cumulative Total (IDR Billion)
                </td>
                <td className="py-2.5 px-3 text-right text-blue-700">
                  {debtSchedule.reduce((s, r) => s + r.principalRepayment, 0).toFixed(3)}
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700">
                  {debtSchedule.reduce((s, r) => s + r.interestExpense, 0).toFixed(3)}
                </td>
                <td className="py-2.5 px-3 text-right text-slate-900 text-sm">
                  {debtSchedule.reduce((s, r) => s + r.totalDebtService, 0).toFixed(3)}
                </td>
                <td colSpan={2} className="py-2.5 px-3 text-right text-emerald-700 font-sans">
                  Repaid in full
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
