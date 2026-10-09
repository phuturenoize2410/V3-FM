import type { ControlledEnergyPirOperatingGovernance } from './controlledEnergyPirOperatingGovernance';
import type {
  EnergyPirSourceIdentityDiagnostics,
  EnergyPirSourceSide,
} from './energyPirSourceIdentityDiagnostics';

export interface ControlledEnergyPirSourceGovernance {
  readonly ready: boolean;
  readonly side: EnergyPirSourceSide;
  readonly operatingGovernance: ControlledEnergyPirOperatingGovernance;
  readonly sourceIdentity: EnergyPirSourceIdentityDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Electricity-module source-identity boundary for one already-controlled PIR
 * operating period.
 *
 * `ControlledEnergyPirOperatingGovernance` is the canonical source-of-truth for
 * Energy Sales -> PIR source identity. This wrapper therefore does not reconstruct
 * a second Energy Sales result or re-run identity from parallel caller inputs.
 * Instead it requires the caller-selected side to match the exact retained
 * `sourceIdentity` already consumed by the controlled operating-period governance.
 *
 * This keeps downstream multi-period/life-to-date composition on one evidence
 * chain and avoids introducing a second, potentially drifting source population.
 * It remains electricity-module-specific so the asset-generic lifecycle/PIR core
 * does not acquire electricity assumptions.
 *
 * Passing proves in-memory structural continuity only. It does not authenticate a
 * metering/billing source system, establish Actual/Mapping Master provenance,
 * persist evidence, infer PPA/EBL/tariff tier/escalation/commitment, or turn
 * arithmetic effective tariff into a commercial entitlement.
 */
export function buildControlledEnergyPirSourceGovernance(input: {
  operatingGovernance: ControlledEnergyPirOperatingGovernance;
  side: EnergyPirSourceSide;
}): ControlledEnergyPirSourceGovernance {
  const sourceIdentity = input.operatingGovernance.sourceIdentity;
  const blockingReasons: string[] = [
    ...input.operatingGovernance.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message),
    ...sourceIdentity.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message),
  ];

  if (sourceIdentity.side !== input.side) {
    blockingReasons.push(
      'Requested Energy Sales/PIR source side does not match the exact source-identity evidence retained by the controlled operating-period governance.'
    );
  }

  if (sourceIdentity.year !== input.operatingGovernance.operatingPeriodControl.year) {
    blockingReasons.push(
      'Retained Energy Sales/PIR source identity does not match the controlled operating-period year.'
    );
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);

  return Object.freeze({
    ready:
      input.operatingGovernance.ready &&
      sourceIdentity.passed &&
      sourceIdentity.blockingIssueCount === 0 &&
      sourceIdentity.side === input.side &&
      sourceIdentity.year === input.operatingGovernance.operatingPeriodControl.year &&
      uniqueBlockingReasons.length === 0,
    side: input.side,
    operatingGovernance: input.operatingGovernance,
    sourceIdentity,
    blockingReasons: uniqueBlockingReasons,
  });
}
