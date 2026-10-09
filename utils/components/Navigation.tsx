import type { NavigateToTab } from '../application/navigation';
import React, { useState } from 'react';
import { TabId } from '../types';
import {
  Sliders,
  Calendar,
  Hammer,
  DollarSign,
  Shield,
  Zap,
  Briefcase,
  TrendingDown,
  Receipt,
  FileSpreadsheet,
  Columns,
  ArrowDownUp,
  Activity,
  Users,
  Gauge,
  PieChart,
  SlidersHorizontal,
  FolderSync,
  CheckSquare,
  Search,
  Settings,
  Layers,
  Clock,
  Building,
  FileText,
  Lock,
  Scale,
  GitCompare,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export type { TabId };

export interface NavGroup {
  name: string;
  tabs: {
    id: TabId;
    code: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    name: 'Flagship & Cockpit',
    tabs: [
      { id: '00_driver_cockpit', code: '00', label: 'Master Driver Cockpit', icon: SlidersHorizontal },
      { id: '01_control', code: '01', label: 'Model Control', icon: Settings },
      { id: '02_assumptions', code: '02', label: 'Assumptions Matrix', icon: Sliders },
      { id: '03_timeline', code: '03', label: 'Timeline & Phasing', icon: Calendar },
      { id: '27_executive_summary', code: '27', label: 'Executive Summary', icon: FileText },
      { id: '31_plan_vs_actual', code: '31', label: 'Plan vs. Actual Review', icon: GitCompare, badge: 'ACTUAL' },
    ],
  },
  {
    name: 'Construction & Funding',
    tabs: [
      { id: '04_capex', code: '04', label: 'CAPEX S-Curve', icon: Hammer },
      { id: '05_sources_uses', code: '05', label: 'Sources & Uses', icon: DollarSign },
      { id: '06_funding', code: '06', label: 'Funding Sequencing', icon: Layers },
    ],
  },
  {
    name: 'Senior Debt & Credit',
    tabs: [
      { id: '07_debt', code: '07', label: 'Senior Loan Facility', icon: Shield },
      { id: '08_idc', code: '08', label: 'IDC Engine', icon: Clock },
      { id: '17_cfads', code: '17', label: 'CFADS Waterfall', icon: Activity },
      { id: '18_dscr', code: '18', label: 'DSCR Covenants', icon: Gauge },
      { id: '19_dsra', code: '19', label: 'DSRA Reserve', icon: Lock },
      { id: '20_llcr', code: '20', label: 'LLCR Coverage', icon: Scale },
    ],
  },
  {
    name: 'Operations & Plant Economics',
    tabs: [
      { id: '09_revenue', code: '09', label: 'Generation & PPA', icon: Zap },
      { id: '10_opex', code: '10', label: 'OPEX Budget', icon: Briefcase },
      { id: '11_fixed_assets', code: '11', label: 'Fixed Assets (PPE)', icon: Building },
      { id: '12_depreciation', code: '12', label: 'Tax & Book Depr.', icon: TrendingDown },
      { id: '13_tax', code: '13', label: 'Corporate Tax', icon: Receipt },
    ],
  },
  {
    name: 'Financial Statements',
    tabs: [
      { id: '14_income_statement', code: '14', label: 'Income Statement', icon: FileSpreadsheet },
      { id: '15_balance_sheet', code: '15', label: 'Balance Sheet', icon: Columns },
      { id: '16_cash_flow', code: '16', label: 'Cash Flow Statement', icon: ArrowDownUp },
    ],
  },
  {
    name: 'Returns & Valuation',
    tabs: [
      { id: '21_project_cashflow', code: '21', label: 'Project FCFF & IRR', icon: Activity },
      { id: '22_equity_cashflow', code: '22', label: 'Equity FCFE & IRR', icon: Users },
      { id: '23_valuation', code: '23', label: 'DCF Valuation', icon: PieChart },
      { id: '24_lcoe', code: '24', label: 'Levelized LCOE', icon: Zap },
    ],
  },
  {
    name: 'Risk & Audit Trail',
    tabs: [
      { id: '25_sensitivity', code: '25', label: 'Sensitivity Matrix', icon: SlidersHorizontal },
      { id: '26_scenarios', code: '26', label: 'Scenario Testing', icon: FolderSync },
      { id: '28_model_checks', code: '28', label: 'Master Model Checks', icon: CheckSquare },
      { id: '29_reconciliation', code: '29', label: 'Reconciliation', icon: GitCompare },
      { id: '30_audit_trail', code: '30', label: 'Formula Audit Trail', icon: Search },
    ],
  },
];

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: NavigateToTab;
  failedCheckCount: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  failedCheckCount,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const filteredGroups = NAV_GROUPS.map((group) => {
    const matchingTabs = group.tabs.filter(
      (tab) =>
        tab.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tab.code.includes(searchTerm) ||
        tab.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return { ...group, tabs: matchingTabs };
  }).filter((group) => group.tabs.length > 0);

  // Collapsed View (Slim Icon Rail for Full Screen Workspace)
  if (isCollapsed) {
    return (
      <aside className="w-14 shrink-0 bg-[#0F172A] text-slate-300 border-r border-[#334155] flex flex-col h-full select-none text-xs items-center py-2 transition-all">
        {/* Expand Button */}
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition mb-3 cursor-pointer"
          title="Expand Sidebar (Modules Menu)"
        >
          <PanelLeftOpen className="w-4 h-4 text-sky-400" />
        </button>

        {/* Scrollable icon list */}
        <div className="flex-1 w-full overflow-y-auto space-y-1.5 px-1.5 scrollbar-none">
          {NAV_GROUPS.flatMap((g) => g.tabs).map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                data-nav-tab={tab.id}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => onSelectTab(tab.id)}
                className={`w-full h-9 flex items-center justify-center rounded-lg transition cursor-pointer relative group ${
                  isActive
                    ? 'bg-sky-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={`${tab.code}. ${tab.label}`}
              >
                <Icon className="w-4 h-4" />
                {/* Floating tooltip */}
                <div className="absolute left-14 ml-1 px-2 py-1 bg-slate-900 text-white text-[11px] font-mono rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition z-50 whitespace-nowrap border border-slate-700">
                  <span className="font-bold text-sky-400 mr-1">{tab.code}.</span>
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Integrity status dot */}
        <div className="pt-2 border-t border-[#334155] w-full flex justify-center">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              failedCheckCount === 0 ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
            }`}
            title={failedCheckCount === 0 ? 'All Checks Passed' : `${failedCheckCount} Check Issues`}
          />
        </div>
      </aside>
    );
  }

  // Expanded Sidebar View
  return (
    <aside className="w-64 shrink-0 bg-[#0F172A] text-slate-300 border-r border-[#334155] flex flex-col h-full select-none text-xs transition-all">
      {/* Sidebar Header with Filter & Collapse Button */}
      <div className="p-3 border-b border-[#334155] space-y-2 bg-[#0F172A]/90 sticky top-0 z-20">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Modules ({NAV_GROUPS.reduce((count, group) => count + group.tabs.length, 0)})</span>
          </div>

          <div className="flex items-center gap-1.5">
            {failedCheckCount > 0 ? (
              <span className="flex items-center gap-1 text-rose-400 font-bold text-[10px] bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                {failedCheckCount} Err
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                <CheckCircle2 className="w-3 h-3" />
                Pass
              </span>
            )}

            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer ml-1"
                title="Collapse sidebar for full screen workspace"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search module (e.g. 00, DSCR, Capex)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2 py-1 bg-slate-900/80 border border-slate-700 rounded text-slate-200 placeholder-slate-500 text-[11px] font-mono focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Navigation Groups List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 font-mono">
        {filteredGroups.map((group) => {
          const isCollapsedGroup = collapsedGroups[group.name] && searchTerm === '';
          return (
            <div key={group.name} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider text-left transition-colors cursor-pointer"
              >
                <span>{group.name}</span>
                {isCollapsedGroup ? (
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                )}
              </button>

              {!isCollapsedGroup && (
                <div className="space-y-0.5">
                  {group.tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    const isFlagship = tab.id === '00_driver_cockpit';

                    return (
                      <button
                        key={tab.id}
                data-nav-tab={tab.id}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                        onClick={() => onSelectTab(tab.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-sky-600 text-white font-bold shadow-xs'
                            : isFlagship
                            ? 'bg-sky-950/40 text-sky-300 hover:bg-sky-900/50 border border-sky-800/60 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`font-mono text-[10px] px-1 py-0.2 rounded shrink-0 ${
                              isActive
                                ? 'bg-sky-700 text-sky-100 font-bold'
                                : isFlagship
                                ? 'bg-sky-900 text-sky-200 font-bold'
                                : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                            }`}
                          >
                            {tab.code}
                          </span>
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive
                                ? 'text-white'
                                : isFlagship
                                ? 'text-sky-300'
                                : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate text-[11px] font-sans font-medium">
                            {tab.label}
                          </span>
                        </div>

                        {tab.id === '00_driver_cockpit' && !isActive && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-900/80 text-sky-200 font-bold">
                            HUB
                          </span>
                        )}

                        {tab.id === '28_model_checks' && failedCheckCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Model Footnote */}
      <div className="p-2.5 border-t border-[#334155] text-[10px] text-slate-400 bg-[#0F172A] font-mono flex items-center justify-between">
        <span>PLTA 18MW BATANG TORU</span>
        <span className="text-emerald-400 font-bold">XIRR ENGINE</span>
      </div>
    </aside>
  );
};
