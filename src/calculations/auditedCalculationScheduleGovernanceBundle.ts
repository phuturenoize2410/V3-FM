import type {
  AnnualOperatingRow,
  DebtScheduleRow,
  FullModelAssumptions,
  ModelCheckItem,
  ModelMetrics,
  MonthlyCapexSchedule,
  SourcesAndUses,
} from '../types';
import type { AuditedOperatingResult } from './auditedOperatingEngine';
import { buildAuditedModelCheckBundle } from './auditedModelCheckBundle';
import { buildAuditedScheduleAliasDiagnostics } from './auditedScheduleAliasDiagnostics';
import { buildAuditedSchedulePopulationDiagnostics } from './auditedSchedulePopulationDiagnostics';

export interface AuditedCalculationScheduleControlGroup {
  id: 'model' | 'population' | 'alias' | 'bundle';
  label: string;
  checks: ReadonlyArray<Readonly<ModelCheckItem>>;
  failedCheckIds: ReadonlyArray<string>;
  passedCheckCount: number;
  failedCheckCount: number;
}

export interface AuditedCalculationScheduleGovernanceBundle {
  /**
   * True only when the exact supplied audited calculation population passes the
   * existing arithmetic/model controls, schedule-population identity controls,
   * compatibility-alias identity controls and bundle-level evidence controls.
   */
  ready: boolean;
  operatingPeriodCount: number;
  debtPeriodCount: number;
  firstOperatingYear: number | null;
  lastOperatingYear: number | null;
  /**
   * Read-only schedule snapshots retained from the exact audited calculation run
   * used to build this governance bundle. Downstream reporting should consume
   * these snapshots rather than separately pairing the control result with a
   * second schedule object that may come from another model run.
   */
  operatingRows: ReadonlyArray<Readonly<AnnualOperatingRow>>;
  debtSchedule: ReadonlyArray<Readonly<DebtScheduleRow>>;
  /**
   * Solver evidence from the same audited operating run. This remains diagnostic
   * evidence only; convergence does not waive any model, population or alias
   * identity check.
   */
  solver: {
    iterations: number;
    converged: boolean;
    maxDebtServiceDelta: number;
  };
  /**
   * Origin-preserving control groups from the same governance build. Consumers
   * can present or archive control evidence without inferring provenance from
   * check ids/categories or reconstructing the source diagnostics independently.
   */
  controlGroups: ReadonlyArray<AuditedCalculationScheduleControlGroup>;
  checks: ReadonlyArray<Readonly<ModelCheckItem>>;
  failedCheckIds: ReadonlyArray<string>;
  passedCheckCount: number;
  failedCheckCount: number;
}

function freezeChecks(checks: ModelCheckItem[]): ReadonlyArray<Readonly<ModelCheckItem>> {
  return Object.freeze(checks.map((check) => Object.freeze({ ...check })));
}

function buildControlGroup(
  id: AuditedCalculationScheduleControlGroup['id'],
  label: string,
  checks: ReadonlyArray<Readonly<ModelCheckItem>>
): AuditedCalculationScheduleControlGroup {
  // Preserve the exact canonical governed check objects. The group freezes only
  // its population container; it must not clone a second copy of check evidence.
  const retainedChecks = Object.freeze([...checks]);
  const failedCheckIds = Object.freeze(
    retainedChecks.filter((check) => !check.passed).map((check) => check.id)
  );

  return Object.freeze({
    id,
    label,
    checks: retainedChecks,
    failedCheckIds,
    passedCheckCount: retainedChecks.length - failedCheckIds.length,
    failedCheckCount: failedCheckIds.length,
  });
}

/**
 * Single-source, read-only governance wrapper for reconciled audited calculation
 * schedules.
 *
 * `buildAuditedModelCheckBundle` independently checks the finance mechanics and
 * source bridges and already includes compatibility-alias diagnostics.
 * `buildAuditedSchedulePopulationDiagnostics` verifies that the annual operating
 * and senior-debt schedules represent one explicit aligned period population.
 * The alias diagnostics are re-derived only to preserve their presentation origin;
 * they are not appended a second time to the governed check population.
 * Downstream lifecycle / portfolio consumers should not be able to pair model
 * checks from one calculation run with schedule rows from another run, or read
 * contradictory values from synonymous fields in the same run.
 *
 * This bundle therefore consumes one exact `AuditedOperatingResult`, builds all
 * schedule-facing control evidence from that same object, retains read-only
 * snapshots of the governed schedule population, and preserves the origin of
 * each control group for downstream audit / presentation handoff.
 *
 * Boundaries:
 * - no source schedule row, assumption, metric or calculation is mutated;
 * - no failed check or alias mismatch is repaired or waived;
 * - no compatibility alias is declared economically authoritative here;
 * - no missing year, debt tenor, refinancing, tax treatment or commercial term is
 *   inferred;
 * - no tariff, PPA/EBL or electricity-specific economics are introduced here;
 * - readiness is calculation-governance evidence only and is not investment,
 *   baseline or PIR approval.
 */
export function buildAuditedCalculationScheduleGovernanceBundle(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  monthlyCapexSchedule: MonthlyCapexSchedule[],
  operatingResult: AuditedOperatingResult,
  metrics: ModelMetrics
): AuditedCalculationScheduleGovernanceBundle {
  const modelChecks = buildAuditedModelCheckBundle(
    assumptions,
    sourcesAndUses,
    monthlyCapexSchedule,
    operatingResult,
    metrics
  );

  const populationChecks = buildAuditedSchedulePopulationDiagnostics(
    operatingResult.annualRows,
    operatingResult.debtSchedule
  );

  const aliasChecks = buildAuditedScheduleAliasDiagnostics(
    operatingResult.annualRows
  );
  const aliasCheckIds = new Set(aliasChecks.map((check) => check.id));

  // Alias diagnostics already live inside buildAuditedModelCheckBundle. Keep one
  // authoritative copy in the governed population so the schedule wrapper cannot
  // fail its own unique-ID gate merely by composing the same checks twice.
  const checksBeforeBundleControl = [...modelChecks, ...populationChecks];
  const blankCheckIdCount = checksBeforeBundleControl.filter(
    (check) => check.id.trim().length === 0
  ).length;
  const checkIdCounts = checksBeforeBundleControl.reduce<Record<string, number>>((acc, check) => {
    acc[check.id] = (acc[check.id] ?? 0) + 1;
    return acc;
  }, {});
  const duplicateCheckIds = Object.entries(checkIdCounts)
    .filter(([id, count]) => id.trim().length > 0 && count > 1)
    .map(([id]) => id)
    .sort();
  const bundleIdsValid = blankCheckIdCount === 0 && duplicateCheckIds.length === 0;
  const bundleIdIssueCount = blankCheckIdCount + duplicateCheckIds.length;

  const bundleIdIntegrityCheck: ModelCheckItem = {
    id: 'chk_audited_calculation_schedule_bundle_unique_ids',
    name: 'Audited Calculation Schedule Bundle ID Integrity',
    category: 'cash_flow',
    passed: bundleIdsValid,
    valueDescription: bundleIdsValid
      ? `${checksBeforeBundleControl.length} calculation-schedule checks | all IDs non-blank and unique`
      : `Blank IDs: ${blankCheckIdCount} | Duplicate IDs: ${duplicateCheckIds.length > 0 ? duplicateCheckIds.join(', ') : 'none'}`,
    tolerance: 0,
    delta: bundleIdIssueCount,
    details: bundleIdsValid
      ? 'The combined audited finance, schedule-population and alias-identity control set has non-blank unique stable IDs, preventing downstream state/UI consumers from silently collapsing, losing or making separate controls unaddressable.'
      : 'Blank or duplicate check IDs make calculation-schedule evidence unaddressable or ambiguous. Resolve identifier integrity rather than dropping, overwriting or synthesizing a control identity.',
  };

  // Freeze every authoritative check exactly once, then reuse those same objects
  // both in the canonical governed population and in origin-preserving groups.
  // This prevents downstream audit/reporting layers from receiving equivalent but
  // independently cloned evidence populations that could later drift apart.
  const retainedModelChecks = freezeChecks(modelChecks);
  const retainedPopulationChecks = freezeChecks(populationChecks);
  const retainedBundleChecks = freezeChecks([bundleIdIntegrityCheck]);
  const retainedModelChecksWithoutAlias = Object.freeze(
    retainedModelChecks.filter((check) => !aliasCheckIds.has(check.id))
  );
  const retainedAliasChecks = Object.freeze(
    retainedModelChecks.filter((check) => aliasCheckIds.has(check.id))
  );

  const governedChecks = Object.freeze([
    ...retainedModelChecks,
    ...retainedPopulationChecks,
    ...retainedBundleChecks,
  ]);

  const controlGroups = Object.freeze([
    buildControlGroup('model', 'Finance mechanics & source bridges', retainedModelChecksWithoutAlias),
    buildControlGroup('population', 'Schedule population identity', retainedPopulationChecks),
    buildControlGroup('alias', 'Compatibility alias identity', retainedAliasChecks),
    buildControlGroup('bundle', 'Governance bundle integrity', retainedBundleChecks),
  ]);

  const failedCheckIds = Object.freeze(
    governedChecks.filter((check) => !check.passed).map((check) => check.id)
  );

  const annualYears = operatingResult.annualRows.map((row) => row.year);
  const operatingRows = operatingResult.annualRows.map((row) => Object.freeze({ ...row, ...(row.workingOpexLines ? { workingOpexLines: Object.freeze(row.workingOpexLines.map(line => Object.freeze({ ...line }))) } : {}) }));
  const debtSchedule = operatingResult.debtSchedule.map((row) => Object.freeze({ ...row }));

  return Object.freeze({
    ready: governedChecks.length > 0 && failedCheckIds.length === 0,
    operatingPeriodCount: operatingRows.length,
    debtPeriodCount: debtSchedule.length,
    firstOperatingYear: annualYears.length > 0 ? annualYears[0] : null,
    lastOperatingYear:
      annualYears.length > 0 ? annualYears[annualYears.length - 1] : null,
    operatingRows: Object.freeze(operatingRows),
    debtSchedule: Object.freeze(debtSchedule),
    solver: Object.freeze({
      iterations: operatingResult.iterations,
      converged: operatingResult.converged,
      maxDebtServiceDelta: operatingResult.maxDebtServiceDelta,
    }),
    controlGroups,
    checks: governedChecks,
    failedCheckIds,
    passedCheckCount: governedChecks.length - failedCheckIds.length,
    failedCheckCount: failedCheckIds.length,
  });
}
