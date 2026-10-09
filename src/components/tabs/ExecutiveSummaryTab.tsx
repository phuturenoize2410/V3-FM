import type { NavigateToTab } from '../../application/navigation';
import React from 'react';
import {
  FullModelAssumptions,
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
  Zap,
  TrendingUp,
  Shield,
  Clock,
  ArrowUpRight,
  Sparkles,
  PieChart as PieIcon,
  Award,
  GitCompare,
} from 'lucide-react';
import { TECHNOLOGY_REGISTRY } from '../../calculations/defaultAssumptions';

interface ExecutiveSummaryTabProps {
  assumptions: FullModelAssumptions;
  metrics: ModelMetrics;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
  onSelectTab: NavigateToTab;
}

export const ExecutiveSummaryTab: React.FC<ExecutiveSummaryTabProps> = ({
  assumptions,
  metrics,
  sourcesAndUses,
  currencyDisplay,
  onOpenAuditTrace,
  onSelectTab,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const currentTech = assumptions.project.technology || 'hydro';
  const currentTechMeta = TECHNOLOGY_REGISTRY[currentTech] || TECHNOLOGY_REGISTRY.hydro;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Project Overview Hero Banner */}
      <div className="bg-[#0F172A] text-white rounded-lg p-6 shadow-xs border border-[#334155]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-sky-500/20 text-sky-300 border border-sky-500/40 uppercase tracking-wider flex items-center gap-1">
                <span>{currentTechMeta.icon}</span>
                <span>{currentTechMeta.label}</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-wider">
                Bankable Feasibility Study (BFS)
              </span>
              <span className="text-xs text-slate-400 font-mono">
                COD: {assumptions.project.codDate} • {assumptions.project.operatingPeriodYears} Years PPA
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight uppercase text-white">
              {assumptions.project.projectName}
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">
              {currentTechMeta.shortDesc}. High-efficiency commercial energy generation under long-term Power Purchase Agreement with PT PLN (Persero).
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <button
              data-nav-tab={'02_assumptions'}
              onClick={() => onSelectTab('02_assumptions')}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold transition uppercase tracking-wider text-[11px]"
            >
              Edit Assumptions
            </button>
            <button
              data-nav-tab={'00_driver_cockpit'}
              onClick={() => onSelectTab('00_driver_cockpit')}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs transition uppercase tracking-wider text-[11px]"
            >
              Open Dashboard
            </button>
            <button
              data-nav-tab={'31_plan_vs_actual'}
              onClick={() => onSelectTab('31_plan_vs_actual')}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs transition uppercase tracking-wider text-[11px] flex items-center gap-1.5"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Plan vs. Actual Review
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main Pillar Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Project Engineering & Generation */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Technical & Capacity
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Installed Capacity:</span>
              <span className="font-semibold text-slate-900">{assumptions.project.installedCapacityMW} MW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Turbine Units:</span>
              <span className="font-semibold text-slate-900">{assumptions.project.numberOfUnits} Units (Francis)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Capacity Factor (CF):</span>
              <span className="font-semibold text-slate-900">{assumptions.operating.capacityFactorPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Plant Availability:</span>
              <span className="font-semibold text-slate-900">{assumptions.operating.plantAvailabilityPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transmission Loss:</span>
              <span className="font-semibold text-slate-900">{assumptions.operating.transmissionLossPct}%</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
              <span>Avg Annual Generation:</span>
              <span className="text-blue-600">{formatNumber(metrics.averageAnnualGenerationGWh, 2)} GWh/yr</span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Capital Structure & Funding */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Capital Structure
            </span>
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Project Cost:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyValue(sourcesAndUses.totalUses, currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Senior Bank Debt ({assumptions.funding.bankDebtPct}%):</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyValue(sourcesAndUses.bankLoanAmount, currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sponsor Equity ({assumptions.funding.equityPct}%):</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyValue(sourcesAndUses.equityAmount, currencyDisplay, fx, 2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Interest Rate:</span>
              <span className="font-semibold text-slate-900">{assumptions.funding.bankInterestRatePct}% p.a.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Loan Tenor:</span>
              <span className="font-semibold text-slate-900">{assumptions.funding.repaymentPeriodYears} Years</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
              <span>IDC Treatment:</span>
              <span className="text-emerald-700 uppercase">{assumptions.funding.idcMode} IDC</span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Valuation & Returns */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Valuation & Returns
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Project IRR (Unlevered):</span>
              <button
                data-audit-key="project_irr"
                onClick={() => onOpenAuditTrace('project_irr')}
                className="font-bold text-slate-900 hover:text-blue-600"
              >
                {formatPercent(metrics.projectIrrPct, 2)}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Equity IRR (Levered):</span>
              <button
                data-audit-key="equity_irr"
                onClick={() => onOpenAuditTrace('equity_irr')}
                className="font-bold text-emerald-600 text-sm hover:underline"
              >
                {formatPercent(metrics.equityIrrPct, 2)}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">WACC:</span>
              <span className="font-semibold text-slate-900">{formatPercent(metrics.waccPct, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Project NPV:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyValue(metrics.projectNpvIdrBillion, currencyDisplay, fx, 1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Equity NPV:</span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyValue(metrics.equityNpvIdrBillion, currencyDisplay, fx, 1)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
              <span>Equity Payback:</span>
              <span className="text-slate-800">{metrics.equityPaybackPeriodYears.toFixed(1)} Years</span>
            </div>
          </div>
        </div>

        {/* Pillar 4: Debt Coverage & Credit Metrics */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Credit Metrics
            </span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Minimum DSCR:</span>
              <button
                data-audit-key="min_dscr"
                onClick={() => onOpenAuditTrace('min_dscr')}
                className={`font-bold px-2 py-0.5 rounded text-xs ${
                  metrics.minDscr >= 1.2
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {formatMultiple(metrics.minDscr, 2)}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Average DSCR:</span>
              <span className="font-semibold text-slate-900">{formatMultiple(metrics.avgDscr, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Covenant Threshold:</span>
              <span className="font-semibold text-slate-600">1.20x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Minimum LLCR:</span>
              <button
                data-audit-key="llcr"
                onClick={() => onOpenAuditTrace('llcr')}
                className="font-semibold text-slate-900 hover:text-blue-600"
              >
                {formatMultiple(metrics.minLlcr, 2)}
              </button>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">DSRA Covenant:</span>
              <span className="font-semibold text-slate-900">{assumptions.funding.dsraRequirementMonths} Months Forward DS</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
              <span>LCOE:</span>
              <span className="text-amber-600">{metrics.lcoeCentsPerKWh.toFixed(2)} ¢/kWh</span>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Consortium Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Consortium Ownership</h3>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>EPN Sponsor Participation</span>
                <span className="text-blue-600">{assumptions.project.epnParticipationPct}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{ width: `${assumptions.project.epnParticipationPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Equity Share: {formatCurrencyValue(sourcesAndUses.equityAmount * (assumptions.project.epnParticipationPct / 100), currencyDisplay, fx, 2)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Other Consortium Partners</span>
                <span className="text-emerald-600">{assumptions.project.otherSponsorParticipationPct}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${assumptions.project.otherSponsorParticipationPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Equity Share: {formatCurrencyValue(sourcesAndUses.equityAmount * (assumptions.project.otherSponsorParticipationPct / 100), currencyDisplay, fx, 2)}
              </div>
            </div>
          </div>
        </div>

        {/* Sources & Uses Snapshot */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Sources & Uses Reconciliation</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
              0.00 Variance
            </span>
          </div>
          <table className="w-full text-xs font-mono border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="text-left py-1.5 px-2.5">Component</th>
                <th className="text-right py-1.5 px-2.5">IDR Billion</th>
                <th className="text-right py-1.5 px-2.5">% Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-1.5 px-2.5 text-slate-700">Senior Bank Debt</td>
                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">{sourcesAndUses.bankLoanAmount.toFixed(2)}</td>
                <td className="py-1.5 px-2.5 text-right text-slate-500">{((sourcesAndUses.bankLoanAmount / sourcesAndUses.totalUses) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-1.5 px-2.5 text-slate-700">Sponsor Paid-in Equity</td>
                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">{sourcesAndUses.equityAmount.toFixed(2)}</td>
                <td className="py-1.5 px-2.5 text-right text-slate-500">{((sourcesAndUses.equityAmount / sourcesAndUses.totalUses) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-slate-50 font-bold border-t border-slate-200">
                <td className="py-1.5 px-2.5 text-slate-900">Total Sources</td>
                <td className="py-1.5 px-2.5 text-right font-black text-blue-600">{sourcesAndUses.totalSources.toFixed(2)}</td>
                <td className="py-1.5 px-2.5 text-right">100.0%</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-1.5 px-2.5 text-slate-700">Base Project CAPEX</td>
                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">{sourcesAndUses.baseCapexTotal.toFixed(2)}</td>
                <td className="py-1.5 px-2.5 text-right text-slate-500">{((sourcesAndUses.baseCapexTotal / sourcesAndUses.totalUses) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="py-1.5 px-2.5 text-slate-700">Financing Fees & IDC</td>
                <td className="py-1.5 px-2.5 text-right font-bold text-slate-900">{(sourcesAndUses.financingFees + sourcesAndUses.idcTotal).toFixed(2)}</td>
                <td className="py-1.5 px-2.5 text-right text-slate-500">{(((sourcesAndUses.financingFees + sourcesAndUses.idcTotal) / sourcesAndUses.totalUses) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-blue-50/80 font-bold border-t-2 border-slate-300 text-blue-950">
                <td className="py-1.5 px-2.5">Total Uses</td>
                <td className="py-1.5 px-2.5 text-right font-black">{sourcesAndUses.totalUses.toFixed(2)}</td>
                <td className="py-1.5 px-2.5 text-right">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Key Model Operating Metrics */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Operating Economics</h3>
            <span className="text-xs text-slate-400">P50 Base Case</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Base Electricity Tariff:</span>
              <span className="font-semibold text-slate-900">
                {assumptions.revenue.baseTariffIdrPerKWh.toLocaleString()} IDR/kWh (~{(assumptions.revenue.baseTariffIdrPerKWh / fx * 100).toFixed(2)} cUSD/kWh)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Tariff Escalation:</span>
              <span className="font-semibold text-slate-900">{assumptions.revenue.annualTariffEscalationPct}% p.a.</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Avg Annual Revenue:</span>
              <span className="font-semibold text-slate-900">{formatCurrencyValue(metrics.averageAnnualRevenueIdrBillion, currencyDisplay, fx, 2)}/yr</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Avg Operating EBITDA:</span>
              <span className="font-semibold text-slate-900">{formatCurrencyValue(metrics.averageAnnualEbitdaIdrBillion, currencyDisplay, fx, 2)}/yr</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">EBITDA Margin:</span>
              <span className="font-bold text-emerald-600">{metrics.averageEbitdaMarginPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Corporate Income Tax Rate:</span>
              <span className="font-semibold text-slate-900">{assumptions.tax.corporateIncomeTaxRatePct}% (PPh Badan)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
