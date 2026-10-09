import React from 'react';
import {
  FullModelAssumptions,
  DebtScheduleRow,
  SourcesAndUses,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatPercent,
  formatMultiple,
  formatNumber,
} from '../../utils/formatters';
import { Shield, CheckCircle2, Sliders, DollarSign, Layers } from 'lucide-react';

interface DebtFinancingTabProps {
  assumptions: FullModelAssumptions;
  debtSchedule: DebtScheduleRow[];
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  metrics?: any;
  onUpdateAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onChangeAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onOpenAuditTrace: (key: string) => void;
}

export const DebtFinancingTab: React.FC<DebtFinancingTabProps> = ({
  assumptions,
  debtSchedule,
  sourcesAndUses,
  currencyDisplay,
  metrics,
  onUpdateAssumptions,
  onChangeAssumptions,
  onOpenAuditTrace,
}) => {
  const { funding } = assumptions;
  const fx = assumptions.revenue.fxIdrPerUsd;

  const totalPrincipalRepaid = debtSchedule.reduce((s, r) => s + r.principalRepayment, 0);
  const totalInterestPaid = debtSchedule.reduce((s, r) => s + r.interestExpense, 0);
  const closingAtMaturity = debtSchedule[funding.repaymentPeriodYears - 1]?.closingBalance || 0;
  const isFullyRepaid = Math.abs(closingAtMaturity) < 0.001;

  const safeUpdate = (newAssumptions: FullModelAssumptions) => {
    if (typeof onUpdateAssumptions === 'function') {
      onUpdateAssumptions(newAssumptions);
    } else if (typeof onChangeAssumptions === 'function') {
      onChangeAssumptions(newAssumptions);
    }
  };

  const updateFunding = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      funding: { ...assumptions.funding, [field]: val },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with Key Debt Terms */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Senior Bank Loan Facility & Debt Term Sheet
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial project finance debt facility structure, interest compounding, and IDC treatment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
              isFullyRepaid
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {isFullyRepaid ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Debt Balance at Maturity (Yr {funding.repaymentPeriodYears}): 0.00 IDR B</span>
              </>
            ) : (
              <span>Remaining Balance: {closingAtMaturity.toFixed(4)} IDR B</span>
            )}
          </div>
        </div>
      </div>

      {/* Debt Facility Settings & Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Facility Structure */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Facility Structure
            </h3>
            <Sliders className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Principal at COD:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrencyValue(sourcesAndUses.bankLoanAmount, currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Debt Gearing:</span>
              <span className="font-mono font-bold text-blue-600">{funding.bankDebtPct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Bank Interest Rate:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={funding.bankInterestRatePct}
                  onChange={(e) => updateFunding('bankInterestRatePct', parseFloat(e.target.value) || 0)}
                  className="w-16 text-right px-1.5 py-0.5 rounded bg-amber-50/70 border border-amber-300 font-mono font-bold text-xs"
                />
                <span>%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Repayment Tenor:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="30"
                  value={funding.repaymentPeriodYears}
                  onChange={(e) => updateFunding('repaymentPeriodYears', parseInt(e.target.value) || 1)}
                  className="w-14 text-right px-1.5 py-0.5 rounded bg-amber-50/70 border border-amber-300 font-mono font-bold text-xs"
                />
                <span>Yrs</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Min DSCR Covenant:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  value={funding.covenantDscrBenchmark ?? 1.20}
                  onChange={(e) => updateFunding('covenantDscrBenchmark', parseFloat(e.target.value) || 1.20)}
                  className="w-14 text-right px-1.5 py-0.5 rounded bg-amber-50/70 border border-amber-300 font-mono font-bold text-xs"
                />
                <span>x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: IDC Selector */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Interest During Const (IDC)
            </h3>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
              {funding.idcMode}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                IDC Accounting Treatment:
              </label>
              <select
                value={funding.idcMode}
                onChange={(e) => updateFunding('idcMode', e.target.value)}
                className="w-full px-2.5 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-bold text-xs focus:outline-blue-500"
              >
                <option value="capitalized">Capitalized (Added to Debt Principal)</option>
                <option value="paid">Paid Currently (Funded by Sources)</option>
              </select>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
              <span className="text-slate-500 text-[11px]">Cumulative IDC Amount:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {sourcesAndUses.idcTotal.toFixed(3)} IDR B
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {funding.idcMode === 'capitalized'
                ? 'IDC rolls into senior debt closing balance at COD and is amortized.'
                : 'IDC is settled by sponsors currently during construction.'}
            </p>
          </div>
        </div>

        {/* Card 3: Amortization Methodology */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Amortization Profile
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase">{funding.amortizationType}</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Repayment Profile Type:
              </label>
              <select
                value={funding.amortizationType}
                onChange={(e) => updateFunding('amortizationType', e.target.value)}
                className="w-full px-2.5 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-bold text-xs focus:outline-blue-500"
              >
                <option value="annuity">Equal Annuity (PMT Monthly Compounding)</option>
                <option value="equal_principal">Equal Principal (Linear Straight-line)</option>
                <option value="sculpted">Sculpted Amortization (Target DSCR)</option>
              </select>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500">Total Principal Repaid:</span>
              <span className="font-mono font-bold text-slate-900">{totalPrincipalRepaid.toFixed(2)} IDR B</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500">Total Interest Paid:</span>
              <span className="font-mono font-bold text-amber-700">{totalInterestPaid.toFixed(2)} IDR B</span>
            </div>
          </div>
        </div>

        {/* Card 4: DSRA Sizing Engine */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              DSRA Reserve Sizing
            </h3>
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
              {funding.dsraMode ?? 'months'}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Reserve Sizing Mode:
              </label>
              <select
                value={funding.dsraMode ?? 'months'}
                onChange={(e) => updateFunding('dsraMode', e.target.value)}
                className="w-full px-2.5 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-bold text-xs focus:outline-blue-500"
              >
                <option value="months">Forward Debt Service Months</option>
                <option value="fixed">Fixed Reserve Amount (IDR B)</option>
              </select>
            </div>
            {funding.dsraMode === 'fixed' ? (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Fixed Reserve:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={funding.dsraFixedAmountIdrBillion ?? 2.756}
                    onChange={(e) => updateFunding('dsraFixedAmountIdrBillion', parseFloat(e.target.value) || 0)}
                    className="w-18 text-right px-1.5 py-0.5 rounded bg-amber-50/70 border border-amber-300 font-mono font-bold text-xs"
                  />
                  <span>IDR B</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Requirement:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="24"
                    value={funding.dsraRequirementMonths}
                    onChange={(e) => updateFunding('dsraRequirementMonths', parseInt(e.target.value) || 6)}
                    className="w-14 text-right px-1.5 py-0.5 rounded bg-amber-50/70 border border-amber-300 font-mono font-bold text-xs"
                  />
                  <span>Months</span>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500">Pre-Funded at COD:</span>
              <span className="font-mono font-bold text-emerald-700">{sourcesAndUses.dsraPreFunding.toFixed(3)} IDR B</span>
            </div>
          </div>
        </div>
      </div>

      {/* Senior Debt Amortization Schedule Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap justify-between items-center gap-3 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Senior Debt Facility Annual Amortization & Debt Service Schedule</span>
            <span className="text-[10px] text-slate-400 font-mono normal-case">
              (Tenor: {funding.repaymentPeriodYears} Years)
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            Total Facility: {sourcesAndUses.bankLoanAmount.toFixed(2)} IDR B
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-20 text-[11px]">
              <tr>
                <th className="text-center py-2.5 px-3 sticky left-0 bg-slate-100 z-30 finmod-sticky-col">Year</th>
                <th className="text-right py-2.5 px-3">Opening Debt (IDR B)</th>
                <th className="text-right py-2.5 px-3 text-blue-700">Principal Repayment (IDR B)</th>
                <th className="text-right py-2.5 px-3 text-amber-700">Interest Expense (IDR B)</th>
                <th className="text-right py-2.5 px-3 text-purple-700">Total Debt Service (IDR B)</th>
                <th className="text-right py-2.5 px-3">Closing Debt (IDR B)</th>
                <th className="text-right py-2.5 px-3">Repaid %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {debtSchedule.map((row, idx) => {
                const cumRepaid = debtSchedule.slice(0, idx + 1).reduce((s, r) => s + r.principalRepayment, 0);
                const repaidPct = sourcesAndUses.bankLoanAmount > 0 ? (cumRepaid / sourcesAndUses.bankLoanAmount) * 100 : 0;
                const isTenorYear = row.year <= funding.repaymentPeriodYears;

                return (
                  <tr key={row.year} className={`hover:bg-slate-50 transition-colors ${!isTenorYear ? 'opacity-40 bg-slate-50/50' : ''}`}>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 sticky left-0 bg-white z-10 finmod-sticky-col">
                      Yr {row.year}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">
                      {row.openingBalance.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                      {row.principalRepayment.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-700 font-semibold">
                      {row.interestExpense.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-purple-800">
                      {row.totalDebtService.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {row.closingBalance.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 font-semibold">
                      {repaidPct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 font-mono text-xs">
              <tr>
                <td className="py-2.5 px-3 text-center sticky left-0 bg-slate-100 z-10 finmod-sticky-col">Total</td>
                <td className="py-2.5 px-3 text-right text-slate-500">-</td>
                <td className="py-2.5 px-3 text-right text-blue-700">{totalPrincipalRepaid.toFixed(3)}</td>
                <td className="py-2.5 px-3 text-right text-amber-700">{totalInterestPaid.toFixed(3)}</td>
                <td className="py-2.5 px-3 text-right text-purple-800">{(totalPrincipalRepaid + totalInterestPaid).toFixed(3)}</td>
                <td className="py-2.5 px-3 text-right text-slate-500">0.000</td>
                <td className="py-2.5 px-3 text-right text-emerald-700">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
