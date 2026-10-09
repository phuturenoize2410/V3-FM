import React from 'react';
import {
  FullModelAssumptions,
  MonthlyCapexSchedule,
  SourcesAndUses,
  CurrencyDisplay,
  DrawdownOrder,
} from '../../types';
import {
  DollarSign,
  Layers,
  ArrowRight,
  Shield,
  Clock,
  PieChart,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface FundingTabProps {
  assumptions: FullModelAssumptions;
  capexSchedule: MonthlyCapexSchedule[];
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onChangeDrawdownOrder?: (order: DrawdownOrder) => void;
  onOpenAuditTrace: (key: string) => void;
}

export const FundingTab: React.FC<FundingTabProps> = ({
  assumptions,
  capexSchedule,
  sourcesAndUses,
  currencyDisplay,
  onChangeDrawdownOrder,
  onOpenAuditTrace,
}) => {
  const { funding, project } = assumptions;
  const currentOrder = funding.drawdownOrder || 'pro_rata';

  // Currency multiplier
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

  // Cumulative drawdowns for charting
  let cumDebt = 0;
  let cumEquity = 0;
  const chartData = capexSchedule.map((m) => {
    cumDebt += m.debtDrawdown;
    cumEquity += m.equityDrawdown;
    return {
      month: `M${m.month}`,
      debtMonthly: m.debtDrawdown * mult,
      equityMonthly: m.equityDrawdown * mult,
      cumDebt: cumDebt * mult,
      cumEquity: cumEquity * mult,
      totalSpend: m.totalCapex * mult,
    };
  });

  const totalEquityDrawn = capexSchedule.reduce((sum, m) => sum + m.equityDrawdown, 0);
  const totalDebtDrawn = capexSchedule.reduce((sum, m) => sum + m.debtDrawdown, 0);

  return (
    <div className="space-y-4 text-xs">
      {/* Header Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            06
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Funding Sequencing & Drawdown Schedule
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Capital Calling Logic, Drawdown Priority & Construction Funding
            </p>
          </div>
        </div>

        {/* Drawdown Priority Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-300">
          <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5">Drawdown Rule:</span>
          {(
            [
              { id: 'pro_rata', label: 'Pro-Rata (70/30)' },
              { id: 'equity_first', label: 'Equity First' },
              { id: 'debt_first', label: 'Debt First' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              onClick={() => onChangeDrawdownOrder && onChangeDrawdownOrder(mode.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                currentOrder === mode.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Total Base CAPEX</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {(sourcesAndUses.baseCapexTotal * mult).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{unitLabel}</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Total Equity Funded</div>
          <div className="text-base font-black text-blue-700 mt-1">
            {(totalEquityDrawn * mult).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-blue-600 font-sans mt-0.5">
            {((totalEquityDrawn / (sourcesAndUses.baseCapexTotal || 1)) * 100).toFixed(1)}% of Base Capex
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Senior Debt Drawn</div>
          <div className="text-base font-black text-slate-800 mt-1">
            {(totalDebtDrawn * mult).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            {((totalDebtDrawn / (sourcesAndUses.baseCapexTotal || 1)) * 100).toFixed(1)}% of Base Capex
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Total Capitalized IDC</div>
          <div className="text-base font-black text-amber-700 mt-1">
            {(sourcesAndUses.idcTotal * mult).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-amber-600 font-sans mt-0.5">Rolled into COD Debt</div>
        </div>
      </div>

      {/* Chart: Cumulative Drawdown Profile */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            Cumulative Capital Drawdown S-Curve ({unitLabel})
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Rule: {currentOrder.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={2} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
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
              <Area
                type="monotone"
                dataKey="cumEquity"
                name="Cumulative Equity"
                stackId="1"
                stroke="#2563EB"
                fill="#3B82F6"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="cumDebt"
                name="Cumulative Debt"
                stackId="1"
                stroke="#475569"
                fill="#64748B"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Drawdown Schedule Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800">
            Monthly Construction Funding Ledger (30 Months)
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2 text-left">Month</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2">Monthly Capex</th>
                <th className="p-2 text-blue-700">Equity Drawdown</th>
                <th className="p-2 text-slate-800">Debt Drawdown</th>
                <th className="p-2">Opening Debt</th>
                <th className="p-2 text-amber-700">IDC Capitalized</th>
                <th className="p-2 font-black">Closing Debt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {capexSchedule.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50">
                  <td className="p-1.5 text-left font-bold text-slate-900">M{row.month}</td>
                  <td className="p-1.5 text-left text-slate-500 font-sans">{row.dateStr}</td>
                  <td className="p-1.5 font-bold text-slate-800">
                    {(row.totalCapex * mult).toFixed(2)}
                  </td>
                  <td className="p-1.5 text-blue-700 font-medium">
                    {(row.equityDrawdown * mult).toFixed(2)}
                  </td>
                  <td className="p-1.5 text-slate-800 font-medium">
                    {(row.debtDrawdown * mult).toFixed(2)}
                  </td>
                  <td className="p-1.5 text-slate-500">{(row.openingDebt * mult).toFixed(2)}</td>
                  <td className="p-1.5 text-amber-700">{(row.idcCapitalized * mult).toFixed(3)}</td>
                  <td className="p-1.5 font-bold text-slate-900">
                    {(row.closingDebt * mult).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td colSpan={2} className="p-2 text-left font-sans uppercase">
                  Total Construction Drawdown
                </td>
                <td className="p-2">
                  {(sourcesAndUses.baseCapexTotal * mult).toFixed(2)}
                </td>
                <td className="p-2 text-blue-700">
                  {(totalEquityDrawn * mult).toFixed(2)}
                </td>
                <td className="p-2 text-slate-800">
                  {(totalDebtDrawn * mult).toFixed(2)}
                </td>
                <td className="p-2">-</td>
                <td className="p-2 text-amber-700">
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
