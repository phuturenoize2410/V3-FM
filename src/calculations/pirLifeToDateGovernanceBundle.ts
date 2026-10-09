import type { PirGovernanceBundle } from './pirGovernanceBundle';
import type { PirLifeToDateReconciliationBundle } from './pirLifeToDateReconciliationBundle';

export interface PirLifeToDateGovernanceBundle {
  ready: boolean;
  governanceReady: boolean;
  reconciliationReady: boolean;
  blockingReasons: string[];
  governance: PirGovernanceBundle;
  reconciliation: PirLifeToDateReconciliationBundle;
}

/**
 * Read-only downstream governance wrapper for reconciled PIR life-to-date evidence.
 *
 * The population, supplied summary and arithmetic diagnostics must already be
 * bound together by `PirLifeToDateReconciliationBundle`. This wrapper deliberately
 * consumes that evidence object rather than re-performing the reconciliation, so
 * downstream PIR governance cannot accidentally pair governance from one review
 * with a summary or diagnostics object from another operating-period population.
 *
 * Two independent requirements remain mandatory and neither substitutes for the
 * other:
 * 1. PIR governance must already be ready (controlled Actual evidence,
 *    evidence-bound Actual-to-Date baseline and explicit Plan/Actual baseline
 *    selection); and
 * 2. the supplied life-to-date reconciliation bundle must already be reconciled.
 *
 * Governance boundaries:
 * - does not select, approve, supersede or auto-promote a baseline;
 * - does not infer missing operating periods or reporting cutoffs;
 * - does not repair duplicate years or non-finite values;
 * - does not infer Energy Sales, tariff tiers, PPA/EBL terms or other commercial
 *   economics;
 * - does not mutate the reconciliation population, summary or governed Actual
 *   evidence;
 * - remains governance-only so electricity-specific source logic stays in its
 *   own module.
 */
export function buildPirLifeToDateGovernanceBundle(
  governance: PirGovernanceBundle,
  reconciliation: PirLifeToDateReconciliationBundle
): PirLifeToDateGovernanceBundle {
  const governanceReady =
    governance.ready &&
    governance.blockingReasons.length === 0;

  const reconciliationReady =
    reconciliation.reconciled &&
    reconciliation.diagnostics.passed &&
    reconciliation.diagnostics.blockingIssueCount === 0 &&
    reconciliation.blockingReasons.length === 0;

  const blockingReasons = Array.from(
    new Set([
      ...governance.blockingReasons,
      ...reconciliation.blockingReasons,
    ])
  );

  const ready =
    governanceReady &&
    reconciliationReady &&
    blockingReasons.length === 0;

  return {
    ready,
    governanceReady,
    reconciliationReady,
    blockingReasons,
    governance,
    reconciliation,
  };
}
