import {
  buildActualReleaseEvidenceManifest,
  type ActualReleaseEvidenceManifest,
  type ActualReleaseEvidenceMetadata,
} from './actualReleaseEvidenceManifest';
import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import {
  diagnoseActualReleasedPopulation,
  type ActualReleasedPopulationDiagnostics,
} from './actualReleasedPopulationDiagnostics';
import {
  diagnoseActualSourceLineage,
  type ActualSourceLineageDiagnostics,
} from './actualSourceLineageDiagnostics';
import type { ActualCutoffControl, ActualWorkflowResult } from './actualWorkflowEngine';

export interface ControlledActualReleaseEvidence {
  readonly evidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly manifest: ActualReleaseEvidenceManifest;
  readonly cutoffControl: Readonly<ActualCutoffControl>;
  readonly populationDiagnostics: ActualReleasedPopulationDiagnostics;
  readonly sourceLineageDiagnostics: ActualSourceLineageDiagnostics;
}

const AMOUNT_TOLERANCE = 1e-9;

function amountsMatch(left: number, right: number): boolean {
  return Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) <= AMOUNT_TOLERANCE;
}

/**
 * Builds the governed Actual-release evidence handoff from the exact workflow
 * population, independent release diagnostics and caller-supplied evidence
 * metadata.
 *
 * This wrapper closes the control gap between a release-ready diagnostic bundle
 * and the accepted-source -> released-population trace. It is deliberately
 * calculation-free and asset-generic:
 * - it never imports, maps, remaps, repairs or classifies Actual rows;
 * - it never invents batch IDs, source references or Mapping Master versions;
 * - it never approves an Actual-to-Date baseline or selects a PIR comparison;
 * - it only allows evidence-ready representation when the existing release
 *   manifest, cutoff control, population trace and immutable source-lineage trace
 *   all pass for the same workflow;
 * - it reconciles the diagnostics-derived manifest back to the exact workflow
 *   validation, mapping and released populations before allowing evidence-ready
 *   representation, so a parallel/stale diagnostics object cannot silently claim
 *   the same governed Actual release;
 * - it retains an immutable snapshot of the exact workflow cutoff control so
 *   downstream audit/reporting consumers do not need to reconstruct cutoff
 *   validity or rejected-after-cutoff counts from a loose date string;
 * - wrapper-owned readiness/blocker/manifest evidence is frozen before handoff so
 *   downstream consumers cannot mutate the governed release decision after it is
 *   constructed;
 * - retained population/source-lineage diagnostics are copied into frozen audit
 *   snapshots, including their issue records, so downstream consumers cannot
 *   mutate reconciliation evidence after the handoff is constructed. Their
 *   existing builders remain the authoritative source of those diagnostics and
 *   no diagnostic result is recalculated or semantically rewritten here.
 *
 * Existing lower-level builders remain unchanged for compatibility. Downstream
 * governed lifecycle/PIR handoffs should prefer this wrapper when the workflow
 * population is available.
 */
export function buildControlledActualReleaseEvidence(
  workflow: ActualWorkflowResult,
  diagnostics: ActualReleaseDiagnostics,
  metadata: ActualReleaseEvidenceMetadata
): ControlledActualReleaseEvidence {
  const manifest = buildActualReleaseEvidenceManifest(diagnostics, metadata);
  const populationDiagnostics = diagnoseActualReleasedPopulation(workflow);
  const sourceLineageDiagnostics = diagnoseActualSourceLineage(workflow);
  const blockingReasons = [...manifest.blockingReasons];
  const workflowActualRows = workflow.releasedRows.filter(
    (row) => row.dataClass === 'actual'
  ).length;
  const workflowReleasedAmount = workflow.releasedRows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  if (workflow.cutoffDate !== diagnostics.cutoffDate) {
    blockingReasons.push(
      'Actual workflow cutoff date does not match the release diagnostics cutoff date.'
    );
  }

  if (workflow.cutoffControl.suppliedCutoffDate !== workflow.cutoffDate) {
    blockingReasons.push(
      'Actual workflow cutoff control does not retain the same supplied cutoff date as the workflow result.'
    );
  }

  if (!workflow.cutoffControl.valid || !workflow.cutoffControl.evaluated) {
    blockingReasons.push(
      'Actual workflow cutoff control must be explicitly valid and evaluated before governed release evidence is ready.'
    );
  }

  const observedAfterCutoffRows = workflow.validation.issues.filter(
    (issue) => issue.code === 'after_cutoff'
  ).length;

  if (workflow.cutoffControl.rejectedAfterCutoffRows !== observedAfterCutoffRows) {
    blockingReasons.push(
      'Actual workflow cutoff control rejected-row count does not match the retained import-validation issues.'
    );
  }

  if (
    manifest.releasePopulation.sourceRows !== workflow.validation.control.inputRows ||
    manifest.releasePopulation.acceptedRows !== workflow.validation.control.acceptedRows ||
    manifest.releasePopulation.rejectedRows !== workflow.validation.control.rejectedRows
  ) {
    blockingReasons.push(
      'Actual release diagnostics source/accepted/rejected row population does not match the exact workflow validation population.'
    );
  }

  if (
    manifest.releasePopulation.mappedRows !== workflow.mappingGate.mappedRows ||
    manifest.releasePopulation.unmappedRows !== workflow.mappingGate.unmappedRows
  ) {
    blockingReasons.push(
      'Actual release diagnostics mapped/unmapped row population does not match the exact workflow Mapping Master gate.'
    );
  }

  if (
    manifest.releasePopulation.releasedRows !== workflow.releasedRows.length ||
    manifest.releasePopulation.actualRows !== workflowActualRows ||
    manifest.releasePopulation.nonActualRows !== workflow.releasedRows.length - workflowActualRows
  ) {
    blockingReasons.push(
      'Actual release diagnostics released data-class composition does not match the exact workflow released population.'
    );
  }

  if (
    !amountsMatch(
      manifest.releasePopulation.sourceAmount,
      workflow.validation.control.inputAmount
    ) ||
    !amountsMatch(manifest.releasePopulation.releasedAmount, workflowReleasedAmount)
  ) {
    blockingReasons.push(
      'Actual release diagnostics source/released amounts do not reconcile to the exact workflow populations.'
    );
  }

  if (workflow.releasedRows.length !== diagnostics.releasedRows) {
    blockingReasons.push(
      'Actual workflow released-row count does not match the release diagnostics population.'
    );
  }

  if (!populationDiagnostics.passed) {
    blockingReasons.push(
      'Accepted-source to released-Actual population diagnostics did not pass.'
    );
  }

  populationDiagnostics.issues.forEach((issue) => {
    blockingReasons.push(`Population trace ${issue.code}: ${issue.message}`);
  });

  if (!sourceLineageDiagnostics.passed) {
    blockingReasons.push(
      'Accepted-source to released-Actual immutable source lineage did not pass.'
    );
  }

  sourceLineageDiagnostics.issues.forEach((issue) => {
    blockingReasons.push(`Source lineage ${issue.code}: ${issue.message}`);
  });

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const evidenceReady = manifest.evidenceReady && uniqueBlockingReasons.length === 0;
  const cutoffControl = Object.freeze({ ...workflow.cutoffControl });
  const governedManifest = Object.freeze({
    ...manifest,
    evidenceReady,
    blockingReasons: uniqueBlockingReasons,
  });
  const immutablePopulationDiagnostics = Object.freeze({
    ...populationDiagnostics,
    issues: Object.freeze(
      populationDiagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ),
  }) as ActualReleasedPopulationDiagnostics;
  const immutableSourceLineageDiagnostics = Object.freeze({
    ...sourceLineageDiagnostics,
    issues: Object.freeze(
      sourceLineageDiagnostics.issues.map((issue) => Object.freeze({ ...issue }))
    ),
  }) as ActualSourceLineageDiagnostics;

  return Object.freeze({
    evidenceReady,
    blockingReasons: uniqueBlockingReasons,
    manifest: governedManifest,
    cutoffControl,
    populationDiagnostics: immutablePopulationDiagnostics,
    sourceLineageDiagnostics: immutableSourceLineageDiagnostics,
  });
}
