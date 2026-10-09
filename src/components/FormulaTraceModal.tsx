import React from 'react';
import { FormulaTraceNode } from '../types';
import { X, Calculator, ArrowRight, Info, CheckCircle, ExternalLink } from 'lucide-react';

interface FormulaTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeKey: string;
  traceNodes: Record<string, FormulaTraceNode>;
  onSelectNode: (key: string) => void;
}

export const FormulaTraceModal: React.FC<FormulaTraceModalProps> = ({
  isOpen,
  onClose,
  nodeKey,
  traceNodes,
  onSelectNode,
}) => {
  if (!isOpen) return null;

  const node = traceNodes[nodeKey];
  if (!node) return (
    <div role="dialog" aria-label="Formula trace unavailable" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded border border-slate-300 p-4 text-sm">
        <p>Formula trace unavailable: {nodeKey}. No replacement metric is shown.</p>
        <button onClick={onClose} className="mt-3 text-slate-900 underline">Close Trace</button>
      </div>
    </div>
  );

  return (
    <div role="dialog" aria-label="Audit Trail & Formula Trace" data-trace-key={nodeKey} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Audit Trail & Formula Trace</h3>
              <p className="text-[11px] text-slate-400">
                Transparent calculation dependency verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Trace"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Node Switcher Tabs */}
        <div className="bg-slate-100 px-5 py-2 border-b border-slate-200 flex gap-2 overflow-x-auto text-xs">
          {Object.keys(traceNodes).map((k) => (
            <button
              key={k}
              onClick={() => onSelectNode(k)}
              className={`px-3 py-1 rounded whitespace-nowrap font-medium transition ${
                k === nodeKey
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {traceNodes[k].metricName.split('(')[0]}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Target Metric Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Metric Target
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-200">
                Unit: {node.unit}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">{node.metricName}</div>
            <div className="text-2xl font-extrabold text-blue-600 mt-1">{node.symbolOrValue}</div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{node.description}</p>
          </div>

          {/* Explicit Mathematical Formula */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              Mathematical Formula Definition
            </h4>
            <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-3.5 rounded border border-slate-800 shadow-inner overflow-x-auto">
              <code>{node.formulaString}</code>
            </div>
          </div>

          {/* Upstream Components / Sub-formula Inputs */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Formula Component Breakdown & Origins
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
              {node.components.map((comp, idx) => (
                <div key={idx} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>{comp.label}</span>
                      {comp.isInput ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                          Direct Input
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-300">
                          Derived Calculation
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Source: {comp.source}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {comp.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Notes & Financial Modeling Rule Compliance */}
          {node.notes && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900">
                <span className="font-bold">Project Finance Standard: </span>
                {node.notes}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Non-circular, fully reconcilable dynamic calculation node</span>
          <button
            onClick={onClose}
            aria-label="Close Trace"
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium transition"
          >
            Close Trace
          </button>
        </div>
      </div>
    </div>
  );
};
