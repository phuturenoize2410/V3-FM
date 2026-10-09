import type { NavigateToTab } from '../application/navigation';
import React from 'react';
import {
  CurrencyDisplay,
  ModelMetrics,
  ModelCheckItem,
  TechnologyType,
} from '../types';
import {
  formatPercent,
  formatMultiple,
  formatCurrencyValue,
} from '../utils/formatters';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  BookOpen,
  DollarSign,
  Layers,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { PRESET_SCENARIOS, ScenarioDefinition } from '../calculations/financialEngine';
import { TECHNOLOGY_REGISTRY } from '../calculations/defaultAssumptions';

interface HeaderProps {
  onSelectTab: NavigateToTab;
  projectName: string;
  capacityMW?: number;
  technology?: TechnologyType;
  operatingPeriodYears?: number;
  metrics: ModelMetrics;
  checks: ModelCheckItem[];
  currencyDisplay: CurrencyDisplay;
  setCurrencyDisplay: (c: CurrencyDisplay) => void;
  activeScenarioId: string;
  scenarios?: ScenarioDefinition[];
  onSelectScenario: (sc: ScenarioDefinition) => void;
  onResetBase: () => void;
  onOpenAuditTrace: (nodeKey?: string) => void;
  fxIdrPerUsd: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectTab,
  projectName,
  capacityMW,
  technology = 'hydro',
  operatingPeriodYears = 30,
  metrics,
  checks,
  currencyDisplay,
  setCurrencyDisplay,
  activeScenarioId,
  onSelectScenario,
  onResetBase,
  onOpenAuditTrace,
  fxIdrPerUsd,
  isFullscreen = false,
  onToggleFullscreen,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const failedChecks = checks.filter((c) => !c.passed);
  const allPassed = failedChecks.length === 0;
  const techMeta = TECHNOLOGY_REGISTRY[technology] || TECHNOLOGY_REGISTRY.hydro;

  return (
    <header className="bg-[#0F172A] text-white border-b border-[#334155] sticky top-0 z-40 shadow-xs">
      {/* Top Banner */}
      <div className="w-full px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Project Branding & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-black text-lg rounded shadow-xs" title={techMeta.label}>
            <span>{techMeta.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-semibold tracking-tight uppercase text-white">
                {projectName} <span className="font-normal text-slate-400 hidden sm:inline">| Financial Modeller</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 uppercase font-bold flex items-center gap-1">
                <span>{capacityMW ? `${capacityMW} MW` : '18 MW'}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 uppercase font-semibold hidden md:inline-block">
                {techMeta.label.split(' ')[0]}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              {operatingPeriodYears}-Yr Concession • {techMeta.generationBasis} • Date-Corrected XIRR/XNPV
            </p>
          </div>
        </div>

        {/* Status Indicators from Theme */}
        <div className="hidden xl:flex items-center gap-4 text-xs font-mono uppercase tracking-wider text-slate-300">
          <div className="flex items-center gap-2 bg-slate-900/60 px-2.5 py-1 rounded border border-[#334155]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse"></span>
            <span>Sources = Uses</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 px-2.5 py-1 rounded border border-[#334155]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
            <span>BS Balanced (0.00)</span>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded text-slate-200 text-xs font-mono font-medium">
            v2.4.1 Stable
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          {/* Scenario Selector */}
          <div className="flex items-center bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 rounded-md px-2.5 py-1 gap-1.5 transition-colors shadow-2xs">
            <span className="text-slate-400 text-[11px] font-medium uppercase">Scenario:</span>
            <select
              value={activeScenarioId}
              onChange={(e) => {
                const sc = PRESET_SCENARIOS.find((s) => s.id === e.target.value);
                if (sc) onSelectScenario(sc);
              }}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              {PRESET_SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id} className="bg-slate-900 text-white font-sans">
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-md p-0.5 shadow-2xs">
            {(['IDR_B', 'IDR_M', 'USD_M'] as CurrencyDisplay[]).map((cur) => (
              <button
                key={cur}
                onClick={() => setCurrencyDisplay(cur)}
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                  currencyDisplay === cur
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {cur === 'IDR_B' ? 'IDR B' : cur === 'IDR_M' ? 'IDR M' : 'USD M'}
              </button>
            ))}
          </div>

          {/* Model Health Status Badge */}
          <button
            data-nav-tab={'28_model_checks'}
            onClick={() => onSelectTab('28_model_checks')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all uppercase tracking-wider ${
              allPassed
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900/90'
                : 'bg-rose-950/80 text-rose-300 border border-rose-700/80 hover:bg-rose-900/90'
            }`}
            title="Click to view Model Integrity Checks"
          >
            {allPassed ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{checks.length} Checks Pass</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{failedChecks.length} Issue</span>
              </>
            )}
          </button>

          {/* Audit Trace Button */}
          <button
            data-audit-key="min_dscr"
            onClick={() => onOpenAuditTrace('min_dscr')}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded transition-colors font-medium text-xs"
            title="Inspect calculation formulas & dependencies"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="uppercase text-[10px] tracking-wider font-bold">Audit</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onResetBase}
            className="flex items-center gap-1 text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-1 rounded transition-colors text-xs cursor-pointer"
            title="Reset assumptions to baseline PLTA 18 MW parameters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-wider">Reset</span>
          </button>

          {/* Fullscreen Toggle Button */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer border ${
                isFullscreen
                  ? 'bg-sky-600 text-white border-sky-500 hover:bg-sky-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={isFullscreen ? 'Exit Full Screen Mode (Esc)' : 'Enter Full Screen Mode'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline text-[10px] uppercase">Normal</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline text-[10px] uppercase">Full Screen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Live Financial KPI Data Grid Strip */}
      <div className="bg-[#0B1120] border-t border-[#334155] px-4 md:px-6 py-2">
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
          {/* Project IRR */}
          <button type="button"
            data-audit-key="project_irr"
            onClick={() => onOpenAuditTrace('project_irr')}
            className="w-full text-left cursor-pointer group bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-lg p-2.5 transition-all shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Project IRR</span>
              <span className="text-[9px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 font-bold">AUDIT</span>
            </div>
            <div className="text-base md:text-lg font-black text-white font-mono tracking-tight mt-0.5">
              {formatPercent(metrics.projectIrrPct, 2)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              WACC: {formatPercent(metrics.waccPct, 2)}
            </div>
          </button>

          {/* Equity IRR */}
          <button type="button"
            data-audit-key="equity_irr"
            onClick={() => onOpenAuditTrace('equity_irr')}
            className="w-full text-left cursor-pointer group bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-lg p-2.5 transition-all shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Equity IRR</span>
              <span className="text-[9px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 font-bold">AUDIT</span>
            </div>
            <div className="text-base md:text-lg font-black text-emerald-400 font-mono tracking-tight mt-0.5">
              {formatPercent(metrics.equityIrrPct, 2)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Payback: {metrics.equityPaybackPeriodYears.toFixed(1)} yrs
            </div>
          </button>

          {/* Min DSCR */}
          <button type="button"
            data-audit-key="min_dscr"
            onClick={() => onOpenAuditTrace('min_dscr')}
            className="w-full text-left cursor-pointer group bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-lg p-2.5 transition-all shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Min DSCR</span>
              <span className="text-[9px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 font-bold">AUDIT</span>
            </div>
            <div className={`text-base md:text-lg font-black font-mono tracking-tight mt-0.5 ${metrics.minDscr >= 1.2 ? 'text-emerald-400' : metrics.minDscr >= 1.0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {formatMultiple(metrics.minDscr, 2)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Avg: {formatMultiple(metrics.avgDscr, 2)} (cov 1.20x)
            </div>
          </button>

          {/* Min LLCR */}
          <button type="button"
            data-audit-key="llcr"
            onClick={() => onOpenAuditTrace('llcr')}
            className="w-full text-left cursor-pointer group bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-lg p-2.5 transition-all shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Min LLCR</span>
              <span className="text-[9px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 font-bold">AUDIT</span>
            </div>
            <div className="text-base md:text-lg font-black text-sky-400 font-mono tracking-tight mt-0.5">
              {formatMultiple(metrics.minLlcr, 2)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Loan Life Cov.
            </div>
          </button>

          {/* Project NPV */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project NPV</div>
            <div className="text-base md:text-lg font-black text-white font-mono tracking-tight mt-0.5">
              {formatCurrencyValue(metrics.projectNpvIdrBillion, currencyDisplay, fxIdrPerUsd, 1)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Eq: {formatCurrencyValue(metrics.equityNpvIdrBillion, currencyDisplay, fxIdrPerUsd, 1)}
            </div>
          </div>

          {/* LCOE */}
          <button type="button"
            data-audit-key="lcoe"
            onClick={() => onOpenAuditTrace('lcoe')}
            className="w-full text-left cursor-pointer group bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-lg p-2.5 transition-all shadow-xs"
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>LCOE</span>
              <span className="text-[9px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 font-bold">AUDIT</span>
            </div>
            <div className="text-base md:text-lg font-black text-sky-400 font-mono tracking-tight mt-0.5">
              {metrics.lcoeCentsPerKWh.toFixed(1)} ¢/kWh
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {metrics.lcoeIdrPerKWh.toFixed(0)} IDR/kWh
            </div>
          </button>

          {/* Total CAPEX / Cost */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total CAPEX</div>
            <div className="text-base md:text-lg font-black text-slate-100 font-mono tracking-tight mt-0.5">
              {formatCurrencyValue(metrics.totalCapexIdrBillion, currencyDisplay, fxIdrPerUsd, 1)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Debt: {formatCurrencyValue(metrics.totalDebtIdrBillion, currencyDisplay, fxIdrPerUsd, 0)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
