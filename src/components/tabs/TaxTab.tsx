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
import {
  Receipt,
  ArrowUpRight,
  ShieldCheck,
  TrendingDown,
  Info,
  DollarSign,
  HelpCircle,
  FileCheck,
} from 'lucide-react';

interface TaxTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const TaxTab: React.FC<TaxTabProps> = ({
  assumptions,
  annualRows,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const taxRate = assumptions.tax.corporateIncomeTaxRatePct;

  const mult =
    currencyDisplay === 'IDR_B'
      ? 1
      : currencyDisplay === 'IDR_M'
      ? 1000
      : currencyDisplay === 'USD_M'
      ? 1 / (fx / 1000)
      : (1000 / fx) * 1000;

  const unitLabel =
    currencyDisplay === 'IDR_B'
      ? 'IDR Billion'
      : currencyDisplay === 'IDR_M'
      ? 'IDR Million'
      : currencyDisplay === 'USD_M'
      ? 'USD Million'
      : 'USD Thousand';

  // Aggregate Metrics
  const totalEbitda = annualRows.reduce((s, r) => s + (r.ebitdaIdrBillion || 0), 0);
  const totalDepr = annualRows.reduce((s, r) => s + (r.depreciationExpense || r.accountingDepreciation || 0), 0);
  const totalInterest = annualRows.reduce((s, r) => s + (r.interestExpense || 0), 0);
  const totalEbt = annualRows.reduce((s, r) => s + (r.ebtIdrBillion || 0), 0);
  const totalTaxLossUtilized = annualRows.reduce((s, r) => s + (r.taxLossUtilized || 0), 0);
  const totalTaxableIncome = annualRows.reduce((s, r) => s + (r.taxableIncome || 0), 0);
  const totalCorporateTax = annualRows.reduce((s, r) => s + (r.corporateTax ?? r.incomeTaxIdrBillion ?? 0), 0);
  const totalNetIncome = annualRows.reduce((s, r) => s + (r.netIncomeIdrBillion || 0), 0);

  const avgAnnualTax = annualRows.length > 0 ? totalCorporateTax / annualRows.length : 0;
  const interestTaxShield = totalInterest * (taxRate / 100);
  const weightedEffTaxRate = totalEbt > 0 ? (totalCorporateTax / totalEbt) * 100 : 0;

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-200 text-xs">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
            13
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">
                Corporate Income Tax (PPh Badan) & Tax Loss Carry Forward (TLCF)
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold">
                UU HPP PPh 22%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Corporate Income Tax Rate {taxRate}% • 5-Year Tax Loss Carryforward (Income Tax Law, Article 6(2)) • Bank Interest Tax Shield
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled
            title="Formula trace unavailable for corporate_tax: no live trace node is supplied."
            className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-default"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Audit Tax Formula Trace</span>
          </button>
        </div>
      </div>

      {/* 2. Key Tax KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono">
        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">30-Yr Total PPh Badan</div>
          <div className="text-base font-black text-rose-700 mt-1">
            {formatCurrencyValue(totalCorporateTax, currencyDisplay, fx, 2)}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            Avg {formatCurrencyValue(avgAnnualTax, currencyDisplay, fx, 2)} / yr
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Tax Loss Carry Utilized</div>
          <div className="text-base font-black text-amber-700 mt-1">
            {formatCurrencyValue(totalTaxLossUtilized, currencyDisplay, fx, 2)}
          </div>
          <div className="text-[10px] text-emerald-700 font-sans mt-0.5">
            Saved {formatCurrencyValue(totalTaxLossUtilized * (taxRate / 100), currencyDisplay, fx, 2)} tax
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Interest Tax Shield</div>
          <div className="text-base font-black text-blue-700 mt-1">
            {formatCurrencyValue(interestTaxShield, currencyDisplay, fx, 2)}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            From {formatCurrencyValue(totalInterest, currencyDisplay, fx, 1)} debt interest
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Total Taxable Income (PKP)</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {formatCurrencyValue(totalTaxableIncome, currencyDisplay, fx, 2)}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            Post-depreciation & interest
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Effective Tax Rate</div>
          <div className="text-base font-black text-emerald-700 mt-1">
            {weightedEffTaxRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            Statutory CIT: {taxRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 3. Indonesian Fiscal Tax Logic Explainer */}
      <div className="bg-slate-900 text-white rounded-lg p-4 border border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2 uppercase tracking-wider text-[11px]">
          <Info className="w-4 h-4" />
          <span>Indonesian Corporate Income Tax Cascade:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
          <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700">
            <div className="text-slate-400 font-bold mb-1">1. Earnings Before Tax (EBT)</div>
            <div className="text-slate-200">
              <strong className="text-white">EBT = EBITDA - Depreciation - Bank Loan Interest Expense</strong>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Bank interest is tax deductible subject to the thin-capitalization regulation.
            </div>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700">
            <div className="text-slate-400 font-bold mb-1">2. Tax Loss Carryforward (TLCF)</div>
            <div className="text-slate-200">
              <strong className="text-amber-300">PKP = Max(0, EBT - Opening Tax Loss Balance)</strong>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Early-year tax losses are carried forward for up to five consecutive years to reduce tax expense.
            </div>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700">
            <div className="text-slate-400 font-bold mb-1">3. Corporate Income Tax Payable</div>
            <div className="text-slate-200">
              <strong className="text-emerald-300">Corporate Income Tax = Taxable Income × Corporate Tax Rate ({taxRate}%)</strong>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              If taxable income is zero due to losses or loss utilization, corporate income tax for the period is zero.
            </div>
          </div>
        </div>
      </div>

      {/* 4. 30-Year Comprehensive Tax Schedule Table */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap justify-between items-center text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>30-Year Corporate Income Tax & Loss Carryforward Schedule</span>
          </div>
          <span className="text-[11px] font-mono text-slate-300">
            Unit: {unitLabel} • Tariff: {taxRate}%
          </span>
        </div>

        <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 z-10 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="text-center py-2.5 px-2">Year</th>
                <th className="py-2.5 px-3">EBITDA</th>
                <th className="py-2.5 px-3">Depreciation</th>
                <th className="py-2.5 px-3">EBIT</th>
                <th className="py-2.5 px-3">Bank Interest</th>
                <th className="py-2.5 px-3 font-bold text-slate-900">EBT</th>
                <th className="py-2.5 px-3 text-amber-700">Opening Losses</th>
                <th className="py-2.5 px-3 text-blue-700">Losses Utilized</th>
                <th className="py-2.5 px-3 text-amber-800">Closing Losses</th>
                <th className="py-2.5 px-3 font-bold text-sky-800">PKP (Taxable)</th>
                <th className="py-2.5 px-3 font-bold text-rose-700">PPh Badan ({taxRate}%)</th>
                <th className="py-2.5 px-3 font-bold text-emerald-800">Profit After Tax (PAT)</th>
                <th className="text-center py-2.5 px-2">Effective Tax Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {annualRows.map((row) => {
                const depr = row.depreciationExpense ?? row.accountingDepreciation ?? 0;
                const interest = row.interestExpense ?? 0;
                const ebt = row.ebtIdrBillion ?? 0;
                const lossOpening = row.taxLossOpening ?? 0;
                const lossUtilized = row.taxLossUtilized ?? 0;
                const lossClosing = row.taxLossClosing ?? row.taxLossCarriedForward ?? 0;
                const pkp = row.taxableIncome ?? 0;
                const cit = row.corporateTax ?? row.incomeTaxIdrBillion ?? 0;
                const pat = row.netIncomeIdrBillion ?? (ebt - cit);
                const effRate = ebt > 0 ? (cit / ebt) * 100 : 0;

                return (
                  <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2 text-center font-bold text-slate-800 bg-slate-50/50">
                      Y{row.year}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {(row.ebitdaIdrBillion * mult).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      ({(depr * mult).toFixed(2)})
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {(row.ebitIdrBillion * mult).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-rose-700">
                      {interest > 0 ? `(${(interest * mult).toFixed(2)})` : '-'}
                    </td>
                    <td className={`py-2 px-3 font-bold ${ebt < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {(ebt * mult).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-amber-700">
                      {lossOpening > 0 ? (lossOpening * mult).toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3 text-blue-700 font-medium">
                      {lossUtilized > 0 ? `(${(lossUtilized * mult).toFixed(2)})` : '-'}
                    </td>
                    <td className="py-2 px-3 text-amber-800">
                      {lossClosing > 0 ? (lossClosing * mult).toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3 font-bold text-sky-800">
                      {(pkp * mult).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 font-bold text-rose-700">
                      {(cit * mult).toFixed(2)}
                    </td>
                    <td className={`py-2 px-3 font-bold ${pat < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                      {(pat * mult).toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-600 font-sans font-medium">
                      {effRate > 0 ? `${effRate.toFixed(1)}%` : '0.0%'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="py-2.5 px-2 text-center">30-Yr Total</td>
                <td className="py-2.5 px-3">
                  {(totalEbitda * mult).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  ({(totalDepr * mult).toFixed(2)})
                </td>
                <td className="py-2.5 px-3">
                  {((totalEbitda - totalDepr) * mult).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-rose-700">
                  ({(totalInterest * mult).toFixed(2)})
                </td>
                <td className="py-2.5 px-3 font-black">
                  {(totalEbt * mult).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-slate-400">-</td>
                <td className="py-2.5 px-3 text-blue-700">
                  ({(totalTaxLossUtilized * mult).toFixed(2)})
                </td>
                <td className="py-2.5 px-3 text-slate-400">-</td>
                <td className="py-2.5 px-3 text-sky-900 font-black">
                  {(totalTaxableIncome * mult).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-rose-700 font-black">
                  {(totalCorporateTax * mult).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-emerald-800 font-black">
                  {(totalNetIncome * mult).toFixed(2)}
                </td>
                <td className="py-2.5 px-2 text-center font-sans font-bold text-emerald-700">
                  {weightedEffTaxRate.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
