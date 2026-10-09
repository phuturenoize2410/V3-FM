import type { ControlledActualLifecyclePirGovernanceBundle } from './controlledActualLifecyclePirGovernanceBundle';
import type { PirLifeToDateGovernanceBundle } from './pirLifeToDateGovernanceBundle';

export interface ControlledActualLifecyclePirLifeToDateContinuityDiagnostics {
  readonly passed: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledActualLifecyclePirLifeToDateGovernanceBundle {
  readonly ready: boolean;
  readonly lifecyclePirGovernance: ControlledActualLifecyclePirGovernanceBundle;
  readonly lifeToDateGovernance: PirLifeToDateGovernanceBundle;
  readonly continuity: ControlledActualLifecyclePirLifeToDateContinuityDiagnostics;
  readonly requestedRowIds: ReadonlyArray<string>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function assessContinuity(input: {
  lifecyclePirGovernance: ControlledActualLifecyclePirGovernanceBundle;
  lifeToDateGovernance: PirLifeToDateGovernanceBundle;
}): ControlledActualLifecyclePirLifeToDateContinuityDiagnostics {
  const { lifecyclePirGovernance, lifeToDateGovernance } = input;
  const blockingReasons: string[] = [];

  if (
    lifecyclePirGovernance.approvalPirGovernance.pirGovernance !==
    lifeToDateGovernance.governance
  ) {
    blockingReasons.push(
      'Lifecycle-governed PIR life-to-date evidence requires the exact PIR governance bundle already proven by the controlled Actual lifecycle chain; reconstructed or parallel PIR governance is not accepted at this boundary.'
    );
  }

  return Object.freeze({
    passed: blockingReasons.length === 0,
    blockingReasons: Object.freeze(blockingReasons),
  });
}

/**
 * Module-specific, read-only composition boundary that carries the governed
 * controlled Actual lifecycle -> approved Actual baseline -> explicit PIR
 * selection chain into reconciled PIR life-to-date evidence without rebuilding
 * either provenance or PIR governance.
 *
 * The only new control here is continuity: the life-to-date governance bundle
 * must consume the exact in-memory PIR governance object already proven by the
 * controlled Actual lifecycle PIR chain. The life-to-date reconciliation bundle
 * remains authoritative for its own exact operating-period population, supplied
 * summary and arithmetic diagnostics.
 *
 * This wrapper deliberately does not assert that caller-selected lifecycle Actual
 * rows are the accounting or KPI source population for Energy Sales, revenue,
 * OPEX, CFADS or DSCR. Those semantics require explicit source/population mapping
 * at their owning module boundaries and must not be inferred from lifecycle row
 * selection or baseline provenance.
 *
 * Object identity is deliberate at this in-memory composition boundary. It does
 * not claim persisted-record identity across serialization, registries, databases
 * or external evidence stores.
 *
 * Boundary: this bundle does not import/map Actuals, approve/persist/supersede a
 * baseline, select a PIR case, infer lifecycle-cost/KPI/accounting semantics,
 * repair or create operating periods, calculate project economics, authenticate
 * source/Mapping Master/selector/approver authority, or introduce tariff, tier,
 * escalation, PPA, EBL or other commercial assumptions. PIR life-to-date energy
 * and revenue evidence remains an electricity-module concern rather than a
 * hardcoded requirement of the asset-generic finance core.
 */
export function buildControlledActualLifecyclePirLifeToDateGovernanceBundle(input: {
  lifecyclePirGovernance: ControlledActualLifecyclePirGovernanceBundle;
  lifeToDateGovernance: PirLifeToDateGovernanceBundle;
}): ControlledActualLifecyclePirLifeToDateGovernanceBundle {
  const { lifecyclePirGovernance, lifeToDateGovernance } = input;
  const continuity = assessContinuity({
    lifecyclePirGovernance,
    lifeToDateGovernance,
  });

  const blockingReasons = Object.freeze([
    ...new Set([
      ...lifecyclePirGovernance.blockingReasons,
      ...lifeToDateGovernance.blockingReasons,
      ...continuity.blockingReasons,
    ]),
  ]);

  return Object.freeze({
    ready:
      lifecyclePirGovernance.ready &&
      lifeToDateGovernance.ready &&
      continuity.passed &&
      blockingReasons.length === 0,
    lifecyclePirGovernance,
    lifeToDateGovernance,
    continuity,
    requestedRowIds: lifecyclePirGovernance.requestedRowIds,
    blockingReasons,
  });
}
