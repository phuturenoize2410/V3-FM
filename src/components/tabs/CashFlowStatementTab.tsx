import React from 'react';
import type { FullModelAssumptions, AnnualOperatingRow, CurrencyDisplay } from '../../types';
import { financialValue, displayFinancialValue, dependentValue } from '../../calculations/financialValueState';
import { ArrowDownUp, Activity, Info } from 'lucide-react';

interface CashFlowStatementTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const CashFlowStatementTab: React.FC<CashFlowStatementTabProps> = ({
  annualRows,
  onOpenAuditTrace,
}) => {
  const fields: Array<[keyof AnnualOperatingRow, string, number]> = [
    ['netIncomeIdrBillion', 'Net income after tax', 1],
    ['accountingDepreciation', '(+) Accounting depreciation', 1],
    ['interestPayment', '(+) Interest reclassification to financing', 1],
    ['workingCapitalChange', '(−/+) Working Capital Delta', -1],
    ['operatingCashFlow', '(=) Operating cash flow / CFADS (model convention)', 1],
    ['principalRepayment', '(−) Senior principal', -1],
    ['interestPayment', '(−) Senior interest', -1],
    ['dividendsPaid', '(−) Dividends', -1],
    ['financingCashFlow', '(=) Financing cash flow (before reserve transfers)', 1],
    ['dsraFunding', '(−) Transfer to restricted reserve', -1],
    ['dsraRelease', '(+) Release from restricted reserve', 1],
    ['netChangeInCash', '(=) Change in unrestricted cash', 1],
    ['cashBeginningBalance', '(+) Opening unrestricted cash', 1],
    ['cashEndingBalance', '(=) Closing unrestricted cash', 1],
  ];

  return (
    <section className="space-y-4 text-xs">
      {/* Executive Header Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            16
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Cash Flow Statement · Audited Waterfall
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              30-Year Operating, Financing & Reserve Waterfall · Direct CFADS, Debt Service & Closing Liquidity
            </p>
          </div>
        </div>

        <button
          data-audit-key="cfads"
          onClick={() => onOpenAuditTrace('cfads')}
          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
          title="Inspect audited CFADS calculation formulas & dependencies"
        >
          <Activity className="w-3.5 h-3.5 text-sky-600" />
          <span>Audit CFADS Calculation</span>
        </button>
      </div>

      {/* Model Governance Context Notice */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3.5 text-slate-600 space-y-1.5 shadow-2xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px]">
          <Info className="w-3.5 h-3.5 text-sky-600" />
          <span>Audited Model Convention & Classification Notes</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Current operating run · Values presented in <span className="font-semibold text-slate-800">IDR Billion</span>. Interest is classified in financing; reserve transfers are shown separately. Model operating cash flow represents project CFADS available for debt service.
        </p>
        <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
          Sustaining CAPEX / investing source: Compatibility engine excludes operating-period investing movements; it does not evidence zero investment. Governed total cash flow and closing cash remain reconciled with operating debt terms.
        </p>
      </div>

      {/* 30-Year Cash Flow Statement Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <ArrowDownUp className="w-3.5 h-3.5 text-slate-600" />
            30-Year Cash Flow Waterfall (Operating Years 1 - 30)
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: IDR Billion</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2.5 text-left sticky left-0 bg-slate-100 z-10 w-72 finmod-sticky-col">
                  Compatibility schedule field · IDR billion
                </th>
                {annualRows.map((r) => (
                  <th key={r.year} className="p-2.5 min-w-[70px]">
                    Y{r.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {fields.map(([key, label, sign], i) => {
                const isOperatingTotal = key === 'operatingCashFlow';
                const isFinancingTotal = key === 'financingCashFlow';
                const isNetChange = key === 'netChangeInCash';
                const isEndingCash = key === 'cashEndingBalance';
                const isSubtotal = isOperatingTotal || isFinancingTotal || isNetChange;
                const isFinalBalance = isEndingCash;

                let rowBg = 'hover:bg-slate-50/70 transition-colors';
                let thBg = 'bg-white';
                let textStyle = 'text-slate-700';

                if (isFinalBalance) {
                  rowBg = 'bg-blue-50/80 font-black border-t-2 border-slate-400 text-blue-950';
                  thBg = 'bg-blue-50/90 font-black text-blue-950';
                  textStyle = 'text-blue-950 font-black';
                } else if (isOperatingTotal || isFinancingTotal) {
                  rowBg = 'bg-slate-100/90 font-bold border-t border-slate-300 text-slate-900';
                  thBg = 'bg-slate-100/95 font-bold text-slate-900';
                  textStyle = 'text-slate-900 font-bold';
                } else if (isNetChange) {
                  rowBg = 'bg-slate-50 font-semibold border-t border-slate-200 text-slate-800';
                  thBg = 'bg-slate-50 font-semibold text-slate-800';
                  textStyle = 'text-slate-800 font-semibold';
                }

                return (
                  <tr key={`${key}-${i}`} className={rowBg}>
                    <th
                      className={`p-2.5 text-left whitespace-nowrap sticky left-0 z-10 finmod-sticky-col font-sans ${thBg} ${
                        !isSubtotal && !isFinalBalance ? 'pl-4 font-normal text-slate-700' : ''
                      }`}
                    >
                      {label}
                    </th>
                    {annualRows.map((r) => {
                      const deps =
                        key === 'cashEndingBalance' || key === 'netChangeInCash'
                          ? ([
                              'operatingCashFlow',
                              'financingCashFlow',
                              'dsraFunding',
                              'dsraRelease',
                              'cashBeginningBalance',
                            ] as const)
                          : [];
                      const v = dependentValue(
                        r[key],
                        `annualRows[${r.year}].${key}`,
                        deps.map((k) => financialValue(r[k], k))
                      );
                      return (
                        <td
                          key={r.year}
                          data-source-field={key}
                          title={v.source}
                          className={`p-2.5 font-mono tabular-nums ${textStyle}`}
                        >
                          {displayFinancialValue(v, sign)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
