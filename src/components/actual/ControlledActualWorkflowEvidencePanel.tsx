import React from 'react';
import { CircleDot, Database, Layers3 } from 'lucide-react';
import type { ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle } from '../../calculations/controlledActualLifecyclePirFinancialKpiReportingHandoffBundle';
import { buildControlledActualLifecyclePirFinancialKpiReportingPresentation } from '../../calculations/controlledActualLifecyclePirFinancialKpiReportingPresentation';

interface ControlledActualWorkflowEvidencePanelProps {
  handoff: ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle;
  compact?: boolean;
}

/**
 * Read-only institutional evidence surface for the exact Controlled Actual workflow
 * retained by the lifecycle + PIR + financial-KPI reporting handoff.
 *
 * Generic controlled-release readiness and Actual-only readiness are deliberately
 * shown as separate controls. The panel mirrors authoritative diagnostics and never
 * inspects/relabels released rows to manufacture Actual-to-Date semantics.
 */
export const ControlledActualWorkflowEvidencePanel: React.FC<
  ControlledActualWorkflowEvidencePanelProps
> = ({ handoff, compact = false }) => {
  const presentation = buildControlledActualLifecyclePirFinancialKpiReportingPresentation(handoff);
  const evidence = presentation.actualWorkflowEvidence;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200/90 bg-[#fdfcf9] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/90 bg-[#f7f5f0] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#fffefa] text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.025)]">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold tracking-[0.005em] text-slate-950">
              Controlled Actual Workflow Evidence
            </h3>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Audit navigation over the exact source population, Mapping Master, cutoff and semantic release controls retained by the authoritative reporting chain.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-[#fffefa] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-600">
          <Layers3 className="h-3.5 w-3.5 text-slate-700" />
          Structural provenance
        </span>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="grid overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa] sm:grid-cols-2 xl:grid-cols-5">
          <EvidenceMetric label="Source rows" value={evidence.sourceRowCount.toLocaleString()} />
          <EvidenceMetric label="Mapping rules" value={evidence.mappingRuleCount.toLocaleString()} bordered />
          <EvidenceMetric label="Rule signatures" value={evidence.mappingMasterRuleSignatureCount.toLocaleString()} bordered />
          <EvidenceMetric label="Cutoff" value={evidence.cutoffDate || 'Not supplied'} mono bordered />
          <EvidenceMetric label="Mapping version" value={evidence.mappingMasterVersion || 'Not supplied'} mono bordered />
        </div>

        <div className="mt-3 grid overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa] sm:grid-cols-3">
          <ControlMetric label="Cutoff validity" value={evidence.cutoffValid ? 'Valid' : 'Blocked'} ready={evidence.cutoffValid} />
          <ControlMetric label="Cutoff evaluation" value={evidence.cutoffEvaluated ? 'Evaluated' : 'Not evaluated'} ready={evidence.cutoffEvaluated} bordered />
          <ControlMetric label="Rows after cutoff" value={evidence.rejectedAfterCutoffRows.toLocaleString()} ready={evidence.rejectedAfterCutoffRows === 0} bordered numeric />
        </div>

        <div className="mt-3 grid overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa] sm:grid-cols-5">
          <ControlMetric label="Controlled release" value={evidence.controlledReleaseReady ? 'Ready' : 'Blocked'} ready={evidence.controlledReleaseReady} />
          <ControlMetric label="Actual-only release" value={evidence.actualOnlyReleaseReady ? 'Ready' : 'Blocked'} ready={evidence.actualOnlyReleaseReady} bordered />
          <EvidenceMetric label="Released rows" value={evidence.releasedRowCount.toLocaleString()} bordered />
          <EvidenceMetric label="Explicit Actual rows" value={evidence.actualRowCount.toLocaleString()} bordered />
          <EvidenceMetric label="Non-Actual rows" value={evidence.nonActualRowCount.toLocaleString()} bordered />
        </div>

        {!compact && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">Evidence interpretation</div>
              <p className="mt-1.5 text-[9px] leading-4 text-stone-600">
                Controlled release may legitimately contain explicit commitment, ETC, budget or model-baseline classes. Actual-only readiness is the stricter retained diagnostic required before a consumer presents the released population as Actual-to-Date. This panel does not derive either status.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-[#fff9ed] px-3 py-2.5">
              <div className="flex items-start gap-2 text-[9px] leading-4 text-amber-950">
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-amber-700" />
                <span>
                  These controls remain structural provenance only. They do not authenticate an ERP/source system, Mapping Master authority, preparer or approver, and they do not approve or persist an investment baseline.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const EvidenceMetric: React.FC<{ label: string; value: string; mono?: boolean; bordered?: boolean }> = ({ label, value, mono = false, bordered = false }) => (
  <div className={`min-w-0 px-3 py-2.5 ${bordered ? 'border-t border-stone-200/80 sm:border-l sm:border-t-0' : ''}`}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">{label}</div>
    <div className={`mt-1 min-w-0 truncate text-right text-[11px] font-semibold text-slate-950 ${mono ? 'font-mono tabular-nums' : 'tabular-nums'}`} title={value}>
      {value}
    </div>
  </div>
);

const ControlMetric: React.FC<{ label: string; value: string; ready: boolean; bordered?: boolean; numeric?: boolean }> = ({ label, value, ready, bordered = false, numeric = false }) => (
  <div className={`min-w-0 px-3 py-2.5 ${bordered ? 'border-t border-stone-200/80 sm:border-l sm:border-t-0' : ''}`}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">{label}</div>
    <div className="mt-1.5 flex min-w-0 items-center gap-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ready ? 'bg-emerald-600' : 'bg-amber-600'}`} aria-hidden="true" />
      <span className={`min-w-0 truncate text-[10px] font-semibold ${ready ? 'text-emerald-900' : 'text-amber-950'} ${numeric ? 'font-mono tabular-nums' : ''}`} title={value}>
        {value}
      </span>
    </div>
  </div>
);
