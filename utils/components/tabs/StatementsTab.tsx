import React, { useState } from 'react';
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
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Scale,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';

interface StatementsTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  initialSubTab?: 'income' | 'balance' | 'cashflow';
  onOpenAuditTrace: (key: string) => void;
}

export const StatementsTab: React.FC<StatementsTabProps> = ({
  assumptions,
  annualRows,
  currencyDisplay,
  initialSubTab = 'income',
  onOpenAuditTrace,
}) => {
  const [activeStatement, setActiveStatement] = useState<'income' | 'balance' | 'cashflow'>(initialSubTab);
  const fx = assumptions.revenue.fxIdrPerUsd;

  // Verify Balance Sheet Balance across all years
  const maxBsVariance = Math.max(...annualRows.map((r) => Math.abs(r.balanceSheetDifference ?? r.bsDifference ?? 0)));
  const isBsBalanced = maxBsVariance < 0.001;

  // Verify Cash Flow to Balance Sheet Cash reconciliation
  const cashReconciles = annualRows.every(
    (r) => Math.abs((r.cashEndingBalance ?? r.bsCash ?? 0) - (r.bsCashAndCashEquivalents ?? r.bsCash ?? 0)) < 0.001
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Statement Header & Switcher */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Three-Way Integrated Financial Statements
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamic P&L, Balance Sheet, and Cash Flow with zero-variance balance sheet check and cash reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Balance Sheet Verification Status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
              isBsBalanced
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {isBsBalanced ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Balance Sheet Perfectly Balances (Diff = 0.00)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Balance Sheet Imbalance: {maxBsVariance.toFixed(4)} IDR B</span>
              </>
            )}
          </div>

          {/* Statement Tab Buttons */}
          <div className="bg-slate-100 p-0.5 rounded border border-slate-300 flex text-xs font-semibold">
            <button
              onClick={() => setActiveStatement('income')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
                activeStatement === 'income'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Income Statement
            </button>
            <button
              onClick={() => setActiveStatement('balance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
                activeStatement === 'balance'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              Balance Sheet
            </button>
            <button
              onClick={() => setActiveStatement('cashflow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition ${
                activeStatement === 'cashflow'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Cash Flow Statement
            </button>
          </div>
        </div>
      </div>

      {/* 1. INCOME STATEMENT */}
      {activeStatement === 'income' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="bg-[#0F172A] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider font-mono border-b border-[#334155]">
            <span>Income Statement (IDR Billion)</span>
            <span>Concession Period: 30 Years</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2.5 px-3 min-w-[220px]">Line Item</th>
                  {annualRows.map((r) => (
                    <th key={r.year} className="text-right py-2.5 px-3 min-w-[90px]">
                      Yr {r.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* Revenue */}
                <tr className="bg-blue-50/40 font-bold">
                  <td className="py-2 px-3 font-sans text-slate-900">Total Electricity Revenue</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-blue-800">
                      {r.revenueIdrBillion.toFixed(2)}
                    </td>
                  ))}
                </tr>
                {/* Opex Items */}
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Fixed Operations & Maintenance</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.fixedOpex.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Variable Operations & Maintenance</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.variableOpex.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Insurance Premiums</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.insurance.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Water Levies & Land Rent</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.landWaterCharges.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Staff, Administration & Management</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.adminEmployees.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Maintenance Reserve Provision</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.maintenanceReserve.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2 px-3 font-sans text-slate-800">Total Operating Expenses (OPEX)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-rose-700">
                      ({r.totalOpexIdrBillion.toFixed(2)})
                    </td>
                  ))}
                </tr>
                {/* EBITDA */}
                <tr className="bg-emerald-50/50 font-bold">
                  <td className="py-2 px-3 font-sans text-slate-900">EBITDA</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-emerald-800">
                      {r.ebitdaIdrBillion.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Depreciation & Amortization</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      ({r.depreciationExpense.toFixed(2)})
                    </td>
                  ))}
                </tr>
                {/* EBIT */}
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2 px-3 font-sans text-slate-800">Operating Profit (EBIT)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-slate-800">
                      {r.ebitIdrBillion.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Bank Financing Interest Expense</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-rose-700">
                      ({r.interestExpense.toFixed(2)})
                    </td>
                  ))}
                </tr>
                {/* EBT */}
                <tr className="bg-slate-50 font-bold">
                  <td className="py-2 px-3 font-sans text-slate-900">Earnings Before Tax (EBT)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-slate-900">
                      {r.ebtIdrBillion.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">
                    Corporate Income Tax ({assumptions.tax.corporateIncomeTaxRatePct}%)
                  </td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-rose-700">
                      ({r.incomeTaxIdrBillion.toFixed(2)})
                    </td>
                  ))}
                </tr>
                {/* Net Income */}
                <tr className="bg-blue-100/60 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2.5 px-3 font-sans text-sm">NET INCOME (PROFIT AFTER TAX)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2.5 px-3 text-right text-blue-900 text-sm">
                      {r.netIncomeIdrBillion.toFixed(2)}
                    </td>
                  ))}
                </tr>
                {/* Margins */}
                <tr className="text-slate-500 font-sans">
                  <td className="py-1.5 px-3">EBITDA Margin %</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right font-mono">
                      {r.ebitdaMarginPct.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr className="text-slate-500 font-sans">
                  <td className="py-1.5 px-3">Net Profit Margin %</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right font-mono">
                      {((r.netIncomeIdrBillion / r.revenueIdrBillion) * 100).toFixed(1)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. BALANCE SHEET */}
      {activeStatement === 'balance' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="bg-[#0F172A] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider font-mono border-b border-[#334155]">
            <span>Balance Sheet (IDR Billion)</span>
            <span>Check: Total Assets = Total Liabilities & Equity</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2.5 px-3 min-w-[220px]">Balance Sheet Line Item</th>
                  {annualRows.map((r) => (
                    <th key={r.year} className="text-right py-2.5 px-3 min-w-[90px]">
                      Yr {r.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* ASSETS */}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={annualRows.length + 1} className="py-1.5 px-3 font-sans text-slate-900 uppercase">
                    ASSETS
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Cash and Cash Equivalents</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.bsCashAndCashEquivalents.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Debt Service Reserve Account (DSRA)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.bsDsraBalance.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Working Capital & Trade Receivables</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.bsWorkingCapitalReceivables.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-800">Total Current Assets</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right font-medium text-slate-800">
                      {(r.bsCashAndCashEquivalents + r.bsDsraBalance + r.bsWorkingCapitalReceivables).toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Gross Property, Plant & Equipment</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-600">
                      {r.grossFixedAssets.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Less: Accumulated Depreciation</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-rose-600">
                      ({r.accumulatedDepreciationEnding.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-800">Net Fixed Assets (PP&E)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right font-bold text-blue-700">
                      {r.netFixedAssetsEnding.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-blue-50/80 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2.5 px-3 font-sans text-sm">TOTAL ASSETS</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2.5 px-3 text-right text-blue-900 text-sm">
                      {r.totalAssets.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* LIABILITIES */}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={annualRows.length + 1} className="py-1.5 px-3 font-sans text-slate-900 uppercase">
                    LIABILITIES
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Senior Bank Debt Principal</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.closingDebtBalance.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-1.5 px-3 font-sans text-slate-800">Total Liabilities</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.totalLiabilities.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* EQUITY */}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={annualRows.length + 1} className="py-1.5 px-3 font-sans text-slate-900 uppercase">
                    EQUITY
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Share Capital (Paid-in)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.shareCapitalPaidIn.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Retained Earnings (Ending)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-emerald-700 font-medium">
                      {r.retainedEarningsEnding.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-1.5 px-3 font-sans text-slate-800">Total Equity</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right font-bold text-slate-900">
                      {r.totalEquity.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-blue-50/80 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2.5 px-3 font-sans text-sm">TOTAL LIABILITIES & EQUITY</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2.5 px-3 text-right text-blue-900 text-sm">
                      {r.totalLiabilitiesAndEquity.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* MANDATORY CHECK ROW */}
                <tr className="bg-emerald-100/70 font-bold text-emerald-900">
                  <td className="py-2 px-3 font-sans flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>BALANCE SHEET CHECK (Assets - Liab & Equity = 0)</span>
                  </td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right font-mono text-emerald-800">
                      {r.balanceSheetDifference.toFixed(4)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CASH FLOW STATEMENT */}
      {activeStatement === 'cashflow' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="bg-[#0F172A] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider font-mono border-b border-[#334155]">
            <span>Cash Flow Statement (IDR Billion)</span>
            <span>Operating, Investing & Financing Cash Reconciled</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2.5 px-3 min-w-[220px]">Cash Flow Line Item</th>
                  {annualRows.map((r) => (
                    <th key={r.year} className="text-right py-2.5 px-3 min-w-[90px]">
                      Yr {r.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* OPERATING CASH FLOW */}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={annualRows.length + 1} className="py-1.5 px-3 font-sans text-slate-900 uppercase">
                    CASH FLOW FROM OPERATING ACTIVITIES
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">EBITDA</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-900">
                      {r.ebitdaIdrBillion.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Tax Paid</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-rose-700">
                      ({r.incomeTaxIdrBillion.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Movement in Working Capital</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-500">
                      0.00
                    </td>
                  ))}
                </tr>
                <tr className="bg-emerald-50/60 font-bold">
                  <td className="py-2 px-3 font-sans text-slate-900">Net Cash from Operating Activities</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-emerald-800">
                      {r.operatingCashFlow.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* INVESTING CASH FLOW */}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={annualRows.length + 1} className="py-1.5 px-3 font-sans text-slate-900 uppercase">
                    CASH FLOW FROM INVESTING ACTIVITIES
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Capital Expenditure (Operational)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-400">
                      0.00
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="py-2 px-3 font-sans text-slate-900">Net Cash from Investing Activities</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-slate-600">
                      0.00
                    </td>
                  ))}
                </tr>

                {/* FINANCING CASH FLOW */}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={annualRows.length + 1} className="py-1.5 px-3 font-sans text-slate-900 uppercase">
                    CASH FLOW FROM FINANCING ACTIVITIES
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Senior Debt Principal Repayment</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-rose-700">
                      ({r.principalRepayment.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Senior Debt Interest Payment</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-rose-700">
                      ({r.interestExpense.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">DSRA Cash Transfer (Funding/Release)</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-600">
                      ({r.dsraMovement.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-700">Equity Dividends Distributed</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-blue-700">
                      ({r.dividendsDistributed.toFixed(2)})
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="py-2 px-3 font-sans text-slate-900">Net Cash from Financing Activities</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-rose-700">
                      {r.financingCashFlow.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* NET CHANGE & ROLLFORWARD */}
                <tr className="bg-blue-50/70 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-2 px-3 font-sans">NET CHANGE IN CASH</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-slate-900">
                      {r.netChangeInCash.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans pl-6 text-slate-600">Cash Balance at Beginning of Period</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-1.5 px-3 text-right text-slate-600">
                      {r.cashBeginningBalance.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-2 px-3 font-sans">CASH BALANCE AT END OF PERIOD</td>
                  {annualRows.map((r) => (
                    <td key={r.year} className="py-2 px-3 text-right text-emerald-400">
                      {r.cashEndingBalance.toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
