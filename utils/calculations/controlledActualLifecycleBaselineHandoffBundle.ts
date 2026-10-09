import type { ControlledActualLifecyclePhaseEvidenceBundle } from './controlledActualLifecyclePhaseEvidenceBundle';
import type { ControlledActualWorkflowBaselineHandoffBundle } from './controlledActualWorkflowBaselineHandoffBundle';

export interface ControlledActualLifecycleBaselineHandoffBundle {
  readonly ready: boolean;
  readonly lifecycleEvidenceReady: boolean;
  readonly baselineHandoffReady: boolean;
  readonly sameWorkflow: boolean;
  readonly lifecycleEvidence: ControlledActualLifecyclePhaseEvidenceBundle;
  readonly baselineHandoff: ControlledActualWorkflowBaselineHandoffBundle;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Read-only continuity control from explicit lifecycle-phase Actual evidence into
 * the Actual-to-Date baseline handoff.
 *
 * Both supplied bundles must already be independently governed. This wrapper adds
 * one narrow requirement: the lifecycle-phase evidence and the baseline handoff
 * must retain the exact same in-memory ControlledActualWorkflowBundle. That keeps
 * downstream lifecycle monitoring from pairing phase evidence from one controlled
 * Actual run with a baseline candidate built from another merely similar run.
 *
 * The source-row selection retained by lifecycle evidence remains explicit caller
 * evidence. This handoff does not make those rows baseline metrics, does not infer
 * lifecycle-cost inclusion from phase, and does not decide accounting treatment,
 * capitalization, OPEX/CAPEX classification or KPI semantics.
 *
 * Governance boundaries:
 * - proves in-memory workflow continuity only; it does not claim persisted identity
 *   across serialization, registries or databases;
 * - does not approve, persist or supersede a baseline;
 * - does not select a PIR case or make an investment decision;
 * - does not authenticate source-system, Mapping Master or approver authority;
 * - does not alter Actual amounts, Mapping Master classifications or finance logic;
 * - remains asset-generic and introduces no electricity, tariff, PPA or EBL terms.
 */
export function buildControlledActualLifecycleBaselineHandoffBundle(
  lifecycleEvidence: ControlledActualLifecyclePhaseEvidenceBundle,
  baselineHandoff: ControlledActualWorkflowBaselineHandoffBundle
): ControlledActualLifecycleBaselineHandoffBundle {
  const lifecycleEvidenceReady =
    lifecycleEvidence.ready &&
    lifecycleEvidence.blockingReasons.length === 0;

  const baselineHandoffReady =
    baselineHandoff.ready &&
    baselineHandoff.blockingReasons.length === 0;

  const sameWorkflow =
    lifecycleEvidence.workflow === baselineHandoff.workflowBundle;

  const blockingReasons = [
    ...lifecycleEvidence.blockingReasons,
    ...baselineHandoff.blockingReasons,
  ];

  if (!sameWorkflow) {
    blockingReasons.push(
      'Lifecycle-phase evidence and Actual-to-Date baseline handoff must retain the exact same controlled Actual workflow bundle.'
    );
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);

  const ready =
    lifecycleEvidenceReady &&
    baselineHandoffReady &&
    sameWorkflow &&
    uniqueBlockingReasons.length === 0;

  return Object.freeze({
    ready,
    lifecycleEvidenceReady,
    baselineHandoffReady,
    sameWorkflow,
    lifecycleEvidence,
    baselineHandoff,
    blockingReasons: uniqueBlockingReasons,
  });
}
