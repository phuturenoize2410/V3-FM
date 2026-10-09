import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualDataPresentationState } from './actualPresentationStatus';
import {
  createDemoActualProvenanceSession,
  getActualProvenancePresentation,
  loadDemoActualPopulation,
  markActualManualOverride,
  type ActualProvenanceSession,
} from './actualProvenanceController';
import {
  assessPlanVsActualMigration,
  type PlanVsActualMigrationAssessment,
} from './planVsActualMigrationGuard';

export type LegacyPlanVsActualInteraction =
  | { type: 'INITIALIZE_DEMO' }
  | { type: 'LOAD_PRESET'; presetId: string }
  | { type: 'EDIT_CAPEX'; field: string; itemId?: string }
  | { type: 'EDIT_OPERATIONS'; field: string; year?: number };

export interface PlanVsActualGovernanceViewModel {
  readonly session: ActualProvenanceSession;
  readonly presentation: ActualDataPresentationState;
  readonly migration: PlanVsActualMigrationAssessment;
  readonly sourceLabel:
    | 'Demo population'
    | 'Manual / unverified population'
    | 'Raw Actual workflow'
    | 'Governed controlled Actual';
  readonly baselineHandoffLabel: 'Blocked' | 'Eligible';
  readonly pirHandoffLabel: 'Blocked' | 'Eligible';
}

/**
 * Presentation/governance bridge for the legacy Plan vs Actual screen.
 *
 * The legacy surface still owns illustrative preset data and manual realization
 * editing. This module makes those user interactions translate into explicit
 * provenance transitions without touching any financial calculation.
 *
 * Important boundaries:
 * - Loading any preset resets provenance to DEMO / UNVERIFIED.
 * - Editing any displayed Actual value moves provenance to MANUAL / UNVERIFIED.
 * - A raw workflow attachment remains distinguishable from a governed bundle.
 * - Only `attachControlledActualWorkflowBundle` may create the
 *   GOVERNED_BUNDLE evidence level required by the migration guard for Actual
 *   baseline or PIR handoff.
 * - No Actual amount, mapping, accounting classification, commercial term or
 *   lifecycle baseline is calculated or inferred here.
 */
export function reduceLegacyPlanVsActualProvenance(
  current: ActualProvenanceSession,
  interaction: LegacyPlanVsActualInteraction
): ActualProvenanceSession {
  switch (interaction.type) {
    case 'INITIALIZE_DEMO':
      return createDemoActualProvenanceSession();

    case 'LOAD_PRESET':
      // Every preset is model-generated illustrative data, regardless of its
      // scenario name. Do not let a previously manual/verified badge survive.
      return loadDemoActualPopulation();

    case 'EDIT_CAPEX': {
      const location = interaction.itemId ? ` for item ${interaction.itemId}` : '';
      return markActualManualOverride(
        current,
        `Manual CAPEX Actual edit${location}: ${interaction.field}`
      );
    }

    case 'EDIT_OPERATIONS': {
      const period = interaction.year !== undefined ? ` for year ${interaction.year}` : '';
      return markActualManualOverride(
        current,
        `Manual operating Actual edit${period}: ${interaction.field}`
      );
    }
  }
}

/**
 * Single view-model builder for Plan vs Actual provenance UI and downstream
 * handoff controls. Keeping presentation status and migration assessment
 * together prevents a screen from showing a release-looking badge while using
 * a different eligibility calculation for Actual baseline or PIR handoff.
 *
 * The returned shell is runtime-frozen and retains the exact provenance,
 * presentation and migration objects produced for this build. Downstream UI or
 * reporting code therefore cannot mutate the eligibility labels independently
 * from the authoritative evidence objects and create a second apparent state.
 * Freezing this boundary is structural SSOT hardening only: it does not deepen
 * or replace the ownership rules of the nested provenance/control objects.
 */
export function buildPlanVsActualGovernanceViewModel(
  session: ActualProvenanceSession,
  diagnostics?: ActualReleaseDiagnostics | null
): PlanVsActualGovernanceViewModel {
  const presentation = getActualProvenancePresentation(session);
  const migration = assessPlanVsActualMigration(session, diagnostics);

  const sourceLabel: PlanVsActualGovernanceViewModel['sourceLabel'] =
    session.mode === 'workflow'
      ? session.evidenceLevel === 'GOVERNED_BUNDLE'
        ? 'Governed controlled Actual'
        : 'Raw Actual workflow'
      : session.mode === 'manual'
        ? 'Manual / unverified population'
        : 'Demo population';

  return Object.freeze({
    session,
    presentation,
    migration,
    sourceLabel,
    baselineHandoffLabel: migration.canCreateActualBaseline ? 'Eligible' : 'Blocked',
    pirHandoffLabel: migration.canFeedPir ? 'Eligible' : 'Blocked',
  });
}
