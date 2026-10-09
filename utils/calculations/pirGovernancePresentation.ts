import type { PirGovernanceBundle } from './pirGovernanceBundle';

export type PirGovernancePresentationStatus = 'ready' | 'blocked';

export interface PirGovernanceStagePresentation {
  id: 'actual_lifecycle' | 'actual_baseline' | 'baseline_selection';
  label: string;
  status: PirGovernancePresentationStatus;
  detail: string;
}

export interface PirGovernancePresentation {
  status: PirGovernancePresentationStatus;
  headline: string;
  summary: string;
  stages: PirGovernanceStagePresentation[];
  blockingReasons: string[];
  planBaselineId: string | null;
  actualBaselineId: string | null;
}

/**
 * Calculation-free presentation adapter for the final PIR governance handoff.
 *
 * This adapter only translates an already-built PirGovernanceBundle into a stable
 * institutional presentation shape. It does not re-perform governance checks,
 * calculate PIR economics, approve or supersede baselines, select a latest case,
 * mutate Actuals, infer KPI/accounting semantics, or introduce asset-specific or
 * commercial assumptions.
 *
 * Keeping this translation separate prevents UI components from reconstructing
 * readiness from partial lower-level signals and accidentally presenting a
 * stronger governance state than the authoritative PIR bundle permits.
 */
export function buildPirGovernancePresentation(
  bundle: PirGovernanceBundle
): PirGovernancePresentation {
  const actualLifecyclePassed = bundle.actualLifecycleGovernance.passed;
  const actualBaselineReady =
    bundle.evidencedActualBaseline.releasable &&
    bundle.evidencedActualBaseline.snapshot !== null;
  const baselineSelectionReady =
    bundle.baselineSelection.ready &&
    bundle.baselineSelection.planBaseline !== null &&
    bundle.baselineSelection.actualBaseline !== null;

  const stages: PirGovernanceStagePresentation[] = [
    {
      id: 'actual_lifecycle',
      label: 'Controlled Actual lifecycle',
      status: actualLifecyclePassed ? 'ready' : 'blocked',
      detail: actualLifecyclePassed
        ? 'Controlled Actual release evidence and lifecycle governance passed.'
        : 'Controlled Actual release evidence or lifecycle governance remains blocked.',
    },
    {
      id: 'actual_baseline',
      label: 'Actual-to-Date baseline',
      status: actualBaselineReady ? 'ready' : 'blocked',
      detail: actualBaselineReady
        ? 'Evidence-bound Actual-to-Date baseline candidate is releasable.'
        : 'Evidence-bound Actual-to-Date baseline candidate is not yet releasable.',
    },
    {
      id: 'baseline_selection',
      label: 'PIR comparison selection',
      status: baselineSelectionReady ? 'ready' : 'blocked',
      detail: baselineSelectionReady
        ? 'Explicit approved plan and Actual baseline selections passed governance.'
        : 'Explicit approved plan and Actual baseline selections are incomplete or blocked.',
    },
  ];

  return {
    status: bundle.ready ? 'ready' : 'blocked',
    headline: bundle.ready ? 'PIR governance ready' : 'PIR governance blocked',
    summary: bundle.ready
      ? 'Governed evidence handoff is ready for downstream PIR presentation; PIR economics remain a separate calculation responsibility.'
      : 'One or more governance gates remain unresolved. Downstream PIR presentation must not imply a released comparison.',
    stages,
    blockingReasons: [...bundle.blockingReasons],
    planBaselineId: bundle.baselineSelection.planBaseline?.id ?? null,
    actualBaselineId: bundle.baselineSelection.actualBaseline?.id ?? null,
  };
}
