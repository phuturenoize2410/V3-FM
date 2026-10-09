import React from 'react';
import {
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type {
  PirLifeToDateGovernancePresentation,
  PirLifeToDateReconciliationPresentation,
} from '../../calculations/pirLifeToDateGovernancePresentation';
import type {
  PirGovernancePresentationStatus,
  PirGovernanceStagePresentation,
} from '../../calculations/pirGovernancePresentation';

interface PirLifeToDateGovernancePanelProps {
  presentation: PirLifeToDateGovernancePresentation;
  compact?: boolean;
}

const StatusIcon: React.FC<{ status: PirGovernancePresentationStatus }> = ({ status }) =>
  status === 'ready' ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
  ) : (
    <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
  );

/**
 * Calculation-free institutional presentation for governed PIR life-to-date state.
 *
 * This component intentionally consumes only the authoritative presentation adapter.
 * It does not reconstruct readiness from lower-level objects, select a baseline,
 * calculate PIR economics, mutate Actuals, infer reporting periods or introduce
 * electricity/commercial assumptions. A ready governance state means evidence and
 * population reconciliation are fit for downstream presentation only; it is not an
 * investment approval or commercial-term validation.
 */
export const PirLifeToDateGovernancePanel: React.FC<PirLifeToDateGovernancePanelProps> = ({
  presentation,
  compact = false,
}) => {
  const ready = presentation.status === 'ready';

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
                PIR Governance &amp; Reconciliation
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-[#fffefa] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-600">
                <StatusIcon status={presentation.status} />
                {ready ? 'Ready for presentation' : 'Blocked'}
              </span>
            </div>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Baseline governance and life-to-date population reconciliation are shown separately from PIR economics and investment approval.
            </p>
          </div>
        </div>

        <div className="min-w-[220px] rounded-lg border border-stone-200/80 bg-[#fffefa] px-3 py-2 text-right">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
            Reconciled periods
          </div>
          <div className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-slate-950">
            {presentation.reconciliation.uniqueYearCount}/{presentation.reconciliation.periodCount}
          </div>
          <div className="text-[9px] leading-4 text-stone-500">unique years / supplied periods</div>
        </div>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {presentation.governance.stages.map((stage) => (
            <GovernanceStage key={stage.id} stage={stage} />
          ))}
          <ReconciliationStage reconciliation={presentation.reconciliation} />
        </div>

        {!compact && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                Governance conclusion
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-900">{presentation.headline}</div>
              <p className="mt-1 text-[10px] leading-4 text-stone-600">{presentation.summary}</p>
            </div>

            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                Baseline identity
              </div>
              <IdentityRow label="Plan" value={presentation.governance.planBaselineId} />
              <IdentityRow label="Actual-to-Date" value={presentation.governance.actualBaselineId} />
            </div>
          </div>
        )}

        {presentation.blockingReasons.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200/90 bg-[#fff9ed] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-900">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
              Governance blockers
            </div>
            <ul className="mt-1.5 space-y-1 text-[10px] leading-4 text-amber-950">
              {presentation.blockingReasons.slice(0, compact ? 1 : 4).map((reason, index) => (
                <li key={`${index}-${reason}`} className="flex gap-2">
                  <span className="font-mono text-amber-700">{String(index + 1).padStart(2, '0')}</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            {!compact && presentation.blockingReasons.length > 4 && (
              <div className="mt-1.5 text-[9px] text-amber-800">
                +{presentation.blockingReasons.length - 4} additional blocker{presentation.blockingReasons.length - 4 === 1 ? '' : 's'} retained in the authoritative governance bundle.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const GovernanceStage: React.FC<{ stage: PirGovernanceStagePresentation }> = ({ stage }) => (
  <div className="min-w-0 rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-500">{stage.label}</div>
      <StatusIcon status={stage.status} />
    </div>
    <div className="mt-1 text-[10px] font-semibold text-slate-900">
      {stage.status === 'ready' ? 'Ready' : 'Blocked'}
    </div>
    <p className="mt-0.5 text-[9px] leading-4 text-stone-600">{stage.detail}</p>
  </div>
);

const ReconciliationStage: React.FC<{
  reconciliation: PirLifeToDateReconciliationPresentation;
}> = ({ reconciliation }) => (
  <div className="min-w-0 rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-500">{reconciliation.label}</div>
      <StatusIcon status={reconciliation.status} />
    </div>
    <div className="mt-1 text-[10px] font-semibold text-slate-900">
      {reconciliation.status === 'ready' ? 'Reconciled' : 'Blocked'}
    </div>
    <div className="mt-1 flex items-center gap-3 text-[9px] text-stone-500">
      <span className="tabular-nums">{reconciliation.blockingIssueCount} blockers</span>
      <span className="tabular-nums">{reconciliation.warningCount} warnings</span>
    </div>
    <p className="mt-0.5 text-[9px] leading-4 text-stone-600">{reconciliation.detail}</p>
  </div>
);

const IdentityRow: React.FC<{ label: string; value: string | null }> = ({ label, value }) => (
  <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-stone-100 pt-1.5 first:mt-1 first:border-t-0 first:pt-0">
    <span className="text-[9px] text-stone-500">{label}</span>
    <span className="max-w-[150px] truncate font-mono text-[9px] font-semibold tabular-nums text-slate-800" title={value ?? 'Not selected'}>
      {value ?? 'Not selected'}
    </span>
  </div>
);
