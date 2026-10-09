import type { ControlledActualLifecyclePirLifeToDateGovernanceBundle } from './controlledActualLifecyclePirLifeToDateGovernanceBundle';
import type { ControlledEnergyPirSourceGovernance } from './controlledEnergyPirSourceGovernance';

export interface ControlledEnergyPirLifeToDatePopulationContinuityDiagnostics {
  readonly passed: boolean;
  readonly populationCount: number;
  readonly controlledPeriodCount: number;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledEnergyPirLifeToDatePopulationHandoffBundle {
  readonly ready: boolean;
  readonly lifecycleLifeToDateGovernance: ControlledActualLifecyclePirLifeToDateGovernanceBundle;
  readonly controlledEnergyPeriods: ReadonlyArray<ControlledEnergyPirSourceGovernance>;
  readonly continuity: ControlledEnergyPirLifeToDatePopulationContinuityDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

function assessPopulationContinuity(input: {
  lifecycleLifeToDateGovernance: ControlledActualLifecyclePirLifeToDateGovernanceBundle;
  controlledEnergyPeriods: ReadonlyArray<ControlledEnergyPirSourceGovernance>;
}): ControlledEnergyPirLifeToDatePopulationContinuityDiagnostics {
  const reconciliationPeriods =
    input.lifecycleLifeToDateGovernance.lifeToDateGovernance.reconciliation.periods;
  const blockingReasons: string[] = [];

  if (input.controlledEnergyPeriods.length !== reconciliationPeriods.length) {
    blockingReasons.push(
      'Electricity PIR life-to-date handoff requires the controlled Energy Sales/PIR period population to have the same row count as the exact reconciled life-to-date population.'
    );
  }

  const maxLength = Math.max(
    input.controlledEnergyPeriods.length,
    reconciliationPeriods.length
  );

  for (let index = 0; index < maxLength; index += 1) {
    const controlled = input.controlledEnergyPeriods[index];
    const reconciled = reconciliationPeriods[index];

    if (!controlled || !reconciled) {
      continue;
    }

    if (!controlled.ready) {
      blockingReasons.push(
        `Electricity PIR period at index ${index} is not source-governed and cannot be promoted into life-to-date population continuity.`
      );
    }

    if (controlled.operatingGovernance.operatingPeriodControl.result !== reconciled) {
      blockingReasons.push(
        `Electricity PIR period at index ${index} is not the exact in-memory PIR result consumed by the reconciled life-to-date population.`
      );
    }

    if (controlled.operatingGovernance.operatingPeriodControl.year !== reconciled.year) {
      blockingReasons.push(
        `Electricity PIR period at index ${index} has a year mismatch against the reconciled life-to-date population.`
      );
    }
  }

  return Object.freeze({
    passed: blockingReasons.length === 0,
    populationCount: reconciliationPeriods.length,
    controlledPeriodCount: input.controlledEnergyPeriods.length,
    blockingReasons: Object.freeze([...new Set(blockingReasons)]),
  });
}

/**
 * Electricity-module, read-only population handoff from explicit Energy Sales/PIR
 * source governance into the already reconciled controlled Actual lifecycle PIR
 * life-to-date chain.
 *
 * The handoff is deliberately strict: every electricity period must be source-
 * governed, population counts must match, order must match, and each controlled
 * operating-period result must be the exact in-memory object already consumed by
 * life-to-date reconciliation. This prevents a visually similar Energy Sales/PIR
 * schedule from being attached to a different life-to-date population after the
 * fact.
 *
 * The wrapper does not assert that lifecycle-selected Actual rows are electricity
 * volume/revenue/OPEX/CFADS/DSCR source rows. It only proves continuity between
 * module-owned governed electricity periods and the PIR life-to-date population.
 * Actual accounting/KPI source semantics still require explicit upstream evidence.
 *
 * Object identity is intentional at this runtime boundary and does not claim
 * persisted identity across serialization, databases, registries or external
 * evidence stores. No tariff, PPA, EBL, escalation, lifecycle-cost inclusion,
 * accounting classification, baseline approval or investment decision is created
 * or inferred here.
 */
export function buildControlledEnergyPirLifeToDatePopulationHandoffBundle(input: {
  lifecycleLifeToDateGovernance: ControlledActualLifecyclePirLifeToDateGovernanceBundle;
  controlledEnergyPeriods: ReadonlyArray<ControlledEnergyPirSourceGovernance>;
}): ControlledEnergyPirLifeToDatePopulationHandoffBundle {
  const continuity = assessPopulationContinuity(input);

  const blockingReasons = Object.freeze([
    ...new Set([
      ...input.lifecycleLifeToDateGovernance.blockingReasons,
      ...input.controlledEnergyPeriods.flatMap((period) => period.blockingReasons),
      ...continuity.blockingReasons,
    ]),
  ]);

  return Object.freeze({
    ready:
      input.lifecycleLifeToDateGovernance.ready &&
      input.controlledEnergyPeriods.length > 0 &&
      input.controlledEnergyPeriods.every((period) => period.ready) &&
      continuity.passed &&
      blockingReasons.length === 0,
    lifecycleLifeToDateGovernance: input.lifecycleLifeToDateGovernance,
    controlledEnergyPeriods: Object.freeze([...input.controlledEnergyPeriods]),
    continuity,
    blockingReasons,
  });
}
