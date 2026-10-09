import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';
import {
  buildActualDataPresentationState,
  type ActualDataPresentationState,
} from './actualPresentationStatus';

export type ActualProvenanceMode = 'demo' | 'manual' | 'workflow';
export type ActualProvenanceEvidenceLevel = 'UNVERIFIED' | 'WORKFLOW_ONLY' | 'GOVERNED_BUNDLE';

export interface ActualProvenanceSession {
  readonly mode: ActualProvenanceMode;
  readonly workflow: ActualWorkflowResult | null;
  readonly manualOverrideCount: number;
  readonly lastManualOverrideReason: string | null;
  /**
   * Records the strongest provenance attachment actually performed for the
   * displayed population. This is deliberately separate from workflow status:
   * a releasable raw workflow does not prove that governed Mapping Master
   * snapshot evidence was attached through the controlled bundle path.
   *
   * Optional for backward compatibility with any retained callers; a missing
   * value is treated as UNVERIFIED by lifecycle guards.
   */
  readonly evidenceLevel?: ActualProvenanceEvidenceLevel;
}

export interface ControlledActualAttachmentResult {
  readonly attached: boolean;
  readonly session: ActualProvenanceSession | null;
  readonly blockingReasons: ReadonlyArray<string>;
}

function freezeActualProvenanceSession(
  session: ActualProvenanceSession
): ActualProvenanceSession {
  return Object.freeze({ ...session });
}

function freezeControlledActualAttachmentResult(
  result: ControlledActualAttachmentResult
): ControlledActualAttachmentResult {
  return Object.freeze({
    ...result,
    blockingReasons: Object.freeze([...result.blockingReasons]),
  });
}

/**
 * Asset-generic presentation/provenance state for any Plan vs Actual surface.
 *
 * This controller deliberately does not calculate, transform, map, approve,
 * persist or release Actual values. Its only responsibility is to make the
 * provenance transition explicit when a displayed population changes source:
 *
 * - model/preset populations start as DEMO / UNVERIFIED;
 * - any manual override degrades the population to MANUAL / UNVERIFIED;
 * - a raw workflow attachment is recorded as WORKFLOW_ONLY and cannot by itself
 *   authorize lifecycle/PIR handoff;
 * - only the guarded controlled workflow bundle can record GOVERNED_BUNDLE,
 *   because that path also requires release diagnostics and governed Mapping
 *   Master snapshot evidence from the same source population;
 * - a manual edit after a governed workflow intentionally disconnects the
 *   presentation from that released population so edited values cannot retain
 *   a Verified Actual label.
 *
 * Returned provenance evidence is runtime-immutable. Exact caller-supplied
 * workflow/bundle objects remain retained by reference and are not deep-frozen
 * or rewritten by this presentation boundary.
 */
export function createDemoActualProvenanceSession(): ActualProvenanceSession {
  return freezeActualProvenanceSession({
    mode: 'demo',
    workflow: null,
    manualOverrideCount: 0,
    lastManualOverrideReason: null,
    evidenceLevel: 'UNVERIFIED',
  });
}

export function loadDemoActualPopulation(): ActualProvenanceSession {
  return createDemoActualProvenanceSession();
}

/**
 * Low-level attachment retained for calculation/presentation compatibility.
 * User-facing lifecycle surfaces should prefer
 * `attachControlledActualWorkflowBundle`, which also requires governed Mapping
 * Master snapshot evidence from the single-source controlled Actual bundle.
 *
 * Deliberately records WORKFLOW_ONLY so this compatibility path can never be
 * mistaken for the stronger governed bundle attachment by lifecycle/PIR guards.
 */
export function attachControlledActualWorkflow(
  workflow: ActualWorkflowResult
): ActualProvenanceSession {
  return freezeActualProvenanceSession({
    mode: 'workflow',
    workflow,
    manualOverrideCount: 0,
    lastManualOverrideReason: null,
    evidenceLevel: 'WORKFLOW_ONLY',
  });
}

/**
 * Guarded user-facing attachment for controlled Actual provenance.
 *
 * A raw releasable workflow is not enough to earn controlled provenance on a
 * lifecycle-facing surface. The same source population must also have passed
 * release diagnostics and governed Mapping Master snapshot evidence inside the
 * single-source bundle. This function never repairs evidence or upgrades a
 * blocked candidate; callers receive the original blockers instead.
 *
 * This remains calculation-neutral and asset-generic. It does not approve an
 * Actual-to-Date baseline, select a PIR case, infer accounting classifications,
 * or introduce electricity/commercial assumptions.
 */
export function attachControlledActualWorkflowBundle(
  bundle: ControlledActualWorkflowBundle
): ControlledActualAttachmentResult {
  if (!bundle.lifecycleEvidenceReady) {
    return freezeControlledActualAttachmentResult({
      attached: false,
      session: null,
      blockingReasons:
        bundle.blockingReasons.length > 0
          ? bundle.blockingReasons
          : ['Controlled Actual lifecycle evidence is not ready.'],
    });
  }

  const session = attachControlledActualWorkflow(bundle.workflow);

  return freezeControlledActualAttachmentResult({
    attached: true,
    session: freezeActualProvenanceSession({
      ...session,
      evidenceLevel: 'GOVERNED_BUNDLE',
    }),
    blockingReasons: [],
  });
}

/**
 * Records any manual edit as an explicit provenance downgrade.
 *
 * Runtime UI/event payloads can bypass the compile-time `string` contract. A
 * malformed override reason must therefore never throw before the provenance
 * downgrade is recorded. Non-string or blank evidence is replaced only with a
 * neutral audit label; no financial value, source identity or workflow evidence
 * is inferred or repaired.
 */
export function markActualManualOverride(
  current: ActualProvenanceSession,
  reason: unknown
): ActualProvenanceSession {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';

  return freezeActualProvenanceSession({
    mode: 'manual',
    // Manual edits make the displayed population different from the released
    // workflow population. Retaining the workflow reference here could allow a
    // consumer to imply that edited values are still verified, so disconnect it.
    workflow: null,
    manualOverrideCount: current.manualOverrideCount + 1,
    lastManualOverrideReason:
      normalizedReason.length > 0 ? normalizedReason : 'Manual Actual override',
    evidenceLevel: 'UNVERIFIED',
  });
}

export function getActualProvenancePresentation(
  session: ActualProvenanceSession
): ActualDataPresentationState {
  if (session.mode === 'workflow') {
    return buildActualDataPresentationState({
      mode: 'workflow',
      workflow: session.workflow,
    });
  }

  return buildActualDataPresentationState({ mode: session.mode });
}

/**
 * Guard for lifecycle/PIR consumers. Presentation readiness is necessary but
 * not sufficient: lifecycle eligibility additionally requires proof that the
 * session was attached through the governed single-source bundle path. This
 * prevents a clean raw workflow from bypassing Mapping Master snapshot evidence.
 */
export function isActualSessionLifecycleEligible(
  session: ActualProvenanceSession
): boolean {
  const presentation = getActualProvenancePresentation(session);

  return (
    session.mode === 'workflow' &&
    session.evidenceLevel === 'GOVERNED_BUNDLE' &&
    presentation.status === 'VERIFIED_RELEASED' &&
    presentation.verified &&
    presentation.lifecycleEligible
  );
}
