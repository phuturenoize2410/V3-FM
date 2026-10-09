import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  ShieldCheck,
} from 'lucide-react';
import type { ActualDataPresentationState } from '../../calculations/actualPresentationStatus';
import type { ActualReleaseDiagnostics } from '../../calculations/actualReleaseDiagnostics';

interface ActualDataProvenancePanelProps {
  presentation: ActualDataPresentationState;
  diagnostics?: ActualReleaseDiagnostics | null;
  compact?: boolean;
}

function getStatusTone(status: ActualDataPresentationState['status']) {
  switch (status) {
    case 'VERIFIED_RELEASED':
      return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: 'text-emerald-700',
        Icon: ShieldCheck,
      };
    case 'IMPORT_BLOCKED':
      return {
        badge: 'border-rose-200 bg-rose-50 text-rose-800',
        icon: 'text-rose-700',
        Icon: FileWarning,
      };
    case 'MANUAL_UNVERIFIED':
      return {
        badge: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: 'text-amber-700',
        Icon: AlertTriangle,
      };
    case 'DEMO_UNVERIFIED':
    default:
      return {
        badge: 'border-slate-200 bg-slate-50 text-slate-700',
        icon: 'text-slate-600',
        Icon: AlertTriangle,
      };
  }
}

function formatRows(value: number | null) {
  return value === null ? 'Not available' : value.toLocaleString();
}

/**
 * Presentation-only provenance surface for Plan vs Actual / PIR.
 *
 * The component does not validate, map, release, approve or transform Actual data.
 * It only renders status produced by the controlled Actual workflow utilities so
 * model-generated or manually edited populations cannot visually masquerade as
 * verified Actuals.
 *
 * Lifecycle / PIR eligibility is deliberately stricter than the presentation
 * status alone: explicit release diagnostics must also be supplied and pass.
 * A VERIFIED_RELEASED label without diagnostics therefore cannot render as
 * lifecycle-ready on this surface.
 */
export const ActualDataProvenancePanel: React.FC<ActualDataProvenancePanelProps> = ({
  presentation,
  diagnostics,
  compact = false,
}) => {
  const tone = getStatusTone(presentation.status);
  const StatusIcon = tone.Icon;
  const failedErrorChecks = diagnostics
    ? diagnostics.checks.filter((check) => check.severity === 'error' && !check.passed)
    : [];

  const releaseReady =
    presentation.status === 'VERIFIED_RELEASED' &&
    presentation.lifecycleEligible &&
    diagnostics?.releaseReady === true;

  const readinessLabel = releaseReady
    ? 'Lifecycle / PIR eligible'
    : diagnostics
      ? 'Lifecycle / PIR blocked'
      : 'Release diagnostics not supplied';

  return (
    <section
      className="rounded-lg border border-slate-200 bg-[#fbfaf7] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      aria-label="Actual data provenance"
    >
      <div className={`flex flex-wrap items-start justify-between gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon className={`h-4 w-4 shrink-0 ${tone.icon}`} />
            <h3 className="text-xs font-semibold tracking-[0.01em] text-slate-900">
              Actual Data Provenance
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tone.badge}`}
            >
              {presentation.label}
            </span>
          </div>
          <p className="mt-1.5 max-w-4xl text-[11px] leading-4 text-slate-600">
            {presentation.description}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
          {releaseReady ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              {readinessLabel}
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
              {readinessLabel}
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 border-t border-slate-200 md:grid-cols-4">
          <Metric label="Source rows" value={formatRows(presentation.sourceRows)} />
          <Metric label="Released rows" value={formatRows(presentation.releasedRows)} />
          <Metric label="Rejected rows" value={diagnostics ? formatRows(diagnostics.rejectedRows) : 'Not checked'} />
          <Metric label="Unmapped rows" value={diagnostics ? formatRows(diagnostics.unmappedRows) : 'Not checked'} />
        </div>
      )}

      {(presentation.blockingReasons.length > 0 || failedErrorChecks.length > 0 || !diagnostics) && (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Release blockers
          </div>
          <div className="mt-1.5 space-y-1">
            {!diagnostics && (
              <div className="flex items-start gap-2 text-[11px] leading-4 text-slate-700">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                <span>Controlled release diagnostics have not been supplied to this presentation surface.</span>
              </div>
            )}
            {presentation.blockingReasons.map((reason) => (
              <div key={reason} className="flex items-start gap-2 text-[11px] leading-4 text-slate-700">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span>{reason}</span>
              </div>
            ))}
            {failedErrorChecks.map((check) => (
              <div key={check.id} className="flex items-start gap-2 text-[11px] leading-4 text-slate-700">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                <span>
                  <span className="font-semibold">{check.label}:</span> {check.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-r border-slate-200 px-4 py-3 last:border-r-0">
    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label}
    </div>
    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900">
      {value}
    </div>
  </div>
);
