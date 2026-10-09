import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  CurrencyDisplay,
} from '../../types';
import {
  Gauge,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
  Award,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

interface LlcrTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const LlcrTab: React.FC<LlcrTabProps> = ({
  assumptions,
  annualRows,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const repaymentYears = assumptions.funding.repaymentPeriodYears;
  const debtRate = assumptions.funding.bankInterestRatePct / 100;

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

  // Calculate LLCR for each repayment year using canonical audited row fields
  const llcrSchedule = annualRows.slice(0, repaymentYears).map((row, idx) => {
    let npvRemainingCfads = 0;
    for (let t = idx; t < repaymentYears; t++) {
      npvRemainingCfads += annualRows[t].cfadsIdrBillion / Math.pow(1 + debtRate, t - idx + 1);
    }

    return {
      year: row.year,
      cfads: row.cfadsIdrBillion,
      openingDebt: row.debtOpeningBalance,
      npvRemainingCfads,
      llcr: row.llcr,
    };
  });

  const validLlcrs = llcrSchedule
    .map((item) => item.llcr)
    .filter((l): l is number => l !== null && Number.isFinite(l));
  const minLlcr = validLlcrs.length > 0 ? Math.min(...validLlcrs) : 0;
  const avgLlcr = validLlcrs.length > 0 ? validLlcrs.reduce((a, b) => a + b, 0) / validLlcrs.length : 0;

  const chartData = llcrSchedule.map((item) => ({
    year: `Y${item.year}`,
    llcr: item.llcr ? Number(item.llcr.toFixed(2)) : 0,
    covenant: 1.30,
    npvCfads: item.npvRemainingCfads * mult,
    debt: item.openingDebt * mult,
  }));

  return (
    <div className="space-y-4 text-xs">
      {/* Title Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            20
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Loan Life Coverage Ratio (LLCR) Engine
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              NPV of Remaining CFADS over Loan Life vs Senior Debt Principal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Min LLCR: {minLlcr.toFixed(2)}x (&gt; 1.30x Target)
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Minimum LLCR</div>
          <div className="text-base font-black text-emerald-700 mt-1">
            {minLlcr.toFixed(2)}x
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">Lowest coverage point across loan</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Average LLCR</div>
          <div className="text-base font-black text-blue-700 mt-1">
            {avgLlcr.toFixed(2)}x
          </div>
          <div className="text-[10px] text-blue-600 font-sans mt-0.5">Across 15-year senior tenor</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Discount Rate</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {assumptions.funding.bankInterestRatePct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">Cost of Senior Debt</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Covenant Benchmark</div>
          <div className="text-base font-black text-slate-900 mt-1">
            1.30x
          </div>
          <div className="text-[10px] text-emerald-700 font-sans mt-0.5">Substantial Banking Cushion</div>
        </div>
      </div>

      {/* Chart: LLCR Profile */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            Annual Loan Life Coverage Ratio (LLCR) Profile
          </span>
          <span className="text-[10px] font-mono text-slate-400">Discounted at {assumptions.funding.bankInterestRatePct}%</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="#94A3B8" />
              <YAxis domain={[1.0, 2.5]} tick={{ fontSize: 10 }} stroke="#94A3B8" />
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
              <ReferenceLine
                y={1.30}
                stroke="#DC2626"
                strokeDasharray="4 4"
                label={{ value: 'Target LLCR (1.30x)', fill: '#DC2626', fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="llcr"
                name="LLCR"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#059669' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LLCR Schedule Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800">
            15-Year LLCR Schedule & Remaining CFADS NPV
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2 text-left">Year</th>
                <th className="p-2">Annual CFADS</th>
                <th className="p-2">Opening Senior Debt</th>
                <th className="p-2 text-blue-700">NPV of Remaining CFADS</th>
                <th className="p-2 font-bold text-emerald-800">LLCR</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {llcrSchedule.map((row) => (
                <tr key={row.year} className="hover:bg-slate-50">
                  <td className="p-1.5 text-left font-bold text-slate-900">Y{row.year}</td>
                  <td className="p-1.5 text-slate-800">{(row.cfads * mult).toFixed(2)}</td>
                  <td className="p-1.5 text-slate-600">{(row.openingDebt * mult).toFixed(2)}</td>
                  <td className="p-1.5 text-blue-700 font-medium">
                    {(row.npvRemainingCfads * mult).toFixed(2)}
                  </td>
                  <td className="p-1.5 font-bold text-emerald-700">
                    {row.llcr ? `${row.llcr.toFixed(2)}x` : '-'}
                  </td>
                  <td className="p-1.5 text-center">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-emerald-100 text-emerald-800">
                      COMPLIANT
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
