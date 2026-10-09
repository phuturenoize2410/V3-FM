import React from 'react';
import { CheckCircle2, CircleDot, DatabaseZap, FileClock } from 'lucide-react';
import type { BaselineApprovalPersistenceConfirmationEventBundle } from '../../calculations/baselineApprovalPersistenceConfirmationEventBundle';

interface BaselinePersistenceGovernancePanelProps {
  bundle: BaselineApprovalPersistenceConfirmationEventBundle;
  compact?: boolean;
}

/**
 * Read-only institutional governance surface for the exact baseline persistence
 * confirmation-event bundle.
 *
 * The panel deliberately accepts the authoritative bundle rather than loose ids,
 * timestamps, registry versions or reconstructed signatures. It mirrors retained
 * governance evidence only and does not make the persistence boundary stronger.
 *
 * Boundary:
 * - ready/not-ready mirrors the supplied confirmation-event bundle;
 * - request/version/signature fields remain caller/storage structural evidence;
 * - registry cardinalities mirror retained observed/candidate/persisted evidence;
 * - no write, compare-and-swap, durable-store authentication or supersession occurs;
 * - no baseline approval decision, PIR selection or financial calculation occurs;
 * - storage semantics remain external (in-place, event-sourced, append-new-version).
 */
export const BaselinePersistenceGovernancePanel: React.FC<
  BaselinePersistenceGovernancePanelProps
> = ({ bundle, compact = false }) => {
  const event = bundle.appendOnlyConfirmationEventEvidence;
  const confirmation = bundle.confirmation;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200/90 bg-[#fdfcf9] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/90 bg-[#f7f5f0] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#fffefa] text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.025)]">
            <DatabaseZap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold tracking-[0.005em] text-slate-950">
              Baseline Persistence Governance
            </h3>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Read-only audit navigation from reviewed approval intent through durable-store read-back and append-only confirmation evidence.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.095em] ${
            bundle.ready
              ? 'border-emerald-200 bg-[#f2fbf5] text-emerald-800'
              : 'border-amber-200 bg-[#fff9ed] text-amber-900'
          }`}
        >
          {bundle.ready ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <CircleDot className="h-3.5 w-3.5" />
          )}
          {bundle.ready ? 'Confirmed evidence' : 'Blocked'}
        </span>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="grid overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa] sm:grid-cols-2 xl:grid-cols-4">
          <EvidenceMetric label="Target baseline" value={event?.targetBaselineId ?? 'Not confirmed'} mono />
          <EvidenceMetric label="Request ID" value={(event?.requestId ?? confirmation.intent.requestId) || 'Not supplied'} mono bordered />
          <EvidenceMetric label="Observed version" value={(event?.observedRegistryVersion ?? confirmation.intent.observedRegistryVersion) || 'Not supplied'} mono bordered />
          <EvidenceMetric label="Persisted version" value={(event?.persistedRegistryVersion ?? confirmation.persistedRegistryVersion) || 'Not supplied'} mono bordered />
        </div>

        <div className="mt-3 grid overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa] sm:grid-cols-2 xl:grid-cols-5">
          <EvidenceMetric label="Requested at" value={(event?.requestedAt ?? confirmation.intent.requestedAt) || 'Not supplied'} mono />
          <EvidenceMetric label="Confirmed at" value={(event?.confirmedAt ?? confirmation.confirmedAt) || 'Not supplied'} mono bordered />
          <EvidenceMetric label="Observed records" value={(event?.observedRegistrySize ?? confirmation.intent.handoff.registrySnapshot.length).toLocaleString()} bordered />
          <EvidenceMetric label="Candidate records" value={(event?.candidateRegistrySize ?? confirmation.intent.handoff.candidateRegistry?.length ?? 0).toLocaleString()} bordered />
          <EvidenceMetric label="Persisted records" value={(event?.persistedRegistrySize ?? confirmation.persistedRegistrySnapshot.length).toLocaleString()} bordered />
        </div>

        {!compact && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.62fr)]">
            <div className="rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                <FileClock className="h-3.5 w-3.5 text-slate-700" />
                Structural evidence
              </div>
              <div className="mt-2 grid gap-2">
                <SignatureRow
                  label="Observed registry"
                  value={event?.observedRegistryStructuralSignature ?? confirmation.intent.observedRegistryStructuralSignature ?? 'Not available'}
                />
                <SignatureRow
                  label="Candidate registry"
                  value={event?.candidateRegistryStructuralSignature ?? confirmation.intent.candidateRegistryStructuralSignature ?? 'Not available'}
                />
                <SignatureRow
                  label="Persisted read-back"
                  value={(event?.persistedRegistryStructuralSignature ?? confirmation.persistedRegistryStructuralSignature) || 'Not available'}
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-[#fff9ed] px-3 py-2.5">
              <div className="flex items-start gap-2 text-[9px] leading-4 text-amber-950">
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-amber-700" />
                <span>
                  Version tokens and canonical signatures are structural audit evidence only. This surface does not authenticate durable storage, prove compare-and-swap execution or choose the registry persistence semantic.
                </span>
              </div>
              {bundle.blockingReasons.length > 0 && (
                <div className="mt-2 border-t border-amber-200/80 pt-2 text-[9px] leading-4 text-amber-950">
                  {bundle.blockingReasons.join(' ')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const EvidenceMetric: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  bordered?: boolean;
}> = ({ label, value, mono = false, bordered = false }) => (
  <div className={`min-w-0 px-3 py-2.5 ${bordered ? 'border-t border-stone-200/80 sm:border-l sm:border-t-0' : ''}`}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">{label}</div>
    <div
      className={`mt-1 min-w-0 break-all text-[11px] font-semibold text-slate-950 ${
        mono ? 'font-mono tabular-nums' : 'tabular-nums'
      }`}
      title={value}
    >
      {value}
    </div>
  </div>
);

const SignatureRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid gap-1 md:grid-cols-[126px_minmax(0,1fr)] md:items-start">
    <span className="text-[9px] font-medium text-stone-500">{label}</span>
    <span className="max-h-14 overflow-hidden break-all font-mono text-[9px] leading-4 text-slate-700" title={value}>
      {value}
    </span>
  </div>
);

