import { ControlledActualFieldReviewPanel } from '../actual/ControlledActualFieldReviewPanel';
import type { ControlledActualFieldReviewController } from '../../application/useControlledActualFieldReview';
import React, { useState, useMemo } from 'react';
import {
  FullModelAssumptions,
  SourcesAndUses,
  AnnualOperatingRow,
  ModelMetrics,
  CurrencyDisplay,
  CapexRealizationItem,
  AnnualRealizationRow,
  PlanVsActualSummary,
} from '../../types';
import {
  generatePlanVsActualDataset,
  calculatePlanVsActualSummary,
  ActualPresetType,
} from '../../calculations/financialEngine';
import { formatCurrencyValue, formatNumber, formatPercent } from '../../utils/formatters';
import {
  GitCompare,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Zap,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  Sliders,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Edit3,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
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

interface PlanVsActualTabProps {
  controlledActualReview: ControlledActualFieldReviewController;
  assumptions: FullModelAssumptions;
  sourcesAndUses: SourcesAndUses;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace?: (key: string) => void;
}

export const PlanVsActualTab: React.FC<PlanVsActualTabProps> = ({
  controlledActualReview,
  assumptions,
  sourcesAndUses,
  annualRows,
  metrics,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'executive' | 'construction' | 'operations'>('executive');
  const [activePreset, setActivePreset] = useState<ActualPresetType>('on_track');

  // Base dataset initialized from assumptions and preset
  const [dataset, setDataset] = useState(() =>
    generatePlanVsActualDataset(assumptions, sourcesAndUses, annualRows, 'on_track')
  );

  const { capexRealization, annualRealization, actualCodDelayMonths } = dataset;

  const fx = assumptions.revenue.fxIdrPerUsd;
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

  // Load a preset template
  const handleLoadPreset = (preset: ActualPresetType) => {
    setActivePreset(preset);
    const newDs = generatePlanVsActualDataset(assumptions, sourcesAndUses, annualRows, preset);
    setDataset(newDs);
  };

  // Update Capex Item Realization (manual editing)
  const handleUpdateCapexItem = (
    id: string,
    field: 'contractAwardedIdrBillion' | 'actualIncurredIdrBillion' | 'contractorName' | 'notes',
    value: any
  ) => {
    setDataset((prev) => {
      const updatedItems = prev.capexRealization.map((item) => {
        if (item.id === id) {
          const newItem = { ...item, [field]: value };
          if (field === 'actualIncurredIdrBillion') {
            const actual = Number(value) || 0;
            const variance = Number((actual - newItem.planAmountIdrBillion).toFixed(3));
            const variancePct =
              newItem.planAmountIdrBillion > 0
                ? Number(((variance / newItem.planAmountIdrBillion) * 100).toFixed(2))
                : 0;
            let status: 'SAVINGS' | 'ON_TRACK' | 'OVERRUN' = 'ON_TRACK';
            if (variance > 0.05) status = 'OVERRUN';
            else if (variance < -0.05) status = 'SAVINGS';
            return {
              ...newItem,
              varianceIdrBillion: variance,
              variancePct,
              status,
            };
          }
          return newItem;
        }
        return item;
      });
      return { ...prev, capexRealization: updatedItems };
    });
  };

  // Update Operating Year Realization (manual editing)
  const handleUpdateOperatingRow = (
    year: number,
    field: 'actualNetGenGWh' | 'actualTariffIdr' | 'actualOpexIdrB',
    value: number
  ) => {
    setDataset((prev) => {
      const covenantBenchmark = assumptions.funding.covenantDscrBenchmark ?? 1.20;
      const updatedRows = prev.annualRealization.map((row) => {
        if (row.year === year) {
          const newRow = { ...row, [field]: value };
          const actualGen = field === 'actualNetGenGWh' ? value : row.actualNetGenGWh;
          const actualTariff = field === 'actualTariffIdr' ? value : row.actualTariffIdr;
          const actualOpex = field === 'actualOpexIdrB' ? value : row.actualOpexIdrB;

          const actualRev = Number(((actualGen * 1e6 * actualTariff) / 1e9).toFixed(3));
          const actualEbitda = Number((actualRev - actualOpex).toFixed(3));

          let actualDscr = row.actualDscr;
          if (row.actualDebtServiceIdrB > 0) {
            const tax = Math.max(0, (actualEbitda - 15) * 0.22);
            const cfads = actualEbitda - tax;
            actualDscr = Number((cfads / row.actualDebtServiceIdrB).toFixed(2));
          }
          const isCovenantMet = actualDscr !== null ? actualDscr >= covenantBenchmark : true;
          const actualDividends = !isCovenantMet ? 0 : Math.max(0, actualEbitda - row.actualDebtServiceIdrB);

          return {
            ...newRow,
            actualNetGenGWh: actualGen,
            genVarianceGWh: Number((actualGen - row.planNetGenGWh).toFixed(3)),
            genRealizationPct:
              row.planNetGenGWh > 0 ? Number(((actualGen / row.planNetGenGWh) * 100).toFixed(1)) : 100,
            actualTariffIdr: actualTariff,
            actualRevenueIdrB: actualRev,
            revenueVarianceIdrB: Number((actualRev - row.planRevenueIdrB).toFixed(3)),
            actualOpexIdrB: actualOpex,
            opexVarianceIdrB: Number((actualOpex - row.planOpexIdrB).toFixed(3)),
            actualEbitdaIdrB: actualEbitda,
            actualDscr,
            isCovenantMet,
            actualDividendsIdrB: Number(actualDividends.toFixed(3)),
          };
        }
        return row;
      });
      return { ...prev, annualRealization: updatedRows };
    });
  };

  // Compute live summary scorecard
  const summary: PlanVsActualSummary = useMemo(() => {
    return calculatePlanVsActualSummary(
      capexRealization,
      annualRealization,
      assumptions,
      metrics,
      actualCodDelayMonths
    );
  }, [capexRealization, annualRealization, assumptions, metrics, actualCodDelayMonths]);

  // Chart data: Capex breakdown by category
  const capexChartData = useMemo(() => {
    const cats: Record<string, { name: string; plan: number; actual: number }> = {};
    capexRealization.forEach((item) => {
      if (!cats[item.category]) {
        cats[item.category] = { name: item.category.toUpperCase(), plan: 0, actual: 0 };
      }
      cats[item.category].plan += item.planAmountIdrBillion;
      cats[item.category].actual += item.actualIncurredIdrBillion;
    });
    return Object.values(cats).map((c) => ({
      category: c.name,
      Plan: Number((c.plan * mult).toFixed(2)),
      Actual: Number((c.actual * mult).toFixed(2)),
    }));
  }, [capexRealization, mult]);

  // Chart data: Annual Revenue & EBITDA
  const annualChartData = useMemo(() => {
    return annualRealization.slice(0, 15).map((r) => ({
      year: `Y${r.year}`,
      'Plan Rev': Number((r.planRevenueIdrB * mult).toFixed(2)),
      'Actual Rev': Number((r.actualRevenueIdrB * mult).toFixed(2)),
      'Plan EBITDA': Number((r.planEbitdaIdrB * mult).toFixed(2)),
      'Actual EBITDA': Number((r.actualEbitdaIdrB * mult).toFixed(2)),
      'Plan DSCR': r.planDscr || 0,
      'Actual DSCR': r.actualDscr || 0,
      Covenant: summary.covenantDscr,
    }));
  }, [annualRealization, mult, summary.covenantDscr]);

  const isCovenantPassed = summary.actualMinDscr >= summary.covenantDscr;

  return (
    <>
      <ControlledActualFieldReviewPanel controller={controlledActualReview} items={capexRealization} population={dataset} projectName={assumptions.project.projectName} />
      <div role="note" className="rounded bg-amber-50 border border-amber-200 p-3 text-sm">Legacy / UNVERIFIED: all realization tables and calculated tax, revenue, IRR and DSCR below are illustrative or manually edited. A controlled source-field review does not verify these values.</div>
    <div className="space-y-5 animate-in fade-in duration-200 text-xs">
      {/* Header Banner & Template Loaders */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-slate-900 text-white font-bold">
              <GitCompare className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Plan vs. Actual Realization & Executive Variance Review
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold border border-emerald-200">
                  FinMod vs. As-Built
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Project profitability review: compare financial model assumptions (Plan / Feasibility Study) with legacy EPC and operating actuals (COD through the 30-year PPA).
              </p>
            </div>
          </div>
        </div>

        {/* Template Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Load Scenario Template:
          </span>
          <button
            type="button"
            onClick={() => handleLoadPreset('on_track')}
            className={`px-2.5 py-1.5 rounded text-[11px] font-bold cursor-pointer transition ${
              activePreset === 'on_track'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            🎯 On-Track (100% Plan)
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('mild_overrun')}
            className={`px-2.5 py-1.5 rounded text-[11px] font-bold cursor-pointer transition ${
              activePreset === 'mild_overrun'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
            }`}
            title="Moderate scenario: EPC overrun +3.8%, COD delay 2 months"
          >
            ⚠️ Overrun EPC & Delay
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('high_performance')}
            className={`px-2.5 py-1.5 rounded text-[11px] font-bold cursor-pointer transition ${
              activePreset === 'high_performance'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
            }`}
            title="Efficiency scenario: CAPEX savings -2.5%, hydrology +3.5%"
          >
            🚀 Outperformance
          </button>
          <button
            type="button"
            onClick={() => handleLoadPreset('stress_case')}
            className={`px-2.5 py-1.5 rounded text-[11px] font-bold cursor-pointer transition ${
              activePreset === 'stress_case'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
            }`}
            title="Stress scenario: CAPEX +8.5%, delay 5 months, El Niño drought (-13.5%)"
          >
            🚨 Stress El Niño
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-300 bg-white px-2 pt-2 rounded-t-lg">
        <button
          onClick={() => setActiveSubTab('executive')}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'executive'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
          Executive Summary & Profitability Scorecard
        </button>
        <button
          onClick={() => setActiveSubTab('construction')}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'construction'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-600" />
          EPC Contract Actuals & Construction Costs (CAPEX)
        </button>
        <button
          onClick={() => setActiveSubTab('operations')}
          className={`px-4 py-2 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'operations'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-600" />
          Operating Actuals from COD to PPA Expiry (30 Years)
        </button>
      </div>

      {/* SUB-VIEW 1: EXECUTIVE SUMMARY & SCORECARD */}
      {activeSubTab === 'executive' && (
        <div className="space-y-5">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Project IRR */}
            <div className="bg-white border border-slate-300 rounded p-3 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Project IRR (Post-Tax)
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-black text-slate-900">
                  {summary.actualProjectIrr.toFixed(2)}%
                </span>
                <span className="text-[11px] text-slate-400">Plan: {summary.planProjectIrr.toFixed(2)}%</span>
              </div>
              <div
                className={`text-[10px] font-bold mt-1 flex items-center gap-0.5 ${
                  summary.actualProjectIrr >= summary.planProjectIrr
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}
              >
                {summary.actualProjectIrr >= summary.planProjectIrr ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {summary.irrVariance >= 0 ? '+' : ''}
                {(summary.irrVariance * 100).toFixed(0)} bps vs Plan
              </div>
            </div>

            {/* Equity IRR */}
            <div className="bg-white border border-slate-300 rounded p-3 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Equity IRR (Sponsor)
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-base font-black text-blue-700">
                  {summary.actualEquityIrr.toFixed(2)}%
                </span>
                <span className="text-[11px] text-slate-400">Plan: {summary.planEquityIrr.toFixed(2)}%</span>
              </div>
              <div
                className={`text-[10px] font-bold mt-1 ${
                  summary.actualEquityIrr >= summary.planEquityIrr
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {summary.actualEquityIrr >= summary.planEquityIrr ? '✓ Outperforming' : '⚠️ Lower Yield'}
              </div>
            </div>

            {/* Capex Realization */}
            <div className="bg-white border border-slate-300 rounded p-3 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Total Actual CAPEX
              </div>
              <div className="text-base font-black text-slate-900 mt-1">
                {(summary.actualTotalCapex * mult).toFixed(1)} {unitLabel}
              </div>
              <div
                className={`text-[10px] font-bold mt-1 ${
                  summary.capexVariance <= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {summary.capexVariance <= 0 ? 'Savings: ' : 'Overrun: '}
                {(Math.abs(summary.capexVariance) * mult).toFixed(2)} ({summary.capexVariancePct >= 0 ? '+' : ''}
                {summary.capexVariancePct.toFixed(1)}%)
              </div>
            </div>

            {/* Delay COD */}
            <div className="bg-white border border-slate-300 rounded p-3 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                COD Schedule Variance
              </div>
              <div className="text-base font-black text-slate-900 mt-1">
                {summary.actualCodDelayMonths === 0 ? (
                  <span className="text-emerald-700">On Time</span>
                ) : (
                  <span className="text-rose-700">+{summary.actualCodDelayMonths} Months</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                FinMod Target: {assumptions.project.constructionPeriodMonths} Months
              </div>
            </div>

            {/* Min DSCR vs Covenant */}
            <div className="bg-white border border-slate-300 rounded p-3 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Min DSCR vs Covenant
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-base font-black ${
                    isCovenantPassed ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {summary.actualMinDscr.toFixed(2)}x
                </span>
                <span className="text-[11px] text-slate-400">Cov: {summary.covenantDscr.toFixed(2)}x</span>
              </div>
              <div
                className={`text-[10px] font-bold mt-1 ${
                  isCovenantPassed ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isCovenantPassed ? '✓ Covenant Terpenuhi' : '🚨 Breach of Covenant!'}
              </div>
            </div>

            {/* Cumulative 30-Yr Revenue */}
            <div className="bg-white border border-slate-300 rounded p-3 shadow-2xs">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                30-Year Actual Revenue
              </div>
              <div className="text-base font-black text-emerald-800 mt-1">
                {(summary.cumulativeActualRevenue * mult).toFixed(0)} {unitLabel}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {(
                  (summary.cumulativeActualRevenue / (summary.cumulativePlanRevenue || 1)) *
                  100
                ).toFixed(1)}
                % of FinMod Target
              </div>
            </div>
          </div>

          {/* Graphical Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 1: Capex Plan vs Actual per Package */}
            <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                <span>Construction Cost Comparison by Category ({unitLabel})</span>
                <span className="text-[10px] font-mono text-slate-400">Plan vs. Actual As-Built</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={capexChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} ${unitLabel}`, '']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="Plan" fill="#94A3B8" name="FinMod Budget Plan" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Actual" fill="#2563EB" name="Actual Cash Paid" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Annual DSCR Profile with Covenant Line */}
            <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                <span>Operating DSCR vs. Lender Covenant</span>
                <span className="text-[10px] font-mono text-slate-400">Years 1–15 (Loan Tenor)</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={annualChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0.8, 'auto']} />
                    <Tooltip
                      formatter={(val: any) => [`${val}x`, '']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '4px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <ReferenceLine
                      y={summary.covenantDscr}
                      stroke="#DC2626"
                      strokeDasharray="4 4"
                      label={{
                        value: `Covenant >= ${summary.covenantDscr.toFixed(2)}x`,
                        position: 'insideTopLeft',
                        fill: '#DC2626',
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Plan DSCR"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Actual DSCR"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Variance Driver Executive Table */}
          <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center font-bold text-xs uppercase tracking-wider">
              <span>FinMod vs. Actual Key Variance Bridge</span>
              <span className="font-mono text-emerald-400">Bankable Operating Status</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    1. Construction & EPC Contracts
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Total CAPEX variance of{' '}
                    <strong className={summary.capexVariance <= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {(summary.capexVariance * mult).toFixed(2)} {unitLabel}
                    </strong>{' '}
                    ({summary.capexVariancePct >= 0 ? '+' : ''}
                    {summary.capexVariancePct.toFixed(1)}%).
                    {summary.actualCodDelayMonths > 0
                      ? ` A COD delay of ${summary.actualCodDelayMonths} months increases interest during construction (IDC).`
                      : ' On-time completion with no additional IDC.'}
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    2. Hydrology & Electricity Generation
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Cumulative electricity generation reaches{' '}
                    <strong>{formatNumber(summary.cumulativeActualGenGWh, 0)} GWh</strong> vs target plan{' '}
                    {formatNumber(summary.cumulativePlanGenGWh, 0)} GWh (
                    {(
                      (summary.cumulativeActualGenGWh / (summary.cumulativePlanGenGWh || 1)) *
                      100
                    ).toFixed(1)}
                    %). River hydrology is the main driver of annual cash flow fluctuations.
                  </p>
                </div>

                <div className="border border-slate-200 rounded p-3 bg-slate-50">
                  <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    3. Debt Service & Sponsor Dividends
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Minimum actual DSCR is{' '}
                    <strong className={isCovenantPassed ? 'text-emerald-700' : 'text-rose-700'}>
                      {summary.actualMinDscr.toFixed(2)}x
                    </strong>{' '}
                    (covenant threshold {summary.covenantDscr.toFixed(2)}x).
                    {isCovenantPassed
                      ? ' Debt coverage is within the threshold; the legacy model indicates full sponsor dividend distribution.'
                      : ' Attention: the legacy model indicates a covenant breach and potential dividend retention (cash sweep / lock-up).'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CONSTRUCTION & EPC CONTRACTS (CAPEX) */}
      {activeSubTab === 'construction' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Procurement Contract & Project Cost Actuals (CAPEX)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Engineering/finance may edit yellow cells using signed contract values. Manual entries remain unverified.
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-slate-500 text-[11px]">Total Actual CAPEX: </span>
              <span className="font-bold text-blue-700 text-sm">
                {(summary.actualTotalCapex * mult).toFixed(2)} {unitLabel}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 text-left">Work Package / BoQ</th>
                  <th className="py-2.5 px-2 text-left">Contractor / Vendor</th>
                  <th className="py-2.5 px-2 text-right">FinMod Budget</th>
                  <th className="py-2.5 px-2 text-right text-amber-900">EPC Contract Value</th>
                  <th className="py-2.5 px-2 text-right text-blue-900">Actual Cash Paid</th>
                  <th className="py-2.5 px-2 text-right">Variance</th>
                  <th className="py-2.5 px-2 text-right">Variance (%)</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-left">Technical / Actuals Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {capexRealization.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition">
                      <td className="py-2 px-3 text-left font-sans font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-2 px-2 text-left font-sans">
                        <input
                          type="text"
                          value={item.contractorName || ''}
                          onChange={(e) =>
                            handleUpdateCapexItem(item.id, 'contractorName', e.target.value)
                          }
                          className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-[11px] text-slate-700 focus:outline-blue-500 bg-white"
                          placeholder="Contractor/vendor name..."
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-600">
                        {(item.planAmountIdrBillion * mult).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.1"
                          value={item.contractAwardedIdrBillion}
                          onChange={(e) =>
                            handleUpdateCapexItem(
                              item.id,
                              'contractAwardedIdrBillion',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 text-right px-1.5 py-0.5 rounded bg-amber-50/70 border border-amber-300 font-bold text-slate-900 focus:bg-white"
                          title="Agreed contract value (IDR Billion)"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.1"
                          value={item.actualIncurredIdrBillion}
                          onChange={(e) =>
                            handleUpdateCapexItem(
                              item.id,
                              'actualIncurredIdrBillion',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 text-right px-1.5 py-0.5 rounded bg-blue-50/70 border border-blue-300 font-bold text-blue-900 focus:bg-white"
                          title="Actual cash expenditure (IDR Billion)"
                        />
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-bold ${
                          item.varianceIdrBillion > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {item.varianceIdrBillion > 0 ? '+' : ''}
                        {(item.varianceIdrBillion * mult).toFixed(2)}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-bold ${
                          item.variancePct > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {item.variancePct > 0 ? '+' : ''}
                        {item.variancePct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        {item.status === 'OVERRUN' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Overrun
                          </span>
                        )}
                        {item.status === 'SAVINGS' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Savings
                          </span>
                        )}
                        {item.status === 'ON_TRACK' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            In Line with Plan
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-left font-sans">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => handleUpdateCapexItem(item.id, 'notes', e.target.value)}
                          className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-[11px] text-slate-600 focus:outline-blue-500 bg-white"
                          placeholder="Variance / site condition notes..."
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 font-mono">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 text-left font-sans uppercase">
                    Total Base Project CAPEX
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {(summary.planTotalCapex * mult).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-amber-900">
                    {(
                      capexRealization.reduce((s, i) => s + i.contractAwardedIdrBillion, 0) * mult
                    ).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-blue-900 text-sm font-black">
                    {(summary.actualTotalCapex * mult).toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-black ${
                      summary.capexVariance > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {summary.capexVariance > 0 ? '+' : ''}
                    {(summary.capexVariance * mult).toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-black ${
                      summary.capexVariancePct > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {summary.capexVariancePct > 0 ? '+' : ''}
                    {summary.capexVariancePct.toFixed(1)}%
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-center font-sans font-normal text-slate-500">
                    All variances feed the legacy actual IRR calculation
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: OPERATIONAL REALIZATION (COD TO PPA EXPIRY) */}
      {activeSubTab === 'operations' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                Operating Actuals Review: Generation GWh, PLN Tariff, OPEX & DSCR (Years 1–30)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enter metered kWh and PLN billing values to review legacy cash flow and lender ratios. Manual entries remain unverified.
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                DSCR Covenant Threshold: {summary.covenantDscr.toFixed(2)}x
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-xs font-mono text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2 text-center">Year</th>
                  <th className="py-2 px-2 text-left font-sans">Date</th>
                  <th className="py-2 px-2 text-slate-500">Plan GWh</th>
                  <th className="py-2 px-2 text-blue-900 bg-blue-50/50">Actual GWh</th>
                  <th className="py-2 px-2">Generation Achievement</th>
                  <th className="py-2 px-2 text-slate-500">Plan Tariff</th>
                  <th className="py-2 px-2 text-amber-900 bg-amber-50/50">Actual Tariff (IDR)</th>
                  <th className="py-2 px-2 text-slate-500">Plan Rev</th>
                  <th className="py-2 px-2 text-emerald-900 font-bold bg-emerald-50/50">Actual Rev</th>
                  <th className="py-2 px-2 text-slate-500">Plan OPEX</th>
                  <th className="py-2 px-2 text-rose-900 bg-rose-50/50">Actual OPEX</th>
                  <th className="py-2 px-2 font-black text-slate-900">Actual EBITDA</th>
                  <th className="py-2 px-2 text-slate-500">Plan DSCR</th>
                  <th className="py-2 px-2 font-black text-blue-900">Actual DSCR</th>
                  <th className="py-2 px-2 text-center font-sans">Covenant</th>
                  <th className="py-2 px-2 text-purple-900 font-bold">Sponsor Dividends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {annualRealization.map((row) => {
                  return (
                    <tr key={row.year} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-2 text-center font-bold text-slate-900">
                        Y{row.year}
                      </td>
                      <td className="py-2 px-2 text-left font-sans text-slate-500 text-[11px]">
                        {row.dateStr}
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {row.planNetGenGWh.toFixed(1)}
                      </td>
                      <td className="py-2 px-2 bg-blue-50/30">
                        <input
                          type="number"
                          step="0.5"
                          value={row.actualNetGenGWh}
                          onChange={(e) =>
                            handleUpdateOperatingRow(
                              row.year,
                              'actualNetGenGWh',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-18 text-right px-1 py-0.5 rounded bg-blue-50/80 border border-blue-300 font-bold text-blue-900"
                        />
                      </td>
                      <td
                        className={`py-2 px-2 font-bold ${
                          row.genRealizationPct >= 100 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {row.genRealizationPct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {row.planTariffIdr.toFixed(0)}
                      </td>
                      <td className="py-2 px-2 bg-amber-50/30">
                        <input
                          type="number"
                          step="10"
                          value={row.actualTariffIdr}
                          onChange={(e) =>
                            handleUpdateOperatingRow(
                              row.year,
                              'actualTariffIdr',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-18 text-right px-1 py-0.5 rounded bg-amber-50/80 border border-amber-300 font-bold text-amber-900"
                        />
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {(row.planRevenueIdrB * mult).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 font-bold text-emerald-900 bg-emerald-50/30">
                        {(row.actualRevenueIdrB * mult).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {(row.planOpexIdrB * mult).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 bg-rose-50/30">
                        <input
                          type="number"
                          step="0.1"
                          value={row.actualOpexIdrB}
                          onChange={(e) =>
                            handleUpdateOperatingRow(
                              row.year,
                              'actualOpexIdrB',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-16 text-right px-1 py-0.5 rounded bg-rose-50/80 border border-rose-300 font-bold text-rose-900"
                        />
                      </td>
                      <td className="py-2 px-2 font-black text-slate-900">
                        {(row.actualEbitdaIdrB * mult).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {row.planDscr ? `${row.planDscr.toFixed(2)}x` : '-'}
                      </td>
                      <td
                        className={`py-2 px-2 font-black ${
                          row.actualDscr === null
                            ? 'text-slate-400'
                            : row.isCovenantMet
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {row.actualDscr ? `${row.actualDscr.toFixed(2)}x` : '-'}
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        {row.actualDscr === null ? (
                          <span className="text-slate-400 text-[10px]">No Debt</span>
                        ) : row.isCovenantMet ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            Pass
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                            Breach
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 font-bold text-purple-900">
                        {(row.actualDividendsIdrB * mult).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 font-mono">
                <tr>
                  <td colSpan={2} className="py-2.5 px-2 text-left font-sans uppercase">
                    30-Year Cumulative Total
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">
                    {formatNumber(summary.cumulativePlanGenGWh, 1)}
                  </td>
                  <td className="py-2.5 px-2 text-blue-900 font-black">
                    {formatNumber(summary.cumulativeActualGenGWh, 1)}
                  </td>
                  <td className="py-2.5 px-2">
                    {(
                      (summary.cumulativeActualGenGWh / (summary.cumulativePlanGenGWh || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </td>
                  <td colSpan={2} className="py-2.5 px-2 text-center text-slate-400">
                    -
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">
                    {(summary.cumulativePlanRevenue * mult).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-emerald-900 font-black">
                    {(summary.cumulativeActualRevenue * mult).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">
                    {(annualRealization.reduce((s, r) => s + r.planOpexIdrB, 0) * mult).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-rose-900 font-bold">
                    {(annualRealization.reduce((s, r) => s + r.actualOpexIdrB, 0) * mult).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-slate-900 font-black">
                    {(summary.cumulativeActualEbitda * mult).toFixed(1)}
                  </td>
                  <td colSpan={3} className="py-2.5 px-2 text-center font-sans text-emerald-700 font-bold">
                    Min DSCR: {summary.actualMinDscr.toFixed(2)}x
                  </td>
                  <td className="py-2.5 px-2 text-purple-900 font-black">
                    {(annualRealization.reduce((s, r) => s + r.actualDividendsIdrB, 0) * mult).toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

