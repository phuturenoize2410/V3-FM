import type { BaselineApprovalGovernanceBundle } from './baselineApprovalGovernanceBundle';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';
import type { ControlledActualBaselineResultWithRetainedManifest } from './controlledActualBaselineBridgeWithRetainedManifest';

export interface ControlledActualBaselineApprovalHandoffDiagnostics {
  passed: boolean;
  blockingReasons: string[];
}

export interface ControlledActualBaselineApprovalHandoffBundle {
  ready: boolean;
  controlledBaseline: ControlledActualBaselineResultWithRetainedManifest;
  approvalGovernance: BaselineApprovalGovernanceBundle;
  identity: ControlledActualBaselineApprovalHandoffDiagnostics;
  blockingReasons: string[];
  warnings: string[];
}

function sameOptionalString(a?: string, b?: string): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

function sameMetrics(
  a: Record<string, number | null>,
  b: Record<string, number | null>
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();

  if (aKeys.length !== bKeys.length) return false;
  if (aKeys.some((key, index) => key !== bKeys[index])) return false;

  return aKeys.every((key) => Object.is(a[key], b[key]));
}

function normalizedSourceRefs(snapshot: InvestmentBaselineSnapshot): string[] {
  return (snapshot.sourceRefs ?? [])
    .map((ref) =>
      [
        ref.sourceSystem ?? '',
        ref.sourceFile ?? '',
        ref.sourceVersion ?? '',
        ref.sourceUrl ?? '',
        ref.importedAt ?? '',
      ].join('\u001f')
    )
    .sort();
}

function sameSourceRefs(
  a: InvestmentBaselineSnapshot,
  b: InvestmentBaselineSnapshot
): boolean {
  const aRefs = normalizedSourceRefs(a);
  const bRefs = normalizedSourceRefs(b);

  return (
    aRefs.length === bRefs.length &&
    aRefs.every((value, index) => value === bRefs[index])
  );
}

function assessDraftIdentity(input: {
  controlledDraft: InvestmentBaselineSnapshot | null;
  approvalDraft: Readonly<InvestmentBaselineSnapshot>;
}): ControlledActualBaselineApprovalHandoffDiagnostics {
  const blockingReasons: string[] = [];
  const { controlledDraft, approvalDraft } = input;

  if (!controlledDraft) {
    return {
      passed: false,
      blockingReasons: [
        'Controlled Actual baseline approval handoff requires a releasable Actual-to-Date draft snapshot.',
      ],
    };
  }

  const scalarFieldsMatch =
    controlledDraft.id === approvalDraft.id &&
    controlledDraft.kind === approvalDraft.kind &&
    controlledDraft.name === approvalDraft.name &&
    sameOptionalString(controlledDraft.projectId, approvalDraft.projectId) &&
    controlledDraft.asOfDate === approvalDraft.asOfDate &&
    controlledDraft.createdAt === approvalDraft.createdAt &&
    controlledDraft.status === approvalDraft.status &&
    sameOptionalString(controlledDraft.approvedAt, approvalDraft.approvedAt) &&
    sameOptionalString(controlledDraft.approvedBy, approvalDraft.approvedBy) &&
    sameOptionalString(controlledDraft.predecessorId, approvalDraft.predecessorId) &&
    sameOptionalString(controlledDraft.modelVersion, approvalDraft.modelVersion) &&
    sameOptionalString(controlledDraft.notes, approvalDraft.notes);

  if (!scalarFieldsMatch) {
    blockingReasons.push(
      'Approval governance draft does not preserve the controlled Actual-to-Date baseline scalar identity.'
    );
  }

  if (!sameSourceRefs(controlledDraft, approvalDraft as InvestmentBaselineSnapshot)) {
    blockingReasons.push(
      'Approval governance draft source references do not reconcile to the controlled Actual-to-Date baseline.'
    );
  }

  if (!sameMetrics(controlledDraft.metrics, approvalDraft.metrics)) {
    blockingReasons.push(
      'Approval governance draft metrics do not reconcile field-for-field to the controlled Actual-to-Date baseline.'
    );
  }

  return {
    passed: blockingReasons.length === 0,
    blockingReasons,
  };
}

/**
 * Asset-generic, read-only handoff proving that an explicit baseline approval
 * governance run is operating on the exact Actual-to-Date draft produced from
 * retained-manifest-bound controlled Actual evidence.
 *
 * This control deliberately does not perform an approval. The caller must first
 * execute the explicit baseline approval governance step and supply that result.
 * The handoff then reconciles the approval bundle's retained draft against the
 * controlled baseline snapshot field-for-field across scalar identity, source
 * references and metrics, while also requiring the upstream controlled Actual
 * evidence and approval governance to be ready.
 *
 * `ready` therefore means evidence-chain continuity only. It does not
 * authenticate the source system, Mapping Master authority or approver; persist
 * or supersede a baseline; select a PIR case; define KPI semantics; calculate
 * economics; or introduce electricity, tariff, PPA or EBL assumptions.
 */
export function buildControlledActualBaselineApprovalHandoffBundle(input: {
  controlledBaseline: ControlledActualBaselineResultWithRetainedManifest;
  approvalGovernance: BaselineApprovalGovernanceBundle;
}): ControlledActualBaselineApprovalHandoffBundle {
  const { controlledBaseline, approvalGovernance } = input;
  const identity = assessDraftIdentity({
    controlledDraft: controlledBaseline.snapshot,
    approvalDraft: approvalGovernance.draftSnapshot,
  });

  const blockingReasons = [
    ...controlledBaseline.blockingReasons,
    ...controlledBaseline.controlledEvidence.blockingReasons,
    ...approvalGovernance.blockingReasons,
    ...identity.blockingReasons,
  ];

  if (!controlledBaseline.controlledEvidence.evidenceReady) {
    blockingReasons.push(
      'Controlled Actual retained-manifest evidence is not ready for baseline approval handoff.'
    );
  }

  if (!controlledBaseline.releasable || !controlledBaseline.snapshot) {
    blockingReasons.push(
      'Controlled Actual-to-Date baseline is not releasable for approval handoff.'
    );
  }

  if (!approvalGovernance.ready || !approvalGovernance.approvedSnapshot) {
    blockingReasons.push(
      'Explicit baseline approval governance is not ready for controlled Actual handoff.'
    );
  }

  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  return {
    ready:
      controlledBaseline.controlledEvidence.evidenceReady &&
      controlledBaseline.releasable &&
      controlledBaseline.snapshot !== null &&
      approvalGovernance.ready &&
      approvalGovernance.approvedSnapshot !== null &&
      identity.passed &&
      uniqueBlockingReasons.length === 0,
    controlledBaseline,
    approvalGovernance,
    identity,
    blockingReasons: uniqueBlockingReasons,
    warnings: [...new Set(approvalGovernance.warnings)],
  };
}
