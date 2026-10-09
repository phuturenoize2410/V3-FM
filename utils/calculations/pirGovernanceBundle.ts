import type { ControlledActualLifecycleGovernance } from './controlledActualLifecycleGovernance';
import type { VerifiedActualBaselineResult } from './verifiedActualBaselineBridge';
import type { PirBaselineSelectionResult } from './pirBaselineSelectionControl';

export interface PirGovernanceBundle {
  ready: boolean;
  blockingReasons: string[];
  actualLifecycleGovernance: ControlledActualLifecycleGovernance;
  evidencedActualBaseline: VerifiedActualBaselineResult;
  baselineSelection: PirBaselineSelectionResult;
}

/**
 * Read-only downstream governance bundle for Post-Investment Review (PIR).
 *
 * PIR is represented as governance-ready only when all three independent gates
 * are already satisfied by their owning modules:
 * 1. controlled Actual release evidence + lifecycle governance;
 * 2. evidence-bound Actual-to-Date baseline eligibility;
 * 3. explicit approved plan/Actual baseline selection.
 *
 * This function deliberately does not import, map or mutate Actual rows; create,
 * approve or supersede baselines; select a latest/preferred case; calculate PIR
 * economics; infer KPI/accounting semantics; or introduce asset-specific terms.
 * It only prevents downstream presentation from treating partially governed
 * evidence as a fully governed PIR handoff.
 */
export function buildPirGovernanceBundle(
  actualLifecycleGovernance: ControlledActualLifecycleGovernance,
  evidencedActualBaseline: VerifiedActualBaselineResult,
  baselineSelection: PirBaselineSelectionResult
): PirGovernanceBundle {
  const blockingReasons = [
    ...actualLifecycleGovernance.blockingReasons,
    ...evidencedActualBaseline.blockingReasons,
    ...baselineSelection.errors.map((issue) => issue.message),
  ];
  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  const ready =
    actualLifecycleGovernance.passed &&
    evidencedActualBaseline.releasable &&
    evidencedActualBaseline.snapshot !== null &&
    baselineSelection.ready &&
    baselineSelection.planBaseline !== null &&
    baselineSelection.actualBaseline !== null &&
    uniqueBlockingReasons.length === 0;

  return {
    ready,
    blockingReasons: uniqueBlockingReasons,
    actualLifecycleGovernance,
    evidencedActualBaseline,
    baselineSelection,
  };
}
