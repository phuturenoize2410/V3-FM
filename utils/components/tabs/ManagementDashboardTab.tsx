import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  ModelMetrics,
  SourcesAndUses,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatPercent,
  formatMultiple,
  formatNumber,
} from '../../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Shield,
  Zap,
  DollarSign,
  Activity,
} from 'lucide-react';

interface ManagementDashboardTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
}

export const ManagementDashboardTab: React.FC<ManagementDashboardTabProps> = ({
  assumptions,
  annualRows,
  metrics,
  sourcesAndUses,
  currencyDisplay,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;

  // Chart 1 data: Cash Flow Waterfall & Coverage
  const cashFlowChartData = annualRows.map((r) => ({
    year: `Y${r.year}`,
    OperatingCF: parseFloat((r.operatingCashFlow ?? r.cfadsIdrBillion ?? 0).toFixed(2)),
    DebtService: parseFloat((r.totalDebtService ?? r.debtServiceIdrBillion ?? 0).toFixed(2)),
    FCFE: parseFloat((r.fcfeIdrBillion ?? r.equityCashFlow ?? 0).toFixed(2)),
    Dividends: parseFloat((r.dividendsDistributed ?? r.dividendsPaid ?? 0).toFixed(2)),
  }));

  // Chart 2 data: DSCR Coverage Curve
  const dscrChartData = annualRows
    .filter((r) => r.year <= assumptions.funding.repaymentPeriodYears)
    .map((r) => ({
      year: `Y${r.year}`,
      DSCR: r.dscr !== null && r.dscr !== undefined ? parseFloat(r.dscr.toFixed(2)) : 0,
      LLCR: r.llcr !== null && r.llcr !== undefined ? parseFloat(r.llcr.toFixed(2)) : 0,
      Covenant: 1.2,
    }));

  // Chart 3 data: Revenue & EBITDA Growth
  const revenueChartData = annualRows.map((r) => ({
    year: `Y${r.year}`,
    Revenue: parseFloat(r.revenueIdrBillion.toFixed(2)),
    EBITDA: parseFloat(r.ebitdaIdrBillion.toFixed(2)),
    NetIncome: parseFloat(r.netIncomeIdrBillion.toFixed(2)),
  }));

  // Chart 4 data: Generation & Tariff
  const genChartData = annualRows.map((r) => ({
    year: `Y${r.year}`,
    NetGenGWh: parseFloat(r.netGenerationGWh.toFixed(2)),
    TariffIDR: parseFloat(r.tariffIdrPerKWh.toFixed(0)),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Executive Summary Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Project IRR (Unlevered)
          </span>
          <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
            {formatPercent(metrics.projectIrrPct, 2)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Pre-gearing return</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
            Equity IRR (Levered)
          </span>
          <span className="text-xl font-bold text-emerald-700 font-mono mt-1 block">
            {formatPercent(metrics.equityIrrPct, 2)}
          </span>
          <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Sponsor equity yield</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Equity NPV
          </span>
          <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
            {formatCurrencyValue(metrics.equityNpvIdrBillion, currencyDisplay, fx, 1)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">At Ke {assumptions.valuation.costOfEquityPct}%</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Minimum DSCR
          </span>
          <span
            className={`text-xl font-bold font-mono mt-1 block ${
              metrics.minDscr >= 1.2 ? 'text-blue-700' : 'text-rose-600'
            }`}
          >
            {formatMultiple(metrics.minDscr, 2)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Covenant ≥ 1.20x</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Average DSCR
          </span>
          <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
            {formatMultiple(metrics.avgDscr, 2)}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Across 10-Yr Tenor</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
            Levelized Cost (LCOE)
          </span>
          <span className="text-xl font-bold text-amber-700 font-mono mt-1 block">
            {metrics.lcoeCentsPerKWh.toFixed(2)} ¢
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{metrics.lcoeIdrPerKWh.toFixed(1)} IDR/kWh</span>
        </div>
      </div>

      {/* Primary Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Cash Flow & Debt Service Profile */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Operating Cash Flow vs Senior Debt Service
              </h3>
              <p className="text-xs text-slate-500">
                Clear cash headroom above debt service during the 10-year bank loan tenor.
              </p>
            </div>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={2} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val: any) => [`${val} IDR B`, '']}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="OperatingCF" name="Operating Cash Flow" fill="#0284c7" radius={[2, 2, 0, 0]} />
                <Bar dataKey="DebtService" name="Senior Debt Service" fill="#e11d48" radius={[2, 2, 0, 0]} />
                <Bar dataKey="FCFE" name="FCFE (To Equity)" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: DSCR Banking Trajectory vs Covenant */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Annual DSCR & LLCR Coverage vs 1.20x Covenant
              </h3>
              <p className="text-xs text-slate-500">
                Credit headroom verification over the full loan repayment life.
              </p>
            </div>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dscrChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis domain={[1.0, 'auto']} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val: any) => [`${val}x`, '']}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine y={1.2} label={{ value: '1.20x Covenant', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="DSCR" name="Annual DSCR" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="LLCR" name="Loan Life Coverage (LLCR)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Revenue & EBITDA Trajectory */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                30-Year Revenue, EBITDA & Net Profit Profile
              </h3>
              <p className="text-xs text-slate-500">
                Predictable baseload clean power offtake under PLN PPA.
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={3} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(val: any) => [`${val} IDR B`, '']}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="Revenue" name="Revenue" stroke="#0284c7" fill="#0284c7" fillOpacity={0.15} />
                <Area type="monotone" dataKey="EBITDA" name="EBITDA" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                <Area type="monotone" dataKey="NetIncome" name="Net Profit" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Net Generation & Electricity Tariff */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Net Power Generation (GWh) & Escalated Tariff (IDR/kWh)
              </h3>
              <p className="text-xs text-slate-500">
                P50 hydrology generation curve with long-term degradation indexation.
              </p>
            </div>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={genChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={3} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#0284c7" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#f59e0b" />
                <Tooltip
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line yAxisId="left" type="monotone" dataKey="NetGenGWh" name="Net Generation (GWh)" stroke="#0284c7" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="TariffIDR" name="Tariff (IDR/kWh)" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
