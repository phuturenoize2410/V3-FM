import { useCallback, useMemo, useState } from 'react';
import type { ActualReleaseDiagnostics } from '../../calculations/actualReleaseDiagnostics';
import type { ControlledActualWorkflowBundle } from '../../calculations/controlledActualWorkflowBundle';
import type { PlanVsActualControlledMigrationHandoffBundle } from '../../calculations/planVsActualControlledMigrationHandoffBundle';
import type { PlanVsActualControlledReviewBundle } from '../../calculations/planVsActualControlledReviewBundle';
import type { PlanVsActualMigrationPresentationViewModel } from '../../calculations/planVsActualMigrationPresentation';
import {
  buildPlanVsActualGovernanceViewModel,
  reduceLegacyPlanVsActualProvenance,
  type LegacyPlanVsActualInteraction,
  type PlanVsActualGovernanceViewModel,
} from '../../calculations/planVsActualPresentationBridge';
import {
  attachControlledActualWorkflowBundle,
  createDemoActualProvenanceSession,
} from '../../calculations/actualProvenanceController';

export interface ControlledActualUiAttachment {
  attached: boolean;
  blockingReasons: string[];
}

export interface PlanVsActualGovernanceController {
  governance: PlanVsActualGovernanceViewModel;
  controlledDiagnostics: ActualReleaseDiagnostics | null;
  controlledMigration: PlanVsActualMigrationPresentationViewModel | null;
  controlledMigrationHandoff: PlanVsActualControlledMigrationHandoffBundle | null;
  recordPresetLoad: (presetId: string) => void;
  recordCapexEdit: (field: string, itemId?: string) => void;
  recordOperatingEdit: (field: string, year?: number) => void;
  attachControlledBundle: (bundle: ControlledActualWorkflowBundle) => ControlledActualUiAttachment;
  attachControlledReview: (review: PlanVsActualControlledReviewBundle) => ControlledActualUiAttachment;
  attachControlledHandoff: (
    handoff: PlanVsActualControlledMigrationHandoffBundle
  ) => ControlledActualUiAttachment;
  resetToDemo: () => void;
}

/**
 * Fail-closed UI admission for the compatibility review path.
 *
 * A controlled provenance attachment by itself is insufficient to present a
 * Plan-vs-Actual review as attached. The review must also be the same complete,
 * blocker-free reconciliation result that the authoritative review builder marked
 * ready. Retained/deserialized compatibility evidence is runtime-checked before
 * nested access so malformed envelopes fail closed rather than throwing.
 *
 * This helper performs no financial calculation and does not upgrade, normalize,
 * repair or infer evidence; it only prevents a partially governed or malformed
 * review from entering the UI as if it were a completed controlled review.
 */
export function assessControlledReviewUiAttachment(
  review: PlanVsActualControlledReviewBundle
): ControlledActualUiAttachment {
  const runtimeReview = review as unknown;
  const reviewEnvelopeValid =
    typeof runtimeReview === 'object' && runtimeReview !== null && !Array.isArray(runtimeReview);

  if (!reviewEnvelopeValid) {
    return {
      attached: false,
      blockingReasons: ['Controlled Plan vs Actual review envelope is malformed retained evidence.'],
    };
  }

  const retainedReview = runtimeReview as Record<string, unknown>;
  const attachment = retainedReview.attachment;
  const attachmentValid =
    typeof attachment === 'object' && attachment !== null && !Array.isArray(attachment);
  const migrationControl = retainedReview.migrationControl;
  const migrationControlValid =
    typeof migrationControl === 'object' && migrationControl !== null && !Array.isArray(migrationControl);
  const migrationPresentation = retainedReview.migrationPresentation;
  const migrationPresentationValid =
    typeof migrationPresentation === 'object' &&
    migrationPresentation !== null &&
    !Array.isArray(migrationPresentation);
  const rawBlockingReasons = retainedReview.blockingReasons;
  const reviewBlockingReasons = Array.isArray(rawBlockingReasons)
    ? rawBlockingReasons.filter((reason): reason is string => typeof reason === 'string')
    : null;
  const blockerPopulationContainsOnlyStrings =
    Array.isArray(rawBlockingReasons) &&
    reviewBlockingReasons !== null && reviewBlockingReasons.length === rawBlockingReasons.length;

  const sessionFromReview = attachmentValid
    ? (attachment as Record<string, unknown>).session
    : null;
  const blockingReasons = Array.from(
    new Set([
      ...(reviewBlockingReasons ?? []),
      ...(reviewBlockingReasons !== null
        ? []
        : ['Controlled Plan vs Actual review blocking-reason population is malformed retained evidence.']),
      ...(blockerPopulationContainsOnlyStrings
        ? []
        : reviewBlockingReasons === null
          ? []
          : ['Controlled Plan vs Actual review blocking-reason entries are malformed retained evidence.']),
      ...(attachmentValid
        ? []
        : ['Controlled Plan vs Actual review attachment envelope is malformed retained evidence.']),
      ...(migrationControlValid
        ? []
        : ['Controlled Plan vs Actual migration-control envelope is malformed retained evidence.']),
      ...(migrationPresentationValid
        ? []
        : ['Controlled Plan vs Actual migration-presentation envelope is malformed retained evidence.']),
      ...(retainedReview.reviewReady === true
        ? []
        : ['Controlled Plan vs Actual review is not ready for UI attachment.']),
    ])
  );

  const attached =
    retainedReview.reviewReady === true &&
    attachmentValid &&
    (attachment as Record<string, unknown>).attached === true &&
    Boolean(sessionFromReview) &&
    retainedReview.governance !== null &&
    retainedReview.governance !== undefined &&
    migrationControlValid &&
    (migrationControl as Record<string, unknown>).migrationEligible === true &&
    migrationPresentationValid &&
    (migrationPresentation as Record<string, unknown>).migrationEligible === true &&
    reviewBlockingReasons !== null &&
    blockerPopulationContainsOnlyStrings &&
    blockingReasons.length === 0;

  return { attached, blockingReasons };
}

/**
 * Fail-closed UI admission for the preferred governed migration handoff path.
 *
 * `handoffReady` is evidence produced when the handoff is built; it must not be
 * treated as a permanent authorization if a mutable nested review object is later
 * changed by a caller or after deserialization. Re-check the live retained review
 * readiness, migration eligibility/state, blocker population and exact object
 * continuity before attaching anything to the legacy UI.
 *
 * Retained/deserialized handoff evidence is runtime-checked before nested access.
 * Malformed envelopes or blocker entries fail closed rather than throwing or being
 * silently discarded. This is structural provenance validation only. It does not
 * recalculate Actuals, repair selectors, alter Mapping Master evidence or mutate
 * financial values.
 */
export function assessControlledHandoffUiAttachment(
  handoff: PlanVsActualControlledMigrationHandoffBundle
): ControlledActualUiAttachment {
  const runtimeHandoff = handoff as unknown;
  const handoffEnvelopeValid =
    typeof runtimeHandoff === 'object' && runtimeHandoff !== null && !Array.isArray(runtimeHandoff);

  if (!handoffEnvelopeValid) {
    return {
      attached: false,
      blockingReasons: [
        'Controlled Plan vs Actual migration handoff envelope is malformed retained evidence.',
      ],
    };
  }

  const retainedHandoff = runtimeHandoff as Record<string, unknown>;
  const runtimeReview = retainedHandoff.reviewBundle;
  const reviewEnvelopeValid =
    typeof runtimeReview === 'object' && runtimeReview !== null && !Array.isArray(runtimeReview);

  if (!reviewEnvelopeValid) {
    return {
      attached: false,
      blockingReasons: [
        'Controlled Plan vs Actual handoff review envelope is malformed retained evidence.',
      ],
    };
  }

  const review = runtimeReview as Record<string, unknown>;
  const attachment = review.attachment;
  const attachmentValid =
    typeof attachment === 'object' && attachment !== null && !Array.isArray(attachment);
  const reviewMigrationControl = review.migrationControl;
  const reviewMigrationControlValid =
    typeof reviewMigrationControl === 'object' &&
    reviewMigrationControl !== null &&
    !Array.isArray(reviewMigrationControl);
  const reviewMigrationPresentation = review.migrationPresentation;
  const reviewMigrationPresentationValid =
    typeof reviewMigrationPresentation === 'object' &&
    reviewMigrationPresentation !== null &&
    !Array.isArray(reviewMigrationPresentation);
  const handoffMigrationControl = retainedHandoff.migrationControl;
  const handoffMigrationPresentation = retainedHandoff.migrationPresentation;

  const exactControlContinuity =
    reviewMigrationControlValid && handoffMigrationControl === reviewMigrationControl;
  const exactPresentationContinuity =
    reviewMigrationPresentationValid &&
    handoffMigrationPresentation === reviewMigrationPresentation;

  const rawReviewBlockingReasons = review.blockingReasons;
  const reviewBlockingReasons = Array.isArray(rawReviewBlockingReasons)
    ? rawReviewBlockingReasons.filter((reason): reason is string => typeof reason === 'string')
    : null;
  const reviewBlockersContainOnlyStrings =
    Array.isArray(rawReviewBlockingReasons) &&
    reviewBlockingReasons !== null &&
    reviewBlockingReasons.length === rawReviewBlockingReasons.length;

  const rawHandoffBlockingReasons = retainedHandoff.blockingReasons;
  const handoffBlockingReasons = Array.isArray(rawHandoffBlockingReasons)
    ? rawHandoffBlockingReasons.filter((reason): reason is string => typeof reason === 'string')
    : null;
  const handoffBlockersContainOnlyStrings =
    Array.isArray(rawHandoffBlockingReasons) &&
    handoffBlockingReasons !== null &&
    handoffBlockingReasons.length === rawHandoffBlockingReasons.length;

  const sessionFromReview = attachmentValid
    ? (attachment as Record<string, unknown>).session
    : null;
  const reviewControl = reviewMigrationControlValid
    ? (reviewMigrationControl as Record<string, unknown>)
    : null;
  const reviewPresentation = reviewMigrationPresentationValid
    ? (reviewMigrationPresentation as Record<string, unknown>)
    : null;

  const blockingReasons = Array.from(
    new Set([
      ...(handoffBlockingReasons ?? []),
      ...(reviewBlockingReasons ?? []),
      ...(handoffBlockingReasons !== null
        ? []
        : ['Controlled migration handoff blocking-reason population is malformed retained evidence.']),
      ...(handoffBlockersContainOnlyStrings
        ? []
        : handoffBlockingReasons === null
          ? []
          : ['Controlled migration handoff blocking-reason entries are malformed retained evidence.']),
      ...(reviewBlockingReasons !== null
        ? []
        : ['Controlled Plan vs Actual review blocking-reason population is malformed retained evidence.']),
      ...(reviewBlockersContainOnlyStrings
        ? []
        : reviewBlockingReasons === null
          ? []
          : ['Controlled Plan vs Actual review blocking-reason entries are malformed retained evidence.']),
      ...(attachmentValid
        ? []
        : ['Controlled Plan vs Actual review attachment envelope is malformed retained evidence.']),
      ...(reviewMigrationControlValid
        ? []
        : ['Controlled Plan vs Actual migration-control envelope is malformed retained evidence.']),
      ...(reviewMigrationPresentationValid
        ? []
        : ['Controlled Plan vs Actual migration-presentation envelope is malformed retained evidence.']),
      ...(exactControlContinuity
        ? []
        : ['Controlled migration handoff does not retain the exact review migration-control object.']),
      ...(exactPresentationContinuity
        ? []
        : ['Controlled migration handoff does not retain the exact review migration-presentation object.']),
      ...(retainedHandoff.handoffReady === true
        ? []
        : ['Controlled Plan vs Actual migration handoff is not ready for UI attachment.']),
      ...(review.reviewReady === true
        ? []
        : ['Controlled Plan vs Actual review is not ready for UI attachment.']),
      ...(reviewControl?.state === 'RECONCILED_READ_ONLY'
        ? []
        : reviewMigrationControlValid
          ? ['Controlled Plan vs Actual migration control is no longer in reconciled read-only state.']
          : []),
      ...(reviewPresentation?.state === 'RECONCILED_READ_ONLY'
        ? []
        : reviewMigrationPresentationValid
          ? ['Controlled Plan vs Actual migration presentation is no longer in reconciled read-only state.']
          : []),
      ...(reviewControl?.migrationEligible === true
        ? []
        : reviewMigrationControlValid
          ? ['Controlled Plan vs Actual migration control is not eligible for UI attachment.']
          : []),
      ...(reviewPresentation?.migrationEligible === true
        ? []
        : reviewMigrationPresentationValid
          ? ['Controlled Plan vs Actual migration presentation is not eligible for UI attachment.']
          : []),
    ])
  );

  const attached =
    retainedHandoff.handoffReady === true &&
    review.reviewReady === true &&
    attachmentValid &&
    (attachment as Record<string, unknown>).attached === true &&
    Boolean(sessionFromReview) &&
    review.governance !== null &&
    review.governance !== undefined &&
    reviewMigrationControlValid &&
    reviewMigrationPresentationValid &&
    exactControlContinuity &&
    exactPresentationContinuity &&
    reviewControl?.state === 'RECONCILED_READ_ONLY' &&
    reviewPresentation?.state === 'RECONCILED_READ_ONLY' &&
    reviewControl?.migrationEligible === true &&
    reviewPresentation?.migrationEligible === true &&
    handoffBlockingReasons !== null &&
    handoffBlockersContainOnlyStrings &&
    reviewBlockingReasons !== null &&
    reviewBlockersContainOnlyStrings &&
    blockingReasons.length === 0;

  return { attached, blockingReasons };
}

/**
 * Thin React adapter for the legacy Plan vs Actual surface.
 *
 * This hook intentionally owns provenance/review state only. It does not own or
 * transform the realization dataset and therefore cannot change CAPEX, revenue,
 * OPEX, tax, CFADS, DSCR, IRR or any other financial result.
 *
 * Preferred controlled integration path:
 * - build one `PlanVsActualControlledReviewBundle` from the real controlled
 *   Actual bundle plus explicit field-reconciliation inputs;
 * - wrap that exact review in a `PlanVsActualControlledMigrationHandoffBundle`;
 * - attach it through `attachControlledHandoff`;
 * - render `governance`, `controlledDiagnostics` and `controlledMigration` from
 *   this controller together. Those views then originate from the same exact
 *   handoff object rather than from parallel UI reconstruction.
 *
 * `attachControlledReview` is retained as a compatibility path for callers that
 * already own the exact authoritative review but have not yet adopted the handoff
 * boundary. It now fails closed unless that review itself is blocker-free and
 * explicitly `reviewReady`. The older `attachControlledBundle` path remains
 * provenance-only and never creates migration presentation evidence.
 *
 * Preset loads or manual edits clear controlled diagnostics, migration review and
 * handoff evidence immediately. No controlled Actual amount is copied into the
 * legacy realization dataset by this adapter.
 */
export function usePlanVsActualGovernance(
  diagnostics?: ActualReleaseDiagnostics | null
): PlanVsActualGovernanceController {
  const [session, setSession] = useState(createDemoActualProvenanceSession);
  const [controlledDiagnostics, setControlledDiagnostics] = useState<ActualReleaseDiagnostics | null>(null);
  const [controlledMigration, setControlledMigration] = useState<PlanVsActualMigrationPresentationViewModel | null>(null);
  const [controlledMigrationHandoff, setControlledMigrationHandoff] =
    useState<PlanVsActualControlledMigrationHandoffBundle | null>(null);

  const dispatch = useCallback((interaction: LegacyPlanVsActualInteraction) => {
    setControlledDiagnostics(null);
    setControlledMigration(null);
    setControlledMigrationHandoff(null);
    setSession((current) => reduceLegacyPlanVsActualProvenance(current, interaction));
  }, []);

  const recordPresetLoad = useCallback(
    (presetId: string) => dispatch({ type: 'LOAD_PRESET', presetId }),
    [dispatch]
  );

  const recordCapexEdit = useCallback(
    (field: string, itemId?: string) => dispatch({ type: 'EDIT_CAPEX', field, itemId }),
    [dispatch]
  );

  const recordOperatingEdit = useCallback(
    (field: string, year?: number) => dispatch({ type: 'EDIT_OPERATIONS', field, year }),
    [dispatch]
  );

  const attachControlledBundle = useCallback(
    (bundle: ControlledActualWorkflowBundle): ControlledActualUiAttachment => {
      const result = attachControlledActualWorkflowBundle(bundle);

      if (result.attached && result.session) {
        setSession(result.session);
        setControlledDiagnostics(bundle.diagnostics);
        setControlledMigration(null);
        setControlledMigrationHandoff(null);
      }

      return {
        attached: result.attached,
        blockingReasons: [...result.blockingReasons],
      };
    },
    []
  );

  const attachControlledReview = useCallback(
    (review: PlanVsActualControlledReviewBundle): ControlledActualUiAttachment => {
      const assessment = assessControlledReviewUiAttachment(review);

      if (!assessment.attached) {
        return assessment;
      }

      const sessionFromReview = review.attachment.session;
      if (sessionFromReview) {
        setSession(sessionFromReview);
        setControlledDiagnostics(review.diagnostics);
        setControlledMigration(review.migrationPresentation);
        setControlledMigrationHandoff(null);
      }

      return assessment;
    },
    []
  );

  const attachControlledHandoff = useCallback(
    (handoff: PlanVsActualControlledMigrationHandoffBundle): ControlledActualUiAttachment => {
      const assessment = assessControlledHandoffUiAttachment(handoff);

      if (!assessment.attached) {
        return assessment;
      }

      const review = handoff.reviewBundle;
      const sessionFromReview = review.attachment.session;

      if (sessionFromReview) {
        setSession(sessionFromReview);
        setControlledDiagnostics(review.diagnostics);
        setControlledMigration(handoff.migrationPresentation);
        setControlledMigrationHandoff(handoff);
      }

      return assessment;
    },
    []
  );

  const resetToDemo = useCallback(() => {
    dispatch({ type: 'INITIALIZE_DEMO' });
  }, [dispatch]);

  const effectiveDiagnostics = session.mode === 'workflow' ? controlledDiagnostics : diagnostics;

  const governance = useMemo(
    () => buildPlanVsActualGovernanceViewModel(session, effectiveDiagnostics),
    [session, effectiveDiagnostics]
  );

  return {
    governance,
    controlledDiagnostics,
    controlledMigration,
    controlledMigrationHandoff,
    recordPresetLoad,
    recordCapexEdit,
    recordOperatingEdit,
    attachControlledBundle,
    attachControlledReview,
    attachControlledHandoff,
    resetToDemo,
  };
}
