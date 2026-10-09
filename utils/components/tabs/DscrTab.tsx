import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  ModelMetrics,
  CurrencyDisplay,
} from '../../types';
import {
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  Award,
  CheckCircle2,
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

interface DscrTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  currencyDisplay: CurrencyDisplay;
  onUpdateAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onChangeAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onOpenAuditTrace: (key: string) => void;
}

export const DscrTab: React.FC<DscrTabProps> = ({
  assumptions,
  annualRows,
  metrics,
  currencyDisplay,
  onUpdateAssumptions,
  onChangeAssumptions,
  onOpenAuditTrace,
}) => {
  const repaymentYears = assumptions.funding.repaymentPeriodYears;
  const covenantThreshold = assumptions.funding.covenantDscrBenchmark ?? 1.20;
  const isCovenantPassed = metrics.minDscr >= covenantThreshold;

  const handleUpdateCovenant = (val: number) => {
    const updated = {
      ...assumptions,
      funding: {
        ...assumptions.funding,
        covenantDscrBenchmark: val,
      },
    };
    if (typeof onUpdateAssumptions === 'function') {
      onUpdateAssumptions(updated);
    } else if (typeof onChangeAssumptions === 'function') {
      onChangeAssumptions(updated);
    }
  };

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

  const chartData = annualRows.slice(0, repaymentYears).map((r) => ({
    year: `Y${r.year}`,
    dscr: r.dscr ? Number(r.dscr.toFixed(2)) : 0,
    covenant: covenantThreshold,
    cfads: (r.cfads ?? r.cfadsIdrBillion ?? 0) * mult,
    debtService: (r.totalDebtService ?? r.debtServiceIdrBillion ?? 0) * mult,
  }));

  return (
    <div className="space-y-4 text-xs">
      {/* Title Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            18
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Debt Service Coverage Ratio (DSCR) Analysis
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Annual DSCR Profile, Banking Covenant Benchmarks & Default Buffer
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Configurable Covenant Benchmark Control */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded">
            <span className="text-[11px] font-bold text-slate-600">DSCR Covenant Threshold:</span>
            <div className="flex items-center gap-1">
              {[1.15, 1.20, 1.25, 1.30].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleUpdateCovenant(t)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                    Math.abs(covenantThreshold - t) < 0.001
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t.toFixed(2)}x
                </button>
              ))}
              <input
                type="number"
                step="0.01"
                min="1.0"
                max="3.0"
                value={covenantThreshold}
                onChange={(e) => handleUpdateCovenant(parseFloat(e.target.value) || 1.20)}
                className="w-14 text-right px-1 py-0.5 rounded bg-white border border-slate-300 text-[11px] font-mono font-bold text-slate-900"
                title="Adjust bank DSCR covenant threshold (dynamic, not hardcoded)"
              />
              <span className="font-mono text-[10px] text-slate-500">x</span>
            </div>
          </div>

          <div
            className={`px-3 py-1 rounded border font-bold flex items-center gap-1.5 ${
              isCovenantPassed
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isCovenantPassed ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>
              {isCovenantPassed
                ? `COVENANT COMPLIANT (>= ${covenantThreshold.toFixed(2)}x)`
                : `COVENANT BREACH (< ${covenantThreshold.toFixed(2)}x)`}
            </span>
          </div>
          <button
            data-audit-key="min_dscr"
            onClick={() => onOpenAuditTrace('min_dscr')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            Trace Min DSCR
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Minimum DSCR</div>
          <div
            className={`text-base font-black mt-1 ${
              isCovenantPassed ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {metrics.minDscr.toFixed(2)}x
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
            Buffer: {((metrics.minDscr - covenantThreshold) * 100).toFixed(0)} bps above covenant
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Average DSCR</div>
          <div className="text-base font-black text-blue-700 mt-1">
            {metrics.avgDscr.toFixed(2)}x
          </div>
          <div className="text-[10px] text-blue-600 font-sans mt-0.5">
            Over {repaymentYears}-Year Repayment Tenor
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Banking Covenant</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {covenantThreshold.toFixed(2)}x
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">Senior Lender Lock-up Test</div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-3">
          <div className="text-[10px] text-slate-500 font-sans uppercase font-bold">Amortization Structure</div>
          <div className="text-base font-black text-slate-900 mt-1 uppercase">
            {assumptions.funding.amortizationType.replace('_', ' ')}
          </div>
          <div className="text-[10px] text-slate-500 font-sans mt-0.5">15-Year Mortgage Profile</div>
        </div>
      </div>

      {/* Chart: DSCR Profile vs 1.20x Covenant */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
          <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            Annual DSCR Profile vs Lender Covenant ({covenantThreshold.toFixed(2)}x)
          </span>
          <span className="text-[10px] font-mono text-slate-400">Operating Years 1 - {repaymentYears}</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="#94A3B8" />
              <YAxis domain={[0.8, 2.0]} tick={{ fontSize: 10 }} stroke="#94A3B8" />
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
                y={covenantThreshold}
                stroke="#DC2626"
                strokeDasharray="4 4"
                label={{
                  value: `Covenant Threshold (${covenantThreshold.toFixed(2)}x)`,
                  fill: '#DC2626',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
              <Line
                type="monotone"
                dataKey="dscr"
                name="Actual DSCR"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#2563EB' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Annual DSCR Table */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-800">
            Annual Debt Service Coverage Ratio Ledger
          </span>
          <span className="text-[10px] font-mono text-slate-500">Units: {unitLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-[11px] font-mono">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 border-b border-slate-300 text-[10px]">
              <tr>
                <th className="p-2 text-left">Year</th>
                <th className="p-2 text-left">Period</th>
                <th className="p-2">CFADS</th>
                <th className="p-2">Principal</th>
                <th className="p-2">Interest</th>
                <th className="p-2 font-bold">Total Debt Service</th>
                <th className="p-2 text-blue-700 font-bold">DSCR</th>
                <th className="p-2">Covenant Buffer</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {annualRows.slice(0, repaymentYears).map((row) => {
                const dscrVal = row.dscr || 0;
                const buffer = dscrVal - covenantThreshold;
                const isPassed = dscrVal >= covenantThreshold;
                return (
                  <tr key={row.year} className="hover:bg-slate-50">
                    <td className="p-1.5 text-left font-bold text-slate-900">Y{row.year}</td>
                    <td className="p-1.5 text-left text-slate-500 font-sans">{row.dateStr || `Year ${row.year}`}</td>
                    <td className="p-1.5 text-slate-800">{((row.cfads ?? row.cfadsIdrBillion ?? 0) * mult).toFixed(2)}</td>
                    <td className="p-1.5 text-slate-600">
                      {((row.debtPrincipalRepayment ?? row.principalRepayment ?? 0) * mult).toFixed(2)}
                    </td>
                    <td className="p-1.5 text-slate-600">
                      {((row.debtInterestExpense ?? row.interestExpense ?? 0) * mult).toFixed(2)}
                    </td>
                    <td className="p-1.5 font-bold text-slate-900">
                      {((row.totalDebtService ?? row.debtServiceIdrBillion ?? 0) * mult).toFixed(2)}
                    </td>
                    <td className={`p-1.5 font-black text-xs ${isPassed ? 'text-blue-700' : 'text-rose-700'}`}>
                      {dscrVal.toFixed(2)}x
                    </td>
                    <td className={`p-1.5 ${buffer >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {buffer >= 0 ? `+${buffer.toFixed(2)}x` : `${buffer.toFixed(2)}x`}
                    </td>
                    <td className="p-1.5 text-center">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isPassed ? 'PASS' : 'BREACH'}
                      </span>
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
