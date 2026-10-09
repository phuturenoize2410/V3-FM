import React from 'react';
import { CheckCircle2, Database, LockKeyhole } from 'lucide-react';
import type { ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle } from '../../calculations/controlledActualLifecyclePirFinancialKpiReportingHandoffBundle';
import {
  buildControlledActualLifecyclePirFinancialKpiReportingPresentation,
  type ControlledPirFinancialKpiReportingStatus,
} from '../../calculations/controlledActualLifecyclePirFinancialKpiReportingPresentation';

interface ControlledPirFinancialKpiSourceEvidencePanelProps {
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
 * Read-only audit drill-down for caller-supplied OPEX / CFADS / DSCR source identities.
 *
 * The component accepts only the authoritative lifecycle + PIR + financial-KPI reporting
 * handoff. It exposes sourceId and populationId exactly as retained by governance and does
 * not reconstruct provenance from coverage keys, values, years or lifecycle Actual rows.
 *
 * Boundary:
 * - source/population identifiers are structural provenance, not authenticated source-system proof;
 * - no KPI value, readiness, Actual classification or accounting treatment is calculated here;
 * - no baseline approval, persistence, supersession or PIR selection occurs here;
 * - electricity-specific Energy Sales / tariff / PPA / EBL evidence remains module-owned.
 */
export const ControlledPirFinancialKpiSourceEvidencePanel: React.FC<
  ControlledPirFinancialKpiSourceEvidencePanelProps
> = ({ handoff, compact = false }) => {
  const presentation = buildControlledActualLifecyclePirFinancialKpiReportingPresentation(handoff);
  const evidenceCount = presentation.periods.reduce(
    (count, period) => count + period.sourceEvidence.length,
    0
  );

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200/90 bg-[#fdfcf9] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/90 bg-[#f7f5f0] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#fffefa] text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.025)]">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold tracking-[0.005em] text-slate-950">
              Governed Financial KPI Sources
            </h3>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Exact caller-supplied source and population references retained by controlled PIR OPEX / CFADS / DSCR governance.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-stone-200 bg-[#fffefa] px-2.5 py-1.5 text-right">
          <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-stone-500">Evidence items</div>
          <div className="font-mono text-[13px] font-semibold tabular-nums text-slate-950">
            {evidenceCount.toLocaleString()}
          </div>
        </div>
      </div>

      <div className={compact ? 'max-h-56 overflow-auto' : 'max-h-80 overflow-auto'}>
        <table className="w-full border-collapse text-left text-[9px]">
          <thead className="sticky top-0 z-10 bg-[#fffefa] text-stone-500">
            <tr className="border-b border-stone-200/90">
              <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Year</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Metric</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Side</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Source ID</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Population ID</th>
              <th className="px-3 py-2 font-semibold uppercase tracking-[0.08em]">Status</th>
            </tr>
          </thead>
          <tbody>
            {presentation.periods.flatMap((period) =>
              period.sourceEvidence.map((evidence, index) => (
                <tr
                  key={`${period.year}-${evidence.metric}-${evidence.side}-${evidence.sourceId}-${evidence.populationId}-${index}`}
                  className="border-b border-stone-100 last:border-b-0"
                >
                  <td className="px-3 py-2 font-mono font-semibold tabular-nums text-slate-950">
                    {period.year}
                  </td>
                  <td className="px-3 py-2 font-semibold uppercase tracking-[0.04em] text-slate-800">
                    {evidence.metric}
                  </td>
                  <td className="px-3 py-2 uppercase tracking-[0.04em] text-stone-600">
                    {evidence.side}
                  </td>
                  <td className="max-w-[220px] break-all px-3 py-2 font-mono tabular-nums text-slate-800">
                    {evidence.sourceId}
                  </td>
                  <td className="max-w-[220px] break-all px-3 py-2 font-mono tabular-nums text-slate-800">
                    {evidence.populationId}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700">
                      <StatusIcon status={evidence.status} />
                      {evidence.status === 'ready' ? 'Ready' : 'Blocked'}
                    </span>
                  </td>
                </tr>
              ))
            )}
            {evidenceCount === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[9px] leading-4 text-stone-500">
                  No governed OPEX / CFADS / DSCR source evidence is retained by this authoritative handoff.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!compact && (
        <div className="border-t border-stone-200/80 bg-[#faf8f3] px-4 py-2 text-[9px] leading-4 text-stone-500">
          Source IDs and population IDs are audit references supplied by governance callers. They are not authentication, audit certification, accounting classification or investment approval.
        </div>
      )}
    </section>
  );
};
