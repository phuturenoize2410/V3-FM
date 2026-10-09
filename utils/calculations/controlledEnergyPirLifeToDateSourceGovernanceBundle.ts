import type { EnergyPirSourceSide } from './energyPirSourceIdentityDiagnostics';
import type { ControlledEnergyPirLifeToDatePopulationHandoffBundle } from './controlledEnergyPirLifeToDatePopulationHandoffBundle';

export interface ControlledEnergyPirLifeToDateSourceGovernanceDiagnostics {
  readonly passed: boolean;
  readonly side: EnergyPirSourceSide;
  readonly periodCount: number;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledEnergyPirLifeToDateSourceGovernanceBundle {
  readonly ready: boolean;
  readonly side: EnergyPirSourceSide;
  readonly populationHandoff: ControlledEnergyPirLifeToDatePopulationHandoffBundle;
  readonly diagnostics: ControlledEnergyPirLifeToDateSourceGovernanceDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Electricity-module governance boundary for one life-to-date PIR source side.
 *
 * Population continuity alone proves that every controlled Energy Sales/PIR period
 * is the exact in-memory result consumed by PIR life-to-date reconciliation. It
 * does not, by itself, prevent callers from mixing `model` and `actual` source-side
 * evidence across periods. This wrapper closes that ambiguity by requiring the
 * caller to state one source side for the whole governed population and proving
 * that every retained period carries that exact side.
 *
 * The rule is deliberately narrow and structural. It does not decide whether a
 * model or Actual population is economically preferable, does not establish Actual
 * source-system authority, and does not infer any tariff, PPA, EBL, escalation,
 * commitment, lifecycle-cost, OPEX, CFADS or DSCR semantics. Electricity remains a
 * module-owned concern; the asset-generic lifecycle/PIR core is unchanged.
 */
export function buildControlledEnergyPirLifeToDateSourceGovernanceBundle(input: {
  populationHandoff: ControlledEnergyPirLifeToDatePopulationHandoffBundle;
  side: EnergyPirSourceSide;
}): ControlledEnergyPirLifeToDateSourceGovernanceBundle {
  const blockingReasons: string[] = [
    ...input.populationHandoff.blockingReasons,
  ];

  for (let index = 0; index < input.populationHandoff.controlledEnergyPeriods.length; index += 1) {
    const period = input.populationHandoff.controlledEnergyPeriods[index];

    if (period.side !== input.side) {
      blockingReasons.push(
        `Electricity PIR life-to-date period at index ${index} is governed as ${period.side}, but the requested life-to-date source side is ${input.side}. Mixed model/Actual source-side populations are not permitted.`
      );
    }

    if (period.sourceIdentity.side !== input.side) {
      blockingReasons.push(
        `Electricity PIR life-to-date period at index ${index} does not retain source-identity evidence for the requested ${input.side} side.`
      );
    }
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const diagnostics = Object.freeze({
    passed:
      input.populationHandoff.controlledEnergyPeriods.length > 0 &&
      input.populationHandoff.controlledEnergyPeriods.every(
        (period) => period.side === input.side && period.sourceIdentity.side === input.side
      ) &&
      uniqueBlockingReasons.length === 0,
    side: input.side,
    periodCount: input.populationHandoff.controlledEnergyPeriods.length,
    blockingReasons: uniqueBlockingReasons,
  });

  return Object.freeze({
    ready:
      input.populationHandoff.ready &&
      diagnostics.passed &&
      uniqueBlockingReasons.length === 0,
    side: input.side,
    populationHandoff: input.populationHandoff,
    diagnostics,
    blockingReasons: uniqueBlockingReasons,
  });
}
