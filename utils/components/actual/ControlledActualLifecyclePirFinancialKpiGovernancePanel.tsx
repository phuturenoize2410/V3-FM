import React from 'react';
import {
  CheckCircle2,
  CircleDot,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type { ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle } from '../../calculations/controlledActualLifecyclePirFinancialKpiReportingHandoffBundle';
import {
  buildControlledActualLifecyclePirFinancialKpiReportingPresentation,
  type ControlledPirFinancialKpiReportingStatus,
} from '../../calculations/controlledActualLifecyclePirFinancialKpiReportingPresentation';

interface ControlledActualLifecyclePirFinancialKpiGovernancePanelProps {
  handoff: ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle;
  compact?: boolean;
}

const StatusIcon: React.FC<{ status: ControlledPirFinancialKpiReportingStatus }> = ({ status }) =>
  status === 'ready' ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
  ) : (
    <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
  );

/**
 * Read-only institutional reporting surface for the controlled Actual -> lifecycle
 * -> PIR -> OPEX/CFADS/DSCR governance chain.
 *
 * The component accepts only the authoritative reporting handoff and delegates all
 * presentation shaping to the calculation-free reporting adapter. It therefore does
 * not rebuild readiness, infer KPI populations, classify Actuals, or pair evidence
 * from parallel governance runs in UI code.
 *
 * Boundaries:
 * - no Actual amount, Mapping Master rule or lifecycle phase is imported or changed;
 * - no OPEX, CFADS, DSCR or PIR economics are calculated, repaired or aggregated;
 * - no baseline is approved, persisted, superseded or selected;
 * - no source system, preparer or approver authority is authenticated;
 * - no Energy Sales, tariff tier, escalation, PPA, EBL or commercial term is inferred.
 *
 * Keep this component unwired until a live surface owns the exact authoritative
 * reporting handoff. Do not synthesize a handoff from loose presentation data.
 */
export const ControlledActualLifecyclePirFinancialKpiGovernancePanel: React.FC<
  ControlledActualLifecyclePirFinancialKpiGovernancePanelProps
> = ({ handoff, compact = false }) => {
  const presentation = buildControlledActualLifecyclePirFinancialKpiReportingPresentation(handoff);
  const ready = presentation.status === 'ready';
  const readyPeriods = presentation.periods.filter((period) => period.status === 'ready').length;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200/90 bg-[#fdfcf9] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/90 bg-[#f7f5f0] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#fffefa] text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.025)]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[12px] font-semibold tracking-[0.005em] text-slate-950">
                Investment Lifecycle &amp; PIR Evidence
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-[#fffefa] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-600">
                <StatusIcon status={presentation.status} />
                {ready ? 'Reporting evidence ready' : 'Blocked'}
              </span>
            </div>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Exact controlled Actual lifecycle evidence, PIR baseline governance and OPEX/CFADS/DSCR source coverage are retained from one authoritative chain.
            </p>
          </div>
        </div>

        <div className="grid min-w-[290px] grid-cols-3 overflow-hidden rounded-lg border border-stone-200/80 bg-[#fffefa]">
          <Metric label="Lifecycle rows" value={presentation.lifecycleSelectedRowCount.toLocaleString()} />
          <Metric label="PIR periods" value={presentation.governedPeriodCount.toLocaleString()} borderLeft />
          <Metric label="Ready periods" value={readyPeriods.toLocaleString()} borderLeft />
        </div>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="grid gap-2 md:grid-cols-3">
          {presentation.pir.stages.map((stage) => (
            <div
              key={stage.id}
              className="min-w-0 rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-500" title={stage.label}>
                  {stage.label}
                </div>
                <StatusIcon status={stage.status} />
              </div>
              <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-950">
                {stage.status === 'ready' ? 'Evidence gate passed' : 'Evidence gate blocked'}
              </div>
              {!compact && (
                <p className="mt-1 text-[9px] leading-4 text-stone-500">{stage.detail}</p>
              )}
            </div>
          ))}
        </div>

        {!compact && (
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa]">
              <div className="flex items-center justify-between gap-3 border-b border-stone-200/80 bg-[#faf8f3] px-3 py-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                    Financial KPI source coverage
                  </div>
                  <div className="mt-0.5 text-[9px] text-stone-500">
                    OPEX / CFADS / DSCR evidence only; values are not recalculated here.
                  </div>
                </div>
                <span className="font-mono text-[10px] font-semibold tabular-nums text-slate-900">
                  {readyPeriods}/{presentation.governedPeriodCount}
                </span>
              </div>

              <div className="max-h-72 overflow-auto">
                <table className="w-full border-collapse text-left text-[9px]">
                  <thead className="sticky top-0 bg-[#fffefa] text-stone-500">
                    <tr className="border-b border-stone-200/80">
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Year</th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Status</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-[0.08em]">Expected</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-[0.08em]">Supplied</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-[0.08em]">Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentation.periods.map((period) => (
                      <tr key={period.year} className="border-b border-stone-100 last:border-b-0">
                        <td className="px-3 py-2 font-mono font-semibold tabular-nums text-slate-950">{period.year}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-stone-700">
                            <StatusIcon status={period.status} />
                            {period.status === 'ready' ? 'Ready' : 'Blocked'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">{period.expectedEvidenceKeys.length}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">{period.suppliedEvidenceKeys.length}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">{period.missingEvidenceKeys.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                PIR baseline identity
              </div>
              <div className="mt-2 space-y-1.5">
                <EvidenceRow label="Plan baseline" value={presentation.pir.planBaselineId ?? 'Not selected'} mono />
                <EvidenceRow label="Actual baseline" value={presentation.pir.actualBaselineId ?? 'Not selected'} mono />
              </div>
              <div className="mt-3 border-t border-stone-100 pt-2">
                <div className="flex items-start gap-2 text-[9px] leading-4 text-stone-500">
                  <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" />
                  <span>
                    Reporting readiness is evidence readiness only. It is not baseline approval, investment approval or an investment decision.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {presentation.blockingReasons.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200/90 bg-[#fff9ed] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-900">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
              Blocking evidence
            </div>
            <div className="mt-1.5 grid gap-1 lg:grid-cols-2">
              {presentation.blockingReasons.slice(0, compact ? 2 : 8).map((reason, index) => (
                <div key={`${index}-${reason}`} className="flex min-w-0 gap-2 text-[9px] leading-4 text-amber-950">
                  <span className="shrink-0 font-mono text-amber-700">{String(index + 1).padStart(2, '0')}</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
            {!compact && presentation.blockingReasons.length > 8 && (
              <div className="mt-1.5 text-[9px] text-amber-800">
                +{presentation.blockingReasons.length - 8} additional blocking reason{presentation.blockingReasons.length - 8 === 1 ? '' : 's'} retained by the authoritative handoff.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string; borderLeft?: boolean }> = ({ label, value, borderLeft = false }) => (
  <div className={`px-3 py-2 text-right ${borderLeft ? 'border-l border-stone-200/80' : ''}`}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">{label}</div>
    <div className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-slate-950">{value}</div>
  </div>
);

const EvidenceRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 border-t border-stone-100 pt-1.5 first:border-t-0 first:pt-0">
    <span className="shrink-0 text-[9px] text-stone-500">{label}</span>
    <span className={`${mono ? 'font-mono tabular-nums' : ''} min-w-0 break-all text-right text-[9px] font-semibold text-slate-900`}>
      {value}
    </span>
  </div>
);
