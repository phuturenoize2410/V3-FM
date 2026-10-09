import type { ActualReleaseEvidenceManifest } from './actualReleaseEvidenceManifest';
import type { ActualWorkflowResult } from './actualWorkflowEngine';
import {
  buildVerifiedActualToDateBaseline,
  type VerifiedActualBaselineInput,
  type VerifiedActualBaselineResult,
} from './verifiedActualBaselineBridge';

export interface EvidencedActualBaselineInput
  extends Omit<VerifiedActualBaselineInput, 'workflow'> {
  workflow: ActualWorkflowResult;
  evidenceManifest: ActualReleaseEvidenceManifest;
}

function sameNumber(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-9, Math.abs(b) * 1e-9);
}

/**
 * Adds an evidence-consistency gate before a verified Actual population can be
 * represented as an Actual-to-Date baseline candidate.
 *
 * This wrapper deliberately keeps baseline creation asset-generic. It does not
 * infer accounting classifications, KPI semantics, tariff terms, commercial
 * obligations or approvals. The evidence manifest must already have been built
 * from independent release diagnostics and must match the workflow population
 * that is being handed to the baseline bridge.
 *
 * The resulting snapshot remains draft. Evidence readiness is not approval.
 */
export function buildEvidencedActualToDateBaseline(
  input: EvidencedActualBaselineInput
): VerifiedActualBaselineResult {
  const { evidenceManifest, workflow, ...baselineInput } = input;
  const blockers: string[] = [];

  if (!evidenceManifest.evidenceReady) {
    blockers.push(
      ...evidenceManifest.blockingReasons,
      'Actual-to-Date baseline requires release evidence that is ready.'
    );
  }

  if (evidenceManifest.cutoffDate !== workflow.cutoffDate) {
    blockers.push(
      `Actual evidence cutoff ${evidenceManifest.cutoffDate || '(missing)'} does not match workflow cutoff ${workflow.cutoffDate || '(missing)'}.`
    );
  }

  if (evidenceManifest.releasePopulation.releasedRows !== workflow.releasedRows.length) {
    blockers.push(
      `Actual evidence released-row count (${evidenceManifest.releasePopulation.releasedRows}) does not match workflow released population (${workflow.releasedRows.length}).`
    );
  }

  const workflowReleasedAmount = workflow.releasedRows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  if (!sameNumber(evidenceManifest.releasePopulation.releasedAmount, workflowReleasedAmount)) {
    blockers.push(
      `Actual evidence released amount (${evidenceManifest.releasePopulation.releasedAmount}) does not reconcile to workflow released amount (${workflowReleasedAmount}).`
    );
  }

  if (blockers.length > 0) {
    const baseResult = buildVerifiedActualToDateBaseline({
      ...baselineInput,
      workflow,
    });

    return {
      ...baseResult,
      releasable: false,
      snapshot: null,
      blockingReasons: Array.from(new Set([...baseResult.blockingReasons, ...blockers])),
    };
  }

  return buildVerifiedActualToDateBaseline({
    ...baselineInput,
    workflow,
  });
}
