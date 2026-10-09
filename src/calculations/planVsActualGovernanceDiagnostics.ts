import {
  buildPlanVsActualGovernanceViewModel,
  reduceLegacyPlanVsActualProvenance,
} from './planVsActualPresentationBridge';
import { createDemoActualProvenanceSession } from './actualProvenanceController';

export type GovernanceDiagnosticSeverity = 'error' | 'warning';

export interface PlanVsActualGovernanceDiagnostic {
  id: string;
  label: string;
  severity: GovernanceDiagnosticSeverity;
  passed: boolean;
  detail: string;
}

export interface PlanVsActualGovernanceDiagnosticBundle {
  passed: boolean;
  checks: PlanVsActualGovernanceDiagnostic[];
  blockingReasons: string[];
}

/**
 * Deterministic, calculation-free governance checks for the legacy Plan vs Actual
 * migration boundary.
 *
 * These checks deliberately exercise only provenance transitions and handoff
 * eligibility. They do not calculate Actual economics, authenticate source
 * systems, approve baselines, infer accounting classifications, or create PIR
 * evidence. Their purpose is to detect regressions where demo or manually edited
 * populations could accidentally become eligible for governed lifecycle use.
 */
export function runPlanVsActualGovernanceDiagnostics(): PlanVsActualGovernanceDiagnosticBundle {
  const initial = createDemoActualProvenanceSession();
  const initialVm = buildPlanVsActualGovernanceViewModel(initial);

  const preset = reduceLegacyPlanVsActualProvenance(initial, {
    type: 'LOAD_PRESET',
    presetId: 'diagnostic-preset',
  });
  const presetVm = buildPlanVsActualGovernanceViewModel(preset);

  const capexEdited = reduceLegacyPlanVsActualProvenance(preset, {
    type: 'EDIT_CAPEX',
    field: 'actualIncurredIdrBillion',
    itemId: 'diagnostic-item',
  });
  const capexVm = buildPlanVsActualGovernanceViewModel(capexEdited);

  const operatingEdited = reduceLegacyPlanVsActualProvenance(capexEdited, {
    type: 'EDIT_OPERATIONS',
    field: 'actualOpexIdrB',
    year: 1,
  });
  const operatingVm = buildPlanVsActualGovernanceViewModel(operatingEdited);

  const checks: PlanVsActualGovernanceDiagnostic[] = [
    {
      id: 'pva-demo-remains-unverified',
      label: 'Demo population remains unverified',
      severity: 'error',
      passed:
        initialVm.session.mode === 'demo' &&
        initialVm.presentation.status === 'DEMO_UNVERIFIED' &&
        initialVm.migration.verified === false,
      detail:
        'A newly initialized legacy Plan vs Actual population must remain DEMO / UNVERIFIED.',
    },
    {
      id: 'pva-demo-handoff-blocked',
      label: 'Demo lifecycle handoff is blocked',
      severity: 'error',
      passed:
        initialVm.migration.canCreateActualBaseline === false &&
        initialVm.migration.canFeedPir === false,
      detail:
        'Preset-generated data must never create an Actual-to-Date baseline or feed PIR.',
    },
    {
      id: 'pva-preset-resets-demo-provenance',
      label: 'Preset load resets provenance to demo',
      severity: 'error',
      passed:
        presetVm.session.mode === 'demo' &&
        presetVm.presentation.status === 'DEMO_UNVERIFIED' &&
        presetVm.migration.canCreateActualBaseline === false &&
        presetVm.migration.canFeedPir === false,
      detail:
        'Loading any model-generated scenario preset must reset provenance to DEMO / UNVERIFIED.',
    },
    {
      id: 'pva-capex-edit-degrades-provenance',
      label: 'CAPEX edit degrades provenance',
      severity: 'error',
      passed:
        capexVm.session.mode === 'manual' &&
        capexVm.presentation.status === 'MANUAL_UNVERIFIED' &&
        capexVm.session.manualOverrideCount === 1 &&
        capexVm.migration.canCreateActualBaseline === false &&
        capexVm.migration.canFeedPir === false,
      detail:
        'A manual CAPEX Actual edit must move the displayed population to MANUAL / UNVERIFIED and block lifecycle handoff.',
    },
    {
      id: 'pva-operating-edit-keeps-manual-block',
      label: 'Operating edit keeps manual population blocked',
      severity: 'error',
      passed:
        operatingVm.session.mode === 'manual' &&
        operatingVm.presentation.status === 'MANUAL_UNVERIFIED' &&
        operatingVm.session.manualOverrideCount === 2 &&
        operatingVm.migration.canCreateActualBaseline === false &&
        operatingVm.migration.canFeedPir === false,
      detail:
        'Subsequent manual operating edits must remain unverified and increase the explicit override count.',
    },
    {
      id: 'pva-manual-reason-preserved',
      label: 'Manual override reason is preserved',
      severity: 'warning',
      passed:
        typeof operatingVm.session.lastManualOverrideReason === 'string' &&
        operatingVm.session.lastManualOverrideReason.includes('actualOpexIdrB'),
      detail:
        'The latest manual override should retain a specific audit-facing reason for presentation and troubleshooting.',
    },
  ];

  const blockingReasons = checks
    .filter((check) => check.severity === 'error' && !check.passed)
    .map((check) => `${check.label}: ${check.detail}`);

  return {
    passed: blockingReasons.length === 0,
    checks,
    blockingReasons,
  };
}
