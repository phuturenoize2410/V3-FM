import React from 'react';
import {
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type { AuditedCalculationScheduleReportingHandoffBundle } from '../../calculations/auditedCalculationScheduleReportingHandoffBundle';
import type { AuditedCalculationScheduleGovernanceStatus } from '../../calculations/auditedCalculationScheduleGovernancePresentation';

interface AuditedCalculationScheduleGovernancePanelProps {
  handoff: AuditedCalculationScheduleReportingHandoffBundle;
  compact?: boolean;
}

const StatusIcon: React.FC<{ status: AuditedCalculationScheduleGovernanceStatus }> = ({ status }) =>
  status === 'READY' ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
  ) : (
    <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
  );

/**
 * Calculation-free institutional reporting surface for reconciled audited schedules.
 *
 * The component consumes only the authoritative single-source reporting handoff, so
 * status, retained population counts, solver evidence and origin-specific controls
 * cannot be paired from different audited calculation runs by the UI.
 *
 * Boundaries:
 * - no schedule row, solver result, failed check or financial amount is recalculated;
 * - no failed control is waived and no missing/reordered period is repaired;
 * - no debt, tax, tariff, PPA/EBL or other commercial term is inferred;
 * - no baseline approval, PIR selection, persistence or investment decision occurs.
 */
export const AuditedCalculationScheduleGovernancePanel: React.FC<
  AuditedCalculationScheduleGovernancePanelProps
> = ({ handoff, compact = false }) => {
  const { presentation } = handoff;
  const ready = presentation.status === 'READY';
  const operatingRange =
    presentation.firstOperatingYear === null || presentation.lastOperatingYear === null
      ? 'Not established'
      : presentation.firstOperatingYear === presentation.lastOperatingYear
        ? String(presentation.firstOperatingYear)
        : `${presentation.firstOperatingYear}–${presentation.lastOperatingYear}`;

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
                Audited Schedule Governance
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-[#fffefa] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-600">
                <StatusIcon status={presentation.status} />
                {ready ? 'Reporting evidence ready' : 'Blocked'}
              </span>
            </div>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Model checks, schedule-population identity, alias identity and solver evidence are retained from one authoritative audited run.
            </p>
          </div>
        </div>

        <div className="grid min-w-[270px] grid-cols-2 overflow-hidden rounded-lg border border-stone-200/80 bg-[#fffefa]">
          <Metric label="Operating periods" value={presentation.operatingPeriodCount.toLocaleString()} />
          <Metric label="Debt periods" value={presentation.debtPeriodCount.toLocaleString()} borderLeft />
        </div>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {presentation.controlGroups.map((group) => (
            <div
              key={group.id}
              className="min-w-0 rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-500" title={group.label}>
                  {group.label}
                </div>
                <StatusIcon status={group.status} />
              </div>
              <div className="mt-1 font-mono text-[12px] font-semibold tabular-nums text-slate-950">
                {group.passedCheckCount}/{group.passedCheckCount + group.failedCheckCount}
              </div>
              <div className="text-[9px] leading-4 text-stone-500">controls passed</div>
              {group.failedCheckIds.length > 0 && (
                <div className="mt-1 truncate font-mono text-[9px] text-amber-800" title={group.failedCheckIds.join(', ')}>
                  {group.failedCheckIds.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>

        {!compact && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                Population &amp; solver evidence
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                <EvidenceRow label="Operating range" value={operatingRange} />
                <EvidenceRow label="Solver convergence" value={presentation.solver.converged ? 'Converged' : 'Not converged'} />
                <EvidenceRow label="Solver iterations" value={presentation.solver.iterations.toLocaleString()} mono />
                <EvidenceRow label="Max debt-service delta" value={formatDiagnosticNumber(presentation.solver.maxDebtServiceDelta)} mono />
              </div>
            </div>

            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                Control conclusion
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-[10px] text-stone-600">Passed</span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-950">
                  {presentation.passedCheckCount}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-stone-100 pt-1">
                <span className="text-[10px] text-stone-600">Failed</span>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-950">
                  {presentation.failedCheckCount}
                </span>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-stone-500">
                Evidence readiness is not baseline approval, PIR selection or an investment decision.
              </p>
            </div>
          </div>
        )}

        {presentation.failedCheckIds.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200/90 bg-[#fff9ed] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-900">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
              Blocking controls
            </div>
            <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
              {presentation.failedCheckIds.slice(0, compact ? 2 : 8).map((id, index) => (
                <div key={id} className="flex min-w-0 gap-2 text-[9px] leading-4 text-amber-950">
                  <span className="shrink-0 font-mono text-amber-700">{String(index + 1).padStart(2, '0')}</span>
                  <span className="truncate font-mono" title={id}>{id}</span>
                </div>
              ))}
            </div>
            {!compact && presentation.failedCheckIds.length > 8 && (
              <div className="mt-1.5 text-[9px] text-amber-800">
                +{presentation.failedCheckIds.length - 8} additional blocking control{presentation.failedCheckIds.length - 8 === 1 ? '' : 's'} retained in the authoritative handoff.
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
  <div className="flex items-baseline justify-between gap-4 border-t border-stone-100 pt-1 first:border-t-0 first:pt-0">
    <span className="text-[9px] text-stone-500">{label}</span>
    <span className={`${mono ? 'font-mono tabular-nums' : ''} text-right text-[10px] font-semibold text-slate-900`}>
      {value}
    </span>
  </div>
);

function formatDiagnosticNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute < 0.0001 || absolute >= 1_000_000)) return value.toExponential(3);
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
