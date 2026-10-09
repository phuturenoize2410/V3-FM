import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import { REQUIRED_ACTUAL_RELEASE_ERROR_CHECK_IDS } from './actualReleaseEvidenceManifest';
import {
  getActualProvenancePresentation,
  type ActualProvenanceSession,
} from './actualProvenanceController';

export interface PlanVsActualMigrationAssessment {
  sourceMode: ActualProvenanceSession['mode'];
  status: ReturnType<typeof getActualProvenancePresentation>['status'];
  verified: boolean;
  canCreateActualBaseline: boolean;
  canFeedPir: boolean;
  blockers: string[];
}

function isRuntimeObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface RuntimeDiagnosticsAssessment {
  readonly actualOnlyReleaseReady: boolean;
  readonly blockers: ReadonlyArray<string>;
}

function assessRuntimeDiagnostics(
  diagnostics?: ActualReleaseDiagnostics | null
): RuntimeDiagnosticsAssessment {
  if (!diagnostics) {
    return {
      actualOnlyReleaseReady: false,
      blockers: Object.freeze([
        'Controlled Actual release diagnostics are required before baseline or PIR handoff.',
      ]),
    };
  }

  const runtimeDiagnostics = diagnostics as unknown;
  if (!isRuntimeObject(runtimeDiagnostics)) {
    return {
      actualOnlyReleaseReady: false,
      blockers: Object.freeze([
        'Controlled Actual release diagnostics contain a malformed evidence envelope.',
      ]),
    };
  }

  const blockers: string[] = [];
  const runtimeChecks = runtimeDiagnostics.checks;
  const releaseReady = runtimeDiagnostics.releaseReady === true;
  const actualOnlyReleaseReady = runtimeDiagnostics.actualOnlyReleaseReady === true;

  if (typeof runtimeDiagnostics.releaseReady !== 'boolean') {
    blockers.push(
      'Controlled Actual release diagnostics must retain an explicit boolean releaseReady decision.'
    );
  }

  if (typeof runtimeDiagnostics.actualOnlyReleaseReady !== 'boolean') {
    blockers.push(
      'Controlled Actual release diagnostics must retain an explicit boolean actualOnlyReleaseReady decision.'
    );
  }

  if (!Array.isArray(runtimeChecks)) {
    blockers.push(
      'Controlled Actual release diagnostics must retain the authoritative release-check population.'
    );
  } else {
    const malformedCheck = runtimeChecks.some(
      (check) =>
        !isRuntimeObject(check) ||
        typeof check.id !== 'string' ||
        typeof check.passed !== 'boolean' ||
        !['error', 'warning', 'info'].includes(String(check.severity)) ||
        typeof check.label !== 'string' ||
        typeof check.detail !== 'string'
    );

    if (malformedCheck) {
      blockers.push(
        'Controlled Actual release diagnostics contain malformed release-check evidence.'
      );
    } else {
      const runtimeCheckObjects = runtimeChecks.filter(isRuntimeObject);
      const trimmedCheckIds = runtimeCheckObjects.map((check) => String(check.id).trim());
      const blankCheckIds = trimmedCheckIds.filter((checkId) => checkId.length === 0).length;
      const duplicateCheckIds = trimmedCheckIds.filter(
        (checkId, index) => trimmedCheckIds.indexOf(checkId) !== index
      );
      const checksById = new Map(
        runtimeCheckObjects.map((check) => [String(check.id).trim(), check] as const)
      );

      if (blankCheckIds > 0) {
        blockers.push(
          `Controlled Actual release diagnostics contain ${blankCheckIds} blank release-check ID(s); audit check identity must be explicit.`
        );
      }

      if (duplicateCheckIds.length > 0) {
        blockers.push(
          'Controlled Actual release diagnostics contain duplicate release-check IDs under trimmed comparison; audit check identity must be unique.'
        );
      }

      REQUIRED_ACTUAL_RELEASE_ERROR_CHECK_IDS.forEach((requiredCheckId) => {
        const retainedCheck = checksById.get(requiredCheckId);
        if (!retainedCheck) {
          blockers.push(
            `Controlled Actual release diagnostics are missing required error check "${requiredCheckId}".`
          );
          return;
        }

        if (retainedCheck.severity !== 'error') {
          blockers.push(
            `Controlled Actual release diagnostic "${requiredCheckId}" must remain error-severity evidence.`
          );
        }
      });

      const failedErrorChecks = runtimeCheckObjects.filter(
        (check) => check.severity === 'error' && check.passed !== true
      );

      if (releaseReady && failedErrorChecks.length > 0) {
        blockers.push(
          'Controlled Actual release diagnostics are internally inconsistent: releaseReady is true while error checks remain failed.'
        );
      }

      if (!releaseReady) {
        blockers.push('Controlled Actual release diagnostics are not release-ready.');
        failedErrorChecks.forEach((check) => {
          if (typeof check.id === 'string') {
            blockers.push(`Failed Controlled Actual release check: ${check.id}.`);
          }
        });
      }
    }
  }

  if (actualOnlyReleaseReady && !releaseReady) {
    blockers.push(
      'Controlled Actual release diagnostics are internally inconsistent: actualOnlyReleaseReady cannot be true while releaseReady is false.'
    );
  }

  if (releaseReady && !actualOnlyReleaseReady) {
    blockers.push(
      'Plan vs Actual migration requires an Actual-only released population; generic lifecycle release readiness is insufficient.'
    );
  }

  return {
    actualOnlyReleaseReady:
      releaseReady && actualOnlyReleaseReady && blockers.length === 0,
    blockers: Object.freeze(Array.from(new Set(blockers))),
  };
}

/**
 * Asset-generic migration gate for the legacy Plan vs Actual surface.
 *
 * The legacy screen currently supports preset-generated and manually edited
 * realization data. Those populations are useful for illustration and review,
 * but they are not verified Actuals. This guard makes the migration boundary
 * explicit before any consumer connects that screen to governed Actual
 * baselines or PIR.
 *
 * Runtime release-diagnostics evidence is validated against the authoritative
 * ActualReleaseDiagnostics contract and the canonical required error-check
 * identity published by the Actual release manifest rather than a parallel
 * blocker shape. Migration additionally requires `actualOnlyReleaseReady`:
 * generic lifecycle release readiness may legitimately carry non-Actual data
 * classes and therefore cannot by itself authorize an Actual-to-Date baseline
 * or Plan-vs-Actual feed.
 *
 * No economics are recalculated here. No source authenticity, accounting
 * completeness, approval or commercial term is inferred.
 */
export function assessPlanVsActualMigration(
  session: ActualProvenanceSession,
  diagnostics?: ActualReleaseDiagnostics | null
): PlanVsActualMigrationAssessment {
  const presentation = getActualProvenancePresentation(session);
  const blockers = [...presentation.blockingReasons];
  const diagnosticsAssessment = assessRuntimeDiagnostics(diagnostics);

  if (session.mode === 'demo') {
    blockers.push(
      'Preset-generated Plan vs Actual data are illustrative only and cannot create a governed Actual baseline.'
    );
  }

  if (session.mode === 'manual') {
    blockers.push(
      'Manually edited Plan vs Actual data are unverified and cannot create a governed Actual baseline.'
    );
  }

  if (session.manualOverrideCount > 0) {
    blockers.push(
      `${session.manualOverrideCount} manual override(s) are present in the displayed Actual population.`
    );
  }

  if (session.mode === 'workflow' && session.evidenceLevel !== 'GOVERNED_BUNDLE') {
    blockers.push(
      'Governed Mapping Master bundle evidence is required before baseline or PIR handoff; a raw workflow attachment is not sufficient.'
    );
  }

  if (session.mode === 'workflow') {
    blockers.push(...diagnosticsAssessment.blockers);
  }

  const verifiedWorkflow =
    session.mode === 'workflow' &&
    session.evidenceLevel === 'GOVERNED_BUNDLE' &&
    presentation.status === 'VERIFIED_RELEASED' &&
    presentation.verified &&
    presentation.lifecycleEligible &&
    diagnosticsAssessment.actualOnlyReleaseReady;

  const uniqueBlockers = Array.from(new Set(blockers));
  const releasable = verifiedWorkflow && uniqueBlockers.length === 0;

  return {
    sourceMode: session.mode,
    status: presentation.status,
    verified: verifiedWorkflow,
    canCreateActualBaseline: releasable,
    canFeedPir: releasable,
    blockers: uniqueBlockers,
  };
}
