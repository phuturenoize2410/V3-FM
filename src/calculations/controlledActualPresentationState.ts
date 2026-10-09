import {
  buildActualDataPresentationState,
  type ActualDataPresentationState,
} from './actualPresentationStatus';
import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';

/**
 * Presentation adapter for controlled Actual evidence.
 *
 * This is deliberately stricter than presenting a raw ActualWorkflowResult:
 * a clean validation/mapping workflow alone is not enough to label Actuals as
 * lifecycle-ready once retained Mapping Master snapshot evidence is required.
 *
 * The adapter never maps, repairs, approves, persists or recalculates Actuals.
 * It only prevents UI/PIR/lifecycle consumers from overstating provenance when
 * the governed evidence bundle is incomplete or blocked.
 */
export function buildControlledActualPresentationState(
  bundle: ControlledActualWorkflowBundle | null | undefined
): ActualDataPresentationState {
  if (!bundle) {
    return buildActualDataPresentationState({
      mode: 'workflow',
      workflow: null,
    });
  }

  if (!bundle.lifecycleEvidenceReady) {
    const workflowState = buildActualDataPresentationState({
      mode: 'workflow',
      workflow: bundle.workflow,
    });

    const blockingReasons = Array.from(
      new Set([
        ...workflowState.blockingReasons,
        ...bundle.blockingReasons,
      ])
    );

    return {
      ...workflowState,
      status: 'IMPORT_BLOCKED',
      verified: false,
      lifecycleEligible: false,
      label: 'Governed Actual Not Released',
      description:
        'The Actual population has not satisfied the complete controlled release evidence gate, including governed Mapping Master snapshot evidence. It must not be presented as lifecycle- or PIR-ready.',
      blockingReasons:
        blockingReasons.length > 0
          ? blockingReasons
          : ['Controlled Actual evidence bundle is not lifecycle-ready.'],
    };
  }

  const releasedState = buildActualDataPresentationState({
    mode: 'workflow',
    workflow: bundle.workflow,
  });

  if (!releasedState.verified || !releasedState.lifecycleEligible) {
    return {
      ...releasedState,
      status: 'IMPORT_BLOCKED',
      verified: false,
      lifecycleEligible: false,
      label: 'Governed Actual Not Released',
      description:
        'Governed evidence indicates readiness, but the underlying Actual workflow is not presentation-ready. The inconsistency must be resolved before lifecycle or PIR use.',
      blockingReasons: Array.from(
        new Set([
          ...releasedState.blockingReasons,
          'Controlled Actual bundle and underlying workflow presentation state are inconsistent.',
        ])
      ),
    };
  }

  return {
    ...releasedState,
    label: 'Verified Governed Actual',
    description:
      'Source population passed controlled import validation, Mapping Master controls and the governed release-evidence gate. The population is eligible to be presented to downstream lifecycle controls; baseline approval and PIR case selection remain separate governance actions.',
  };
}
