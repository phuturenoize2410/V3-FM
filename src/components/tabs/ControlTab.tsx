import type { NavigateToTab } from '../../application/navigation';
import React from 'react';
import {
  FullModelAssumptions,
  CurrencyDisplay,
  ModelMetrics,
  ModelCheckItem,
  SourcesAndUses,
  AnnualOperatingRow,
  TabId,
} from '../../types';
import {
  Settings,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Shield,
  Layers,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Search,
} from 'lucide-react';
import { PRESET_SCENARIOS, ScenarioDefinition } from '../../calculations/financialEngine';

interface ControlTabProps {
  assumptions: FullModelAssumptions;
  metrics: ModelMetrics;
  checks: ModelCheckItem[];
  sourcesAndUses: SourcesAndUses;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  setCurrencyDisplay: (c: CurrencyDisplay) => void;
  activeScenarioId: string;
  onSelectScenario: (sc: ScenarioDefinition) => void;
  onResetBase: () => void;
  onSelectTab: NavigateToTab;
  onOpenAuditTrace: (nodeKey: string) => void;
}

export const ControlTab: React.FC<ControlTabProps> = ({
  assumptions,
  metrics,
  checks,
  sourcesAndUses,
  currencyDisplay,
  setCurrencyDisplay,
  activeScenarioId,
  onSelectScenario,
  onResetBase,
  onSelectTab,
  onOpenAuditTrace,
}) => {
  const failedChecks = checks.filter((c) => !c.passed);
  const passedChecks = checks.filter((c) => c.passed);

  return (
    <div className="space-y-4 text-xs">
      {/* Module Title Banner */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
            01
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">
              Model Master Control & Execution Engine
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              PLTA BATANG TORU 18 MW | Run-of-River Hydro Project Finance Model v4.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetBase}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium border border-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset to Base Defaults
          </button>
          <button
            data-nav-tab={'28_model_checks'}
            onClick={() => onSelectTab('28_model_checks')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-colors cursor-pointer ${
              failedChecks.length === 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                : 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse'
            }`}
          >
            {failedChecks.length === 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span>
              {passedChecks.length}/{checks.length} CHECKS {failedChecks.length === 0 ? 'PASSED' : 'FAILED'}
            </span>
          </button>
        </div>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Scenario & Global Parameters */}
        <div className="space-y-4 lg:col-span-2">
          {/* Active Scenario Selection Panel */}
          <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-blue-600" />
                Active Model Scenario Selector
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Single-Click Instant Deterministic Recalculation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((sc) => {
                const isSelected = activeScenarioId === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => onSelectScenario(sc)}
                    className={`text-left p-2.5 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold text-xs ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                        {sc.name}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                      {sc.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency and Unit Settings */}
          <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-slate-600" />
                Reporting Units & Currency Mode
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                FX Assumption: 1 USD = {assumptions.revenue.fxIdrPerUsd.toLocaleString()} IDR
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'IDR_B', label: 'IDR Billion', desc: 'Default Institutional' },
                  { id: 'IDR_M', label: 'IDR Million', desc: 'Detailed Line Items' },
                  { id: 'USD_M', label: 'USD Million', desc: 'International Lenders' },
                  { id: 'USD_K', label: 'USD Thousand', desc: 'Fine Granularity' },
                ] as const
              ).map((cur) => {
                const isActive = currencyDisplay === cur.id;
                return (
                  <button
                    key={cur.id}
                    onClick={() => setCurrencyDisplay(cur.id)}
                    className={`p-2 rounded border text-left cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="font-mono font-bold text-[11px]">{cur.label}</div>
                    <div className={`text-[9px] ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                      {cur.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Module Navigation Matrix */}
          <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
            <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2.5 pb-1.5 border-b border-slate-200">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              Core Architecture Directory
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { id: '02_assumptions', label: '02. Project Assumptions', group: 'Inputs' },
                { id: '04_capex', label: '04. CAPEX S-Curve', group: 'Construction' },
                { id: '05_sources_uses', label: '05. Sources & Uses', group: 'Financing' },
                { id: '06_funding', label: '06. Drawdown Sequencing', group: 'Financing' },
                { id: '07_debt', label: '07. Senior Loan Schedule', group: 'Debt' },
                { id: '08_idc', label: '08. IDC Engine', group: 'Debt' },
                { id: '09_revenue', label: '09. PPA Revenue', group: 'Operations' },
                { id: '10_opex', label: '10. OPEX Budget', group: 'Operations' },
                { id: '14_income_statement', label: '14. Income Statement', group: 'Statements' },
                { id: '15_balance_sheet', label: '15. Balance Sheet', group: 'Statements' },
                { id: '16_cash_flow', label: '16. Cash Flow Statement', group: 'Statements' },
                { id: '18_dscr', label: '18. DSCR Covenants', group: 'Credit' },
                { id: '19_dsra', label: '19. DSRA Reserve Account', group: 'Credit' },
                { id: '21_project_cashflow', label: '21. Project FCFF & IRR', group: 'Returns' },
                { id: '22_equity_cashflow', label: '22. Equity FCFE & IRR', group: 'Returns' },
                { id: '24_lcoe', label: '24. LCOE Benchmark', group: 'Economics' },
                { id: '28_model_checks', label: '28. Master Model Checks', group: 'Audit' },
                { id: '29_reconciliation', label: '29. Model Reconciliation', group: 'Audit' },
              ] satisfies { id: TabId; label: string; group: string }[]).map((item) => (
                <button
                  key={item.id}
                  data-nav-tab={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className="p-1.5 px-2 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded flex items-center justify-between text-left cursor-pointer transition-colors group"
                >
                  <span className="font-mono text-[11px] text-slate-700 group-hover:text-blue-700 font-medium truncate">
                    {item.label}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Model Integrity & Key Output Snapshot */}
        <div className="space-y-4">
          {/* Integrity Status Card */}
          <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-700" />
                Master Model Integrity Checks
              </span>
              <span className="font-mono text-[10px] text-slate-400">Tolerance: 0.001</span>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-slate-200 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Compliance Rate:</span>
                <span className="font-mono font-bold text-emerald-700 text-xs">
                  {((passedChecks.length / checks.length) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(passedChecks.length / checks.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {checks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-start justify-between p-1.5 rounded bg-slate-50 border border-slate-200 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 truncate mr-1">
                    {chk.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span className="truncate text-slate-700 font-medium">{chk.name}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-1 py-0.2 rounded shrink-0 font-bold ${
                      chk.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {chk.passed ? 'OK' : 'ERR'}
                  </span>
                </div>
              ))}
            </div>

            <button
              data-nav-tab={'28_model_checks'}
              onClick={() => onSelectTab('28_model_checks')}
              className="w-full mt-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              View Full Master Checks Sheet
            </button>
          </div>

          {/* Quick Metrics Flash Card */}
          <div className="bg-white border border-slate-300 rounded shadow-xs p-3.5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <span className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-slate-700" />
                Live Financial Metrics
              </span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Synchronized
              </span>
            </div>

            <div className="space-y-2 font-mono">
              <button type="button"
                data-audit-key="project_irr"
                onClick={() => onOpenAuditTrace('project_irr')}
                className="w-full text-left p-2 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-sans">Project IRR (Unlevered)</div>
                  <div className="font-bold text-sm text-slate-900">
                    {metrics.projectIrrPct.toFixed(2)}%
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 underline">Trace</span>
              </button>

              <button type="button"
                data-audit-key="equity_irr"
                onClick={() => onOpenAuditTrace('equity_irr')}
                className="w-full text-left p-2 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-sans">Equity IRR (Levered)</div>
                  <div className="font-bold text-sm text-slate-900">
                    {metrics.equityIrrPct.toFixed(2)}%
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 underline">Trace</span>
              </button>

              <button type="button"
                data-audit-key="min_dscr"
                onClick={() => onOpenAuditTrace('min_dscr')}
                className="w-full text-left p-2 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-sans">Min DSCR (Covenant: 1.20x)</div>
                  <div
                    className={`font-bold text-sm ${
                      metrics.minDscr >= 1.2 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {metrics.minDscr.toFixed(2)}x
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 underline">Trace</span>
              </button>

              <button type="button"
                data-audit-key="lcoe"
                onClick={() => onOpenAuditTrace('lcoe')}
                className="w-full text-left p-2 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div>
                  <div className="text-[10px] text-slate-500 font-sans">Levelized Cost (LCOE)</div>
                  <div className="font-bold text-sm text-slate-900">
                    {metrics.lcoeCentsPerKWh.toFixed(2)} cUSD/kWh
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 underline">Trace</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
