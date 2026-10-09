import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type { ActualReleaseDiagnostics } from '../../calculations/actualReleaseDiagnostics';
import type { PlanVsActualGovernanceViewModel } from '../../calculations/planVsActualPresentationBridge';
import type {
  PlanVsActualMigrationCandidateView,
  PlanVsActualMigrationPresentationViewModel,
} from '../../calculations/planVsActualMigrationPresentation';
import { ActualDataProvenancePanel } from './ActualDataProvenancePanel';

interface PlanVsActualGovernancePanelProps {
  governance: PlanVsActualGovernanceViewModel;
  diagnostics?: ActualReleaseDiagnostics | null;
  migration?: PlanVsActualMigrationPresentationViewModel | null;
  compact?: boolean;
}

const HandoffState: React.FC<{
  label: string;
  value: 'Blocked' | 'Eligible';
}> = ({ label, value }) => {
  const eligible = value === 'Eligible';

  return (
    <div className="min-w-0 border-l border-stone-200/90 pl-3 first:border-l-0 first:pl-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.105em] text-stone-500">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold tabular-nums text-slate-900">
        {eligible ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
        ) : (
          <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
        )}
        <span>{value}</span>
      </div>
    </div>
  );
};

/**
 * Calculation-free governance surface for the legacy Plan vs Actual migration.
 *
 * The panel deliberately does not derive, edit, validate, map, approve or release
 * Actual values. It renders the same governance view model that controls Actual
 * baseline and PIR handoff eligibility so the UI cannot visually imply a stronger
 * provenance state than the domain controls allow.
 *
 * When supplied, `migration` is a calculation-free presentation model produced by
 * the controlled migration gate. It is review-only evidence: this component never
 * copies governed Actual amounts into the legacy realization dataset.
 *
 * A demo preset and manually edited population therefore remain visibly blocked
 * from lifecycle/PIR use until a controlled Actual Import + Mapping Master workflow
 * supplies a released population and matching release diagnostics.
 */
export const PlanVsActualGovernancePanel: React.FC<PlanVsActualGovernancePanelProps> = ({
  governance,
  diagnostics,
  migration,
  compact = false,
}) => {
  const isControlled = governance.session.mode === 'workflow';
  const hasManualOverrides = governance.session.manualOverrideCount > 0;
  const provenanceState = isControlled ? 'Controlled workflow' : 'Legacy / unverified';

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200/90 bg-[#fdfcf9] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/90 bg-[#f7f5f0] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-[#fffefa] text-slate-800 shadow-[0_1px_1px_rgba(15,23,42,0.025)]">
            {isControlled ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <Database className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[12px] font-semibold tracking-[0.005em] text-slate-950">
                Plan vs Actual Governance
              </h3>
              <span className="rounded-md border border-stone-200 bg-[#fffefa] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.095em] text-stone-600">
                {provenanceState}
              </span>
            </div>
            <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
              Provenance and lifecycle eligibility are governed separately from the legacy realization calculations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200/80 bg-[#fffefa] px-3 py-2">
          <HandoffState label="Actual baseline" value={governance.baselineHandoffLabel} />
          <HandoffState label="PIR handoff" value={governance.pirHandoffLabel} />
        </div>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <ActualDataProvenancePanel
          presentation={governance.presentation}
          diagnostics={diagnostics}
          compact={compact}
        />

        {migration && <MigrationReview migration={migration} compact={compact} />}

        {!compact && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
            <Stage
              icon={<Database className="h-3.5 w-3.5" />}
              eyebrow="Population"
              title="Displayed Actual source"
              detail={governance.sourceLabel}
            />
            <ArrowRight className="hidden h-3.5 w-3.5 text-stone-300 lg:block" />
            <Stage
              icon={<FileCheck2 className="h-3.5 w-3.5" />}
              eyebrow="Control gate"
              title="Actual Import + Mapping Master"
              detail={isControlled ? 'Controlled workflow evidence attached' : 'No controlled import evidence attached'}
            />
            <ArrowRight className="hidden h-3.5 w-3.5 text-stone-300 lg:block" />
            <Stage
              icon={
                governance.baselineHandoffLabel === 'Eligible' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <LockKeyhole className="h-3.5 w-3.5" />
                )
              }
              eyebrow="Lifecycle"
              title="Governed evidence handoff"
              detail={
                governance.baselineHandoffLabel === 'Eligible'
                  ? 'Eligible for governed baseline handoff'
                  : 'Blocked pending controlled release evidence'
              }
            />
          </div>
        )}

        {hasManualOverrides && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/90 bg-[#fff9ed] px-3 py-2.5 text-[10px] leading-4 text-amber-950">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
            <div>
              <span className="font-semibold tabular-nums">
                {governance.session.manualOverrideCount} manual override{governance.session.manualOverrideCount === 1 ? '' : 's'} recorded.
              </span>{' '}
              The displayed population remains unverified and cannot inherit controlled-workflow provenance.
              {governance.session.lastManualOverrideReason && (
                <span className="block text-amber-800">
                  Latest: {governance.session.lastManualOverrideReason}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

function selectorBasis(candidate: PlanVsActualMigrationCandidateView): string {
  const selector = candidate.selector;
  const dimensions = [
    selector.finmodLineItem,
    selector.finmodCategory,
    selector.finmodSubcategory,
    selector.projectId,
  ].filter((value): value is string => Boolean(value));

  return dimensions.join(' · ');
}

function matchedRowIdentitySummary(candidate: PlanVsActualMigrationCandidateView): string {
  if (candidate.matchedRowIds.length === 0) return 'No retained row identities';
  if (candidate.matchedRowIds.length <= 2) return candidate.matchedRowIds.join(' · ');
  return `${candidate.matchedRowIds.slice(0, 2).join(' · ')} · +${candidate.matchedRowIds.length - 2} more`;
}

const MigrationReview: React.FC<{
  migration: PlanVsActualMigrationPresentationViewModel;
  compact: boolean;
}> = ({ migration, compact }) => {
  const reconciled = migration.state === 'RECONCILED_READ_ONLY' && migration.migrationEligible;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-stone-200/90 bg-[#fffefa]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 bg-[#faf8f3] px-3 py-2.5">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.105em] text-stone-500">
            Migration review
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-900">
            {reconciled ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <LockKeyhole className="h-3.5 w-3.5 text-amber-700" />
            )}
            {migration.statusLabel}
          </div>
        </div>
        {migration.evidence && (
          <div className="max-w-[420px] text-right text-[9px] leading-4 text-stone-500">
            <div className="truncate font-semibold tabular-nums text-stone-700" title={migration.evidence.sourceReference}>
              {migration.evidence.importBatchId} · {migration.evidence.sourceReference}
            </div>
            <div>Mapping {migration.evidence.mappingMasterVersion} · cutoff {migration.evidence.cutoffDate}</div>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5">
        {reconciled && migration.candidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-stone-200/80 text-left text-[9px] font-semibold uppercase tracking-[0.085em] text-stone-500">
                  <th className="pb-2 pr-3">Field</th>
                  {!compact && <th className="pb-2 pr-3">Governed basis</th>}
                  <th className="pb-2 pr-3 text-right">Governed Actual</th>
                  {!compact && <th className="pb-2 text-right">Matched source rows</th>}
                </tr>
              </thead>
              <tbody>
                {migration.candidates.map((candidate) => (
                  <tr key={candidate.fieldId} className="border-b border-stone-100 last:border-b-0">
                    <td className="py-2 pr-3 align-top">
                      <div className="font-medium text-slate-800">{candidate.displayLabel}</div>
                      <div className="mt-0.5 font-mono text-[9px] text-stone-400">{candidate.fieldId}</div>
                    </td>
                    {!compact && (
                      <td className="max-w-[320px] py-2 pr-3 align-top text-stone-600">
                        <div className="truncate font-medium text-stone-700" title={selectorBasis(candidate)}>
                          {selectorBasis(candidate)}
                        </div>
                        <div className="mt-0.5 text-[9px] text-stone-400">
                          {[candidate.selector.phase, candidate.selector.dataClass, candidate.selector.accountingTreatment]
                            .filter(Boolean)
                            .join(' · ') || 'No additional governed dimensions'}
                        </div>
                      </td>
                    )}
                    <td className="py-2 pr-3 text-right align-top">
                      <div className="font-semibold tabular-nums text-slate-950">
                        {candidate.governedActualAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                        {candidate.selector.currency || 'Currency not supplied'}
                      </div>
                    </td>
                    {!compact && (
                      <td className="max-w-[280px] py-2 text-right align-top">
                        <div className="font-semibold tabular-nums text-stone-700">{candidate.matchedRowCount}</div>
                        <div
                          className="mt-0.5 truncate font-mono text-[9px] text-stone-400"
                          title={candidate.matchedRowIds.join(' · ')}
                        >
                          {matchedRowIdentitySummary(candidate)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-[10px] leading-4 text-stone-600">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
            <div>
              <div className="font-semibold text-slate-800">No governed replacement candidate is authorized.</div>
              {!compact && migration.blockingReasons.length > 0 && (
                <div className="mt-1">{migration.blockingReasons[0]}</div>
              )}
            </div>
          </div>
        )}

        {!compact && (
          <div className="mt-2 border-t border-stone-100 pt-2 text-[9px] leading-4 text-stone-500">
            {migration.boundaryNote}
          </div>
        )}
      </div>
    </div>
  );
};

const Stage: React.FC<{
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
}> = ({ icon, eyebrow, title, detail }) => (
  <div className="min-w-0 rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-2.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
      <span className="text-slate-600">{icon}</span>
      {eyebrow}
    </div>
    <div className="mt-1 text-[10px] font-semibold text-slate-900">{title}</div>
    <div className="mt-0.5 truncate text-[10px] font-medium text-stone-600" title={detail}>
      {detail}
    </div>
  </div>
);
