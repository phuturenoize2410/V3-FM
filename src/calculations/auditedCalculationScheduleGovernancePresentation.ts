import type {
  AuditedCalculationScheduleControlGroup,
  AuditedCalculationScheduleGovernanceBundle,
} from './auditedCalculationScheduleGovernanceBundle';

export type AuditedCalculationScheduleGovernanceStatus = 'READY' | 'BLOCKED';

export interface AuditedCalculationScheduleControlGroupPresentation {
  readonly id: AuditedCalculationScheduleControlGroup['id'];
  readonly label: string;
  readonly status: AuditedCalculationScheduleGovernanceStatus;
  readonly passedCheckCount: number;
  readonly failedCheckCount: number;
  readonly failedCheckIds: ReadonlyArray<string>;
}

export interface AuditedCalculationScheduleGovernancePresentation {
  readonly governanceReady: boolean;
  readonly status: AuditedCalculationScheduleGovernanceStatus;
  readonly operatingPeriodCount: number;
  readonly debtPeriodCount: number;
  readonly firstOperatingYear: number | null;
  readonly lastOperatingYear: number | null;
  readonly solver: Readonly<{
    iterations: number;
    converged: boolean;
    maxDebtServiceDelta: number;
  }>;
  readonly controlGroups: ReadonlyArray<AuditedCalculationScheduleControlGroupPresentation>;
  readonly passedCheckCount: number;
  readonly failedCheckCount: number;
  readonly failedCheckIds: ReadonlyArray<string>;
}

/**
 * Calculation-free presentation adapter for the authoritative reconciled audited
 * calculation-schedule governance bundle.
 *
 * The source bundle already binds finance/model checks, schedule-population
 * identity, compatibility-alias identity, exact retained operating/debt schedule
 * snapshots and solver evidence to one audited calculation run. This adapter only
 * exposes that authoritative governance state for downstream reporting/UI. It does
 * not accept a second schedule population and therefore cannot accidentally pair
 * controls from one model run with rows from another.
 *
 * Boundaries:
 * - no model check, schedule row, alias or solver result is recalculated or repaired;
 * - no failed control is waived and no compatibility field is declared economically
 *   authoritative;
 * - no missing/reordered periods, debt terms, tax treatment or commercial terms are
 *   inferred;
 * - no tariff, PPA/EBL or electricity-specific economics are introduced;
 * - presentation readiness is calculation-governance evidence only and is not
 *   baseline approval, PIR selection or an investment decision.
 *
 * Retained schedule rows intentionally remain on the authoritative bundle rather
 * than being copied into this lightweight status adapter. A reporting surface that
 * needs row-level amounts should receive the same bundle alongside this presentation
 * and read `bundle.operatingRows` / `bundle.debtSchedule` directly.
 */
export function buildAuditedCalculationScheduleGovernancePresentation(
  bundle: AuditedCalculationScheduleGovernanceBundle
): AuditedCalculationScheduleGovernancePresentation {
  const controlGroups = Object.freeze(
    bundle.controlGroups.map((group) =>
      Object.freeze({
        id: group.id,
        label: group.label,
        status:
          group.checks.length > 0 && group.failedCheckCount === 0
            ? ('READY' as const)
            : ('BLOCKED' as const),
        passedCheckCount: group.passedCheckCount,
        failedCheckCount: group.failedCheckCount,
        failedCheckIds: Object.freeze([...group.failedCheckIds]),
      })
    )
  );
  const presentationReady =
    bundle.ready &&
    controlGroups.length > 0 &&
    controlGroups.every((group) => group.status === 'READY');

  return Object.freeze({
    governanceReady: presentationReady,
    status: presentationReady ? ('READY' as const) : ('BLOCKED' as const),
    operatingPeriodCount: bundle.operatingPeriodCount,
    debtPeriodCount: bundle.debtPeriodCount,
    firstOperatingYear: bundle.firstOperatingYear,
    lastOperatingYear: bundle.lastOperatingYear,
    solver: Object.freeze({
      iterations: bundle.solver.iterations,
      converged: bundle.solver.converged,
      maxDebtServiceDelta: bundle.solver.maxDebtServiceDelta,
    }),
    controlGroups,
    passedCheckCount: bundle.passedCheckCount,
    failedCheckCount: bundle.failedCheckCount,
    failedCheckIds: Object.freeze([...bundle.failedCheckIds]),
  });
}
