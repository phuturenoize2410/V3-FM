import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';
import type { ControlledActualBaselineApprovalHandoffBundle } from './controlledActualBaselineApprovalHandoffBundle';
import {
  assessPirActualBaselineIdentity,
  type PirActualBaselineIdentityDiagnostics,
} from './pirActualBaselineIdentityDiagnostics';
import type { PirBaselineSelectionResult } from './pirBaselineSelectionControl';

export interface ControlledActualApprovalPirHandoffDiagnostics {
  passed: boolean;
  blockingReasons: string[];
}

export interface ControlledActualApprovalPirHandoffBundle {
  ready: boolean;
  baselineApprovalHandoff: ControlledActualBaselineApprovalHandoffBundle;
  baselineSelection: PirBaselineSelectionResult;
  draftToSelectedActualIdentity: PirActualBaselineIdentityDiagnostics;
  approvedArtifactIdentity: ControlledActualApprovalPirHandoffDiagnostics;
  blockingReasons: string[];
  warnings: string[];
}

function canonicalSourceRefs(snapshot: InvestmentBaselineSnapshot): string[] {
  return (snapshot.sourceRefs ?? [])
    .map((ref) =>
      JSON.stringify({
        importedAt: ref.importedAt ?? null,
        sourceFile: ref.sourceFile ?? null,
        sourceSystem: ref.sourceSystem ?? null,
        sourceUrl: ref.sourceUrl ?? null,
        sourceVersion: ref.sourceVersion ?? null,
      })
    )
    .sort();
}

function sameMetrics(
  a: Record<string, number | null>,
  b: Record<string, number | null>
): boolean {
  const names = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();

  return names.every(
    (name) =>
      Object.prototype.hasOwnProperty.call(a, name) ===
        Object.prototype.hasOwnProperty.call(b, name) &&
      Object.is(a[name], b[name])
  );
}

function sameApprovedArtifact(
  approvedByGovernance: Readonly<InvestmentBaselineSnapshot> | null,
  selectedActual: InvestmentBaselineSnapshot | null
): ControlledActualApprovalPirHandoffDiagnostics {
  const blockingReasons: string[] = [];

  if (!approvedByGovernance) {
    blockingReasons.push(
      'Approval-to-PIR handoff requires an approved Actual-to-Date snapshot from explicit baseline approval governance.'
    );
  }

  if (!selectedActual) {
    blockingReasons.push(
      'Approval-to-PIR handoff requires an explicitly selected approved Actual-to-Date baseline for PIR.'
    );
  }

  if (!approvedByGovernance || !selectedActual) {
    return { passed: false, blockingReasons };
  }

  const scalarIdentityMatches =
    approvedByGovernance.id === selectedActual.id &&
    approvedByGovernance.kind === selectedActual.kind &&
    approvedByGovernance.name === selectedActual.name &&
    approvedByGovernance.projectId === selectedActual.projectId &&
    approvedByGovernance.asOfDate === selectedActual.asOfDate &&
    approvedByGovernance.createdAt === selectedActual.createdAt &&
    approvedByGovernance.status === selectedActual.status &&
    approvedByGovernance.approvedAt === selectedActual.approvedAt &&
    approvedByGovernance.approvedBy === selectedActual.approvedBy &&
    approvedByGovernance.predecessorId === selectedActual.predecessorId &&
    approvedByGovernance.modelVersion === selectedActual.modelVersion &&
    approvedByGovernance.notes === selectedActual.notes;

  if (!scalarIdentityMatches) {
    blockingReasons.push(
      'PIR-selected Actual baseline does not preserve the exact approved baseline scalar and approval metadata identity.'
    );
  }

  const approvedSourceRefs = canonicalSourceRefs(
    approvedByGovernance as InvestmentBaselineSnapshot
  );
  const selectedSourceRefs = canonicalSourceRefs(selectedActual);

  if (
    approvedSourceRefs.length !== selectedSourceRefs.length ||
    approvedSourceRefs.some((value, index) => value !== selectedSourceRefs[index])
  ) {
    blockingReasons.push(
      'PIR-selected Actual baseline source references do not reconcile to the approved baseline artifact.'
    );
  }

  if (!sameMetrics(approvedByGovernance.metrics, selectedActual.metrics)) {
    blockingReasons.push(
      'PIR-selected Actual baseline metrics do not reconcile field-for-field to the approved baseline artifact.'
    );
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Asset-generic, read-only golden-path handoff from controlled Actual evidence
 * through explicit Actual-to-Date baseline approval into explicit PIR baseline
 * selection.
 *
 * This bundle deliberately composes existing governance instead of approving or
 * selecting anything itself. Readiness requires:
 * 1. the controlled Actual -> draft baseline -> explicit approval handoff to be
 *    ready;
 * 2. the PIR baseline selection control to be ready with explicit approved Plan
 *    and Actual selections;
 * 3. the selected Actual baseline to preserve the controlled evidence-bound draft
 *    economics/provenance, with only approval metadata allowed to differ; and
 * 4. the selected Actual baseline to be the exact approved artifact emitted by
 *    the approval governance run, including approval metadata, source references
 *    and metrics.
 *
 * Boundary: this handoff does not authenticate authority, persist or supersede a
 * baseline, choose a PIR case, define KPI/accounting semantics, calculate PIR or
 * project economics, or introduce electricity, tariff, PPA, EBL or other
 * commercial assumptions.
 */
export function buildControlledActualApprovalPirHandoffBundle(input: {
  baselineApprovalHandoff: ControlledActualBaselineApprovalHandoffBundle;
  baselineSelection: PirBaselineSelectionResult;
}): ControlledActualApprovalPirHandoffBundle {
  const { baselineApprovalHandoff, baselineSelection } = input;
  const controlledDraft = baselineApprovalHandoff.controlledBaseline.snapshot;
  const selectedActual = baselineSelection.actualBaseline;

  const draftToSelectedActualIdentity = assessPirActualBaselineIdentity({
    evidencedDraft: controlledDraft,
    selectedApprovedActual: selectedActual,
  });

  const approvedArtifactIdentity = sameApprovedArtifact(
    baselineApprovalHandoff.approvalGovernance.approvedSnapshot,
    selectedActual
  );

  const blockingReasons = [
    ...baselineApprovalHandoff.blockingReasons,
    ...baselineSelection.errors.map((issue) => issue.message),
    ...draftToSelectedActualIdentity.blockingReasons,
    ...approvedArtifactIdentity.blockingReasons,
  ];
  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  return {
    ready:
      baselineApprovalHandoff.ready &&
      baselineSelection.ready &&
      baselineSelection.planBaseline !== null &&
      selectedActual !== null &&
      draftToSelectedActualIdentity.passed &&
      approvedArtifactIdentity.passed &&
      uniqueBlockingReasons.length === 0,
    baselineApprovalHandoff,
    baselineSelection,
    draftToSelectedActualIdentity,
    approvedArtifactIdentity,
    blockingReasons: uniqueBlockingReasons,
    warnings: [...new Set(baselineApprovalHandoff.warnings)],
  };
}
