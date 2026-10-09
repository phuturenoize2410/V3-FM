import type { ControlledActualLifecyclePirLifeToDateGovernanceBundle } from './controlledActualLifecyclePirLifeToDateGovernanceBundle';
import type { ControlledPirFinancialKpiLifeToDateGovernanceBundle } from './controlledPirFinancialKpiLifeToDateGovernanceBundle';

export interface ControlledActualLifecyclePirFinancialKpiLifeToDateContinuityDiagnostics {
  readonly passed: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle {
  readonly ready: boolean;
  readonly lifecycleLifeToDateGovernance: ControlledActualLifecyclePirLifeToDateGovernanceBundle;
  readonly financialKpiLifeToDateGovernance: ControlledPirFinancialKpiLifeToDateGovernanceBundle;
  readonly continuity: ControlledActualLifecyclePirFinancialKpiLifeToDateContinuityDiagnostics;
  readonly requestedRowIds: ReadonlyArray<string>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function assessContinuity(input: {
  lifecycleLifeToDateGovernance: ControlledActualLifecyclePirLifeToDateGovernanceBundle;
  financialKpiLifeToDateGovernance: ControlledPirFinancialKpiLifeToDateGovernanceBundle;
}): ControlledActualLifecyclePirFinancialKpiLifeToDateContinuityDiagnostics {
  const blockingReasons: string[] = [];

  if (
    input.financialKpiLifeToDateGovernance.lifeToDateGovernance !==
    input.lifecycleLifeToDateGovernance.lifeToDateGovernance
  ) {
    blockingReasons.push(
      'Controlled Actual lifecycle/PIR financial-KPI life-to-date governance requires the exact in-memory PIR life-to-date governance bundle already proven by the lifecycle chain; reconstructed or parallel life-to-date populations are not accepted at this boundary.'
    );
  }

  return Object.freeze({
    passed: blockingReasons.length === 0,
    blockingReasons: Object.freeze(blockingReasons),
  });
}

/**
 * Asset-generic, read-only composition boundary that carries explicit OPEX, CFADS
 * and DSCR source governance through the same reconciled PIR life-to-date population
 * already proven by the controlled Actual lifecycle -> approved Actual baseline ->
 * explicit PIR selection chain.
 *
 * The control is intentionally narrow: the financial-KPI life-to-date bundle must
 * retain the exact in-memory `PirLifeToDateGovernanceBundle` already consumed by
 * the lifecycle-governed life-to-date chain. This prevents a complete OPEX/CFADS/
 * DSCR provenance set from being paired with a different PIR population merely
 * because years or scalar KPI values appear equivalent.
 *
 * Lifecycle-selected Actual rows remain structural provenance only and are not
 * asserted to be the OPEX/CFADS/DSCR source population. The per-period financial-
 * KPI governance remains authoritative for caller-supplied source/population IDs
 * and values. Electricity-specific Energy Sales/revenue provenance remains owned
 * by its module and is not introduced as a finance-core requirement here. The
 * lifecycle row-ID population is snapshotted at this composition boundary so the
 * retained cross-governance evidence cannot drift through a mutable nested array.
 *
 * Boundary: this wrapper does not import/map Actuals, classify lifecycle rows,
 * calculate or repair OPEX/CFADS/DSCR, approve/persist/supersede/select baselines,
 * authenticate source systems or authorities, aggregate portfolio KPIs, or infer
 * tariff, escalation, PPA, EBL or other commercial terms. Exact object identity is
 * an in-memory continuity control only and does not claim persisted-record identity.
 */
export function buildControlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle(input: {
  lifecycleLifeToDateGovernance: ControlledActualLifecyclePirLifeToDateGovernanceBundle;
  financialKpiLifeToDateGovernance: ControlledPirFinancialKpiLifeToDateGovernanceBundle;
}): ControlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle {
  const continuity = assessContinuity(input);

  const blockingReasons = Object.freeze([
    ...new Set([
      ...input.lifecycleLifeToDateGovernance.blockingReasons,
      ...input.financialKpiLifeToDateGovernance.blockingReasons,
      ...continuity.blockingReasons,
    ]),
  ]);
  const requestedRowIds = Object.freeze([
    ...input.lifecycleLifeToDateGovernance.requestedRowIds,
  ]);

  return Object.freeze({
    ready:
      input.lifecycleLifeToDateGovernance.ready &&
      input.financialKpiLifeToDateGovernance.ready &&
      continuity.passed &&
      blockingReasons.length === 0,
    lifecycleLifeToDateGovernance: input.lifecycleLifeToDateGovernance,
    financialKpiLifeToDateGovernance: input.financialKpiLifeToDateGovernance,
    continuity,
    requestedRowIds,
    blockingReasons,
  });
}
