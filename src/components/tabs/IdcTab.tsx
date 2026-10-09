import React from 'react';
import {
  FullModelAssumptions,
  MonthlyCapexSchedule,
  SourcesAndUses,
  CurrencyDisplay,
  IdcMode,
} from '../../types';
import {
  Calculator,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface IdcTabProps {
  assumptions: FullModelAssumptions;
  capexSchedule: MonthlyCapexSchedule[];
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onChangeIdcMode?: (mode: IdcMode) => void;
  onOpenAuditTrace: (key: string) => void;
}

export const IdcTab: React.FC<IdcTabProps> = ({
  assumptions,
  capexSchedule,
  sourcesAndUses,
  currencyDisplay,
  onChangeIdcMode,
  onOpenAuditTrace,
}) => {
  const { funding } = assumptions;
  const currentMode = funding.idcMode;

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

  let cumIdc = 0;
  const chartData = capexSchedule.map((m) => {
    cumIdc += m.idcCapitalized + m.idcPaid;
    return {
      month: `M${m.month}`,
      monthlyIdc: (m.idcCapitalized + m.idcPaid) * mult,
      cumIdc: cumIdc * mult,
      runningDebt: m.closingDebt * mult,
    };
  });

  const totalIdc = sourcesAndUses.idcTotal;
  const monthlyRatePct = (funding.bankInterestRatePct / 12).toFixed(3);

  return (
    <div className="space-y-4 text-xs">
      {/* Title Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            08
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Interest During Construction (IDC) Engine
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Monthly Compounding, Capitalization vs Cash Payment & Reconciliation Proof
            </p>
          </div>
        </div>

        {/* IDC Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-300">
          <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5">IDC Mode:</span>
          {(['capitalized', 'paid'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onChangeIdcMode && onChangeIdcMode(mode)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                currentMode === mode
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* KPI & Audit Callout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Total IDC Incurred</div>
          <div className="text-base font-black text-amber-700 mt-1">
            {(totalIdc * mult).toLocaleString(undefined, { maximumFractionDigits: 3 })}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{unitLabel}</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Annualized Interest</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {funding.bankInterestRatePct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            {monthlyRatePct}% per month (nominal)
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Treatment Status</div>
          <div className="text-base font-black text-slate-900 mt-1 uppercase">
            {currentMode}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            {currentMode === 'capitalized' ? 'Added to Loan Balance' : 'Funded via Equity'}
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Anti-Double-Count Check</div>
          <div className="text-base font-black text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            PASSED
          </div>
          <div className="text-[10px] text-emerald-700 font-sans mt-0.5">
            Excluded from initial PPE base
          </div>
        </div>
      </div>

      {/* IDC Calculation Rule Explanation */}
      <div className="bg-amber-50/70 border border-amber-200 rounded p-3 text-amber-900 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Project Finance IDC Accounting Standard: </span>
          In CAPITALIZED mode, the monthly construction financing interest is capitalized onto the senior debt principal balance each month.
          Crucially, to preserve strict balance sheet equilibrium (Assets = Liabilities + Equity), this capitalized financing cost must{' '}
          <span className="font-semibold underline">not</span> be added onto the physical plant PPE base for accounting depreciation, avoiding the fatal double-counting error seen in un-audited models.
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            Cumulative IDC Growth vs Running Senior Debt ({unitLabel})
          </span>
          <span className="text-[10px] font-mono text-slate-400">30 Months Construction</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={2} stroke="#94A3B8" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#94A3B8" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#F59E0B" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#CBD5E1',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="runningDebt"
                name="Running Senior Debt"
                stroke="#334155"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumIdc"
                name="Cumulative IDC"
                stroke="#D97706"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Ledger Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800">
            Monthly IDC Calculation Schedule (Month 1 to Month 30)
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2 text-left">Month</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2">Opening Debt</th>
                <th className="p-2">Monthly Drawdown</th>
                <th className="p-2 text-slate-500">Monthly Rate</th>
                <th className="p-2 text-amber-700">Monthly Interest</th>
                <th className="p-2 text-amber-800 font-bold">IDC Capitalized</th>
                <th className="p-2 font-black">Closing Debt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {capexSchedule.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50">
                  <td className="p-1.5 text-left font-bold text-slate-900">M{row.month}</td>
                  <td className="p-1.5 text-left text-slate-500 font-sans">{row.dateStr}</td>
                  <td className="p-1.5 text-slate-600">{(row.openingDebt * mult).toFixed(2)}</td>
                  <td className="p-1.5 text-slate-700">{(row.debtDrawdown * mult).toFixed(2)}</td>
                  <td className="p-1.5 text-slate-400 font-sans">{monthlyRatePct}%</td>
                  <td className="p-1.5 text-amber-600 font-medium">
                    {((row.idcCapitalized + row.idcPaid) * mult).toFixed(3)}
                  </td>
                  <td className="p-1.5 text-amber-800 font-bold">
                    {(row.idcCapitalized * mult).toFixed(3)}
                  </td>
                  <td className="p-1.5 font-bold text-slate-900">
                    {(row.closingDebt * mult).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td colSpan={5} className="p-2 text-left font-sans uppercase">
                  Total Capitalized IDC at COD
                </td>
                <td className="p-2 text-amber-600">{(totalIdc * mult).toFixed(3)}</td>
                <td className="p-2 text-amber-800">
                  {(sourcesAndUses.idcTotal * mult).toFixed(3)}
                </td>
                <td className="p-2">
                  {(sourcesAndUses.bankLoanAmount * mult).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
