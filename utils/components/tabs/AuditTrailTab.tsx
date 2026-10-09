import React, { useState } from 'react';
import { FORMULA_AUDIT_MAP } from '../../utils/formatters';
import {
  FileCode,
  Search,
  CheckCircle2,
  GitBranch,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface AuditTrailTabProps {
  onSelectAuditKey?: (key: string) => void;
}

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ onSelectAuditKey }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKey, setSelectedKey] = useState('project_irr');

  const keys = Object.keys(FORMULA_AUDIT_MAP);
  const filteredKeys = keys.filter((k) => {
    const item = FORMULA_AUDIT_MAP[k];
    const matchName = item.metricName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFormula = item.formula.toLowerCase().includes(searchTerm.toLowerCase());
    return matchName || matchFormula;
  });

  const activeAudit = FORMULA_AUDIT_MAP[selectedKey] || FORMULA_AUDIT_MAP['project_irr'];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Calculation Logic, Formula Trace & Audit Registry
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent white-box project finance architecture. Every calculated cell traces back to its mathematical formula and dependent inputs.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search formulas or metrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:outline-blue-500"
          />
        </div>
      </div>

      {/* Model Calculation Flow Pipeline Map */}
      <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Deterministic Calculation Dependency Hierarchy
            </h3>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">
            Zero Circular Reference Architecture
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase block">1. Inputs & Assumptions</span>
            <div className="text-slate-300 text-[11px] font-mono leading-relaxed">
              • Technical & MW<br />
              • CAPEX packages<br />
              • Debt term sheet<br />
              • PLN PPA tariff<br />
              • Tax rate (22%)
            </div>
          </div>

          <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase block">2. Capex & Funding</span>
            <div className="text-slate-300 text-[11px] font-mono leading-relaxed">
              • Monthly S-Curve<br />
              • IDC calc (mode)<br />
              • Sources = Uses<br />
              • Equity calls<br />
              • Bank drawdowns
            </div>
          </div>

          <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
            <span className="text-[10px] font-bold text-purple-400 uppercase block">3. Debt Amortization</span>
            <div className="text-slate-300 text-[11px] font-mono leading-relaxed">
              • Opening debt<br />
              • Principal paydown<br />
              • Interest expense<br />
              • Closing balance<br />
              • 0.00 at maturity
            </div>
          </div>

          <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase block">4. Integrated Statements</span>
            <div className="text-slate-300 text-[11px] font-mono leading-relaxed">
              • Net Gen & Rev<br />
              • EBITDA & EBIT<br />
              • Tax & Net Profit<br />
              • Balance sheet<br />
              • 3-way Cash Flow
            </div>
          </div>

          <div className="p-3 rounded bg-slate-800/80 border border-slate-700 space-y-1">
            <span className="text-[10px] font-bold text-rose-400 uppercase block">5. Valuation & Credit</span>
            <div className="text-slate-300 text-[11px] font-mono leading-relaxed">
              • FCFF & Project IRR<br />
              • FCFE & Equity IRR<br />
              • Annual DSCR/LLCR<br />
              • LCOE unit cost<br />
              • Payback period
            </div>
          </div>
        </div>
      </div>

      {/* Formula Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formula Key List */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
            Select Formula to Inspect
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredKeys.map((k) => {
              const item = FORMULA_AUDIT_MAP[k];
              const isSelected = selectedKey === k;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedKey(k)}
                  className={`w-full text-left p-3 text-xs transition flex justify-between items-center ${
                    isSelected
                      ? 'bg-blue-50 border-l-4 border-blue-600 font-bold text-blue-900'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{item.metricName}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      {item.formula}
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Formula Breakdown Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mb-1.5">
              Formula Specification
            </span>
            <h3 className="text-lg font-bold text-slate-900">{activeAudit.metricName}</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Mathematical Equation:
              </span>
              <div className="p-3 bg-slate-900 text-emerald-400 font-mono rounded-lg border border-slate-800 text-xs">
                {activeAudit.formula}
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Financial Methodology & Engineering Logic:
              </span>
              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                {activeAudit.description}
              </p>
            </div>

            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Upstream Dependency Inputs:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeAudit.dependencies.map((dep, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[11px]"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
