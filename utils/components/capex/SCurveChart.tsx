import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { MonthlyCapexSchedule, DrawdownOrder, CurrencyDisplay } from '../../types';
import { TrendingUp, ArrowDownCircle, ShieldCheck, DollarSign } from 'lucide-react';

interface SCurveChartProps {
  schedule: MonthlyCapexSchedule[];
  drawdownOrder: DrawdownOrder;
  onChangeDrawdownOrder?: (order: DrawdownOrder) => void;
  currencyDisplay: CurrencyDisplay;
  fxRate: number;
}

export const SCurveChart: React.FC<SCurveChartProps> = ({
  schedule,
  drawdownOrder,
  onChangeDrawdownOrder,
  currencyDisplay,
  fxRate,
}) => {
  const mult =
    currencyDisplay === 'IDR_B'
      ? 1
      : currencyDisplay === 'IDR_M'
      ? 1000
      : currencyDisplay === 'USD_M'
      ? 1 / (fxRate / 1000)
      : (1000 / fxRate) * 1000;

  const unitLabel =
    currencyDisplay === 'IDR_B'
      ? 'IDR Billion'
      : currencyDisplay === 'IDR_M'
      ? 'IDR Million'
      : currencyDisplay === 'USD_M'
      ? 'USD Million'
      : 'USD Thousand';

  // Prepare chart data
  const chartData = schedule.map((row) => ({
    name: `M${row.month}`,
    month: row.month,
    dateStr: row.dateStr,
    totalCapex: Number((row.totalCapex * mult).toFixed(2)),
    debtDrawdown: Number((row.debtDrawdown * mult).toFixed(2)),
    equityDrawdown: Number((row.equityDrawdown * mult).toFixed(2)),
    cumulativeCapex: Number((row.cumulativeCapex * mult).toFixed(2)),
    sCurvePct: Number(row.cumulativeCapexPct.toFixed(1)),
    undrawnDebt: Number((row.undrawnDebt * mult).toFixed(2)),
    monthlyInterest: Number((row.monthlyInterest * mult).toFixed(2)),
  }));

  // Calculations for KPI cards
  const peakMonthlyCapex = Math.max(...schedule.map((r) => r.totalCapex), 0);
  const peakMonth = schedule.find((r) => r.totalCapex === peakMonthlyCapex)?.month || 1;
  const avgMonthlyCapex =
    schedule.length > 0
      ? schedule.reduce((sum, r) => sum + r.totalCapex, 0) / schedule.length
      : 0;

  const totalEquityDisbursed = schedule.reduce((sum, r) => sum + r.equityDrawdown, 0);
  const totalDebtDisbursed = schedule.reduce((sum, r) => sum + r.debtDrawdown, 0);

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-xs p-4 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-100 text-blue-800">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm tracking-wide">
              Physical S-Curve & Construction Disbursement Profile
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            The cumulative S-Curve links directly to monthly CAPEX cash requirements, bank drawdowns and sponsor equity calls.
          </p>
        </div>

        {/* Drawdown Order Strategy Selector */}
        {onChangeDrawdownOrder && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs">
            <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
              Drawdown Strategy:
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onChangeDrawdownOrder('pro_rata')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  drawdownOrder === 'pro_rata'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Monthly pari-passu drawdown in proportion to debt and equity"
              >
                Pari-Passu (Pro-Rata)
              </button>
              <button
                type="button"
                onClick={() => onChangeDrawdownOrder('equity_first')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  drawdownOrder === 'equity_first'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Sponsors contribute all equity before debt drawdown"
              >
                Equity First
              </button>
              <button
                type="button"
                onClick={() => onChangeDrawdownOrder('debt_first')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  drawdownOrder === 'debt_first'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Bank debt is drawn first up to the commitment limit"
              >
                Debt First
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
          <div className="text-[10px] text-slate-500 font-bold uppercase">Peak Cash Requirement Month</div>
          <div className="text-base font-black text-slate-900 mt-0.5">
            Month M{peakMonth}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
            {(peakMonthlyCapex * mult).toFixed(2)} {unitLabel}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
          <div className="text-[10px] text-slate-500 font-bold uppercase">Average CAPEX Cash Burn</div>
          <div className="text-base font-black text-slate-900 mt-0.5">
            {(avgMonthlyCapex * mult).toFixed(2)} {unitLabel}/bln
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Total {schedule.length} construction months
          </div>
        </div>

        <div className="bg-blue-50/60 border border-blue-200 rounded p-2.5">
          <div className="text-[10px] text-blue-800 font-bold uppercase">Debt Drawdown Bank (Senior Debt)</div>
          <div className="text-base font-black text-blue-900 mt-0.5">
            {(totalDebtDisbursed * mult).toFixed(2)} {unitLabel}
          </div>
          <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
            {schedule.length > 0 && schedule[schedule.length - 1].cumulativeCapex > 0
              ? ((totalDebtDisbursed / schedule[schedule.length - 1].cumulativeCapex) * 100).toFixed(1)
              : '0.0'}% of Base CAPEX
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded p-2.5">
          <div className="text-[10px] text-emerald-800 font-bold uppercase">Equity Drawdown Sponsor</div>
          <div className="text-base font-black text-emerald-900 mt-0.5">
            {(totalEquityDisbursed * mult).toFixed(2)} {unitLabel}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {schedule.length > 0 && schedule[schedule.length - 1].cumulativeCapex > 0
              ? ((totalEquityDisbursed / schedule[schedule.length - 1].cumulativeCapex) * 100).toFixed(1)
              : '0.0'}% of Base CAPEX
          </div>
        </div>
      </div>

      {/* Main Composed Chart */}
      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            {/* Left Y-Axis for Monthly Cash Requirement & Disbursement */}
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tickFormatter={(v) => `${v}`}
              label={{
                value: `Cash Requirements & Disbursement (${unitLabel})`,
                angle: -90,
                position: 'insideLeft',
                fontSize: 10,
                fill: '#64748b',
                offset: 5,
              }}
            />
            {/* Right Y-Axis for Cumulative S-Curve % */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#ea580c"
              fontSize={11}
              domain={[0, 100]}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: 'Cumulative S-Curve (%)',
                angle: 90,
                position: 'insideRight',
                fontSize: 10,
                fill: '#ea580c',
                offset: 10,
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs font-sans space-y-1.5 min-w-[240px]">
                    <div className="font-bold text-sm border-b border-slate-700 pb-1 flex justify-between">
                      <span>Month {d.name} ({d.dateStr})</span>
                      <span className="text-amber-400 font-mono">{d.sCurvePct}%</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>CAPEX Requirements:</span>
                      <span className="font-mono font-bold text-white">
                        {d.totalCapex} {unitLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>Equity Drawdown:</span>
                      <span className="font-mono font-semibold">
                        {d.equityDrawdown} {unitLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-blue-400">
                      <span>Bank Debt Drawdown:</span>
                      <span className="font-mono font-semibold">
                        {d.debtDrawdown} {unitLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-300 pt-1 border-t border-slate-700">
                      <span>Remaining Undrawn Facility:</span>
                      <span className="font-mono">{d.undrawnDebt} {unitLabel}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
            />
            {/* Bars for Cash Disbursement */}
            <Bar
              yAxisId="left"
              dataKey="equityDrawdown"
              name="Equity Drawdown (Equity Call)"
              stackId="disb"
              fill="#10b981"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="debtDrawdown"
              name="Bank Loan Drawdown"
              stackId="disb"
              fill="#2563eb"
              radius={[2, 2, 0, 0]}
            />
            {/* Line for S-Curve Cumulative % */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sCurvePct"
              name="Cumulative S-Curve (%)"
              stroke="#ea580c"
              strokeWidth={3}
              dot={{ r: 2.5, fill: '#ea580c' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
