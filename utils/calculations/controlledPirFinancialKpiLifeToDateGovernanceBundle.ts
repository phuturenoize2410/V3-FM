import type { PirLifeToDateGovernanceBundle } from './pirLifeToDateGovernanceBundle';
import type { ControlledPirFinancialKpiPeriodGovernanceBundle } from './controlledPirFinancialKpiPeriodGovernanceBundle';

export interface ControlledPirFinancialKpiLifeToDatePopulationDiagnostics {
  readonly passed: boolean;
  readonly expectedPeriodCount: number;
  readonly suppliedPeriodCount: number;
  readonly expectedYears: ReadonlyArray<number>;
  readonly suppliedYears: ReadonlyArray<number>;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledPirFinancialKpiLifeToDateGovernanceBundle {
  readonly ready: boolean;
  readonly lifeToDateGovernance: PirLifeToDateGovernanceBundle;
  readonly periodGovernance: ReadonlyArray<ControlledPirFinancialKpiPeriodGovernanceBundle>;
  readonly population: ControlledPirFinancialKpiLifeToDatePopulationDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInspectableLifeToDateGovernance(value: unknown): value is PirLifeToDateGovernanceBundle {
  if (!isRecord(value) || !isRecord(value.reconciliation)) return false;
  return (
    typeof value.ready === 'boolean' &&
    Array.isArray(value.blockingReasons) &&
    value.blockingReasons.every((reason) => typeof reason === 'string') &&
    Array.isArray(value.reconciliation.periods) &&
    value.reconciliation.periods.every(
      (period) => isRecord(period) && typeof period.year === 'number' && Number.isFinite(period.year)
    )
  );
}

function isInspectablePeriodGovernance(
  value: unknown
): value is ControlledPirFinancialKpiPeriodGovernanceBundle {
  if (!isRecord(value) || !isRecord(value.operatingPeriodControl)) return false;
  return (
    typeof value.operatingPeriodControl.year === 'number' &&
    Number.isFinite(value.operatingPeriodControl.year) &&
    'result' in value.operatingPeriodControl &&
    typeof value.ready === 'boolean' &&
    Array.isArray(value.blockingReasons) &&
    value.blockingReasons.every((reason) => typeof reason === 'string')
  );
}

function assessPopulation(input: {
  lifeToDateGovernance: PirLifeToDateGovernanceBundle | unknown;
  periodGovernance: ReadonlyArray<ControlledPirFinancialKpiPeriodGovernanceBundle>;
}): ControlledPirFinancialKpiLifeToDatePopulationDiagnostics {
  const blockingReasons: string[] = [];
  const expectedPeriods = isInspectableLifeToDateGovernance(input.lifeToDateGovernance)
    ? input.lifeToDateGovernance.reconciliation.periods
    : [];
  if (!isInspectableLifeToDateGovernance(input.lifeToDateGovernance)) {
    blockingReasons.push('PIR financial KPI life-to-date governance envelope is malformed and cannot establish authoritative period continuity.');
  }
  const suppliedPeriods = input.periodGovernance;
  const expectedYears = expectedPeriods.map((period) => period.year);
  const inspectablePeriods = suppliedPeriods.filter(isInspectablePeriodGovernance);
  const suppliedYears = inspectablePeriods.map((period) => period.operatingPeriodControl.year);

  if (inspectablePeriods.length !== suppliedPeriods.length) {
    blockingReasons.push('PIR financial KPI life-to-date governance contains malformed period-governance evidence and cannot establish period continuity.');
  }
  if (suppliedPeriods.length !== expectedPeriods.length) {
    blockingReasons.push(`PIR financial KPI life-to-date governance requires one period-governance bundle for every reconciled PIR period: expected ${expectedPeriods.length}, received ${suppliedPeriods.length}.`);
  }

  const comparisonLength = Math.min(expectedPeriods.length, suppliedPeriods.length);
  for (let index = 0; index < comparisonLength; index += 1) {
    const expectedPeriod = expectedPeriods[index];
    const suppliedPeriod = suppliedPeriods[index];
    if (!isInspectablePeriodGovernance(suppliedPeriod)) {
      blockingReasons.push(`PIR financial KPI life-to-date governance period ${index + 1} is malformed and cannot be reconciled to the authoritative PIR period.`);
      continue;
    }
    if (suppliedPeriod.operatingPeriodControl.result !== expectedPeriod) {
      blockingReasons.push(`PIR financial KPI life-to-date governance period ${index + 1} must retain the exact in-memory PIR operating-period result used by the reconciled life-to-date population.`);
    }
    if (suppliedPeriod.operatingPeriodControl.year !== expectedPeriod.year) {
      blockingReasons.push(`PIR financial KPI life-to-date governance period ${index + 1} year does not match the reconciled PIR population year.`);
    }
  }

  const suppliedControls = inspectablePeriods.map((period) => period.operatingPeriodControl);
  if (new Set(suppliedControls).size !== suppliedControls.length) {
    blockingReasons.push('PIR financial KPI life-to-date governance cannot reuse one controlled PIR period for multiple positions in the life-to-date population.');
  }
  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  return Object.freeze({
    passed: uniqueBlockingReasons.length === 0,
    expectedPeriodCount: expectedPeriods.length,
    suppliedPeriodCount: suppliedPeriods.length,
    expectedYears: Object.freeze([...expectedYears]),
    suppliedYears: Object.freeze([...suppliedYears]),
    blockingReasons: uniqueBlockingReasons,
  });
}

/** Asset-generic, read-only PIR financial-KPI life-to-date provenance composition. Malformed/deserialized envelopes fail closed without repair or inference. */
export function buildControlledPirFinancialKpiLifeToDateGovernanceBundle(input: {
  lifeToDateGovernance: PirLifeToDateGovernanceBundle;
  periodGovernance: ReadonlyArray<ControlledPirFinancialKpiPeriodGovernanceBundle>;
}): ControlledPirFinancialKpiLifeToDateGovernanceBundle {
  const rawPeriodGovernance: unknown = input.periodGovernance;
  const periodPopulationValid = Array.isArray(rawPeriodGovernance);
  const periodGovernance = Object.freeze(
    periodPopulationValid ? [...rawPeriodGovernance] : []
  ) as ReadonlyArray<ControlledPirFinancialKpiPeriodGovernanceBundle>;
  const lifeToDateInspectable = isInspectableLifeToDateGovernance(input.lifeToDateGovernance);
  const population = assessPopulation({ lifeToDateGovernance: input.lifeToDateGovernance, periodGovernance });
  const inspectablePeriods = periodGovernance.filter(isInspectablePeriodGovernance);
  const envelopeBlockingReasons = periodPopulationValid
    ? []
    : ['PIR financial KPI life-to-date period-governance population is malformed and cannot be inspected.'];
  const blockingReasons = Object.freeze([
    ...new Set([
      ...envelopeBlockingReasons,
      ...(lifeToDateInspectable ? input.lifeToDateGovernance.blockingReasons : ['PIR financial KPI life-to-date governance envelope is malformed and cannot be inspected.']),
      ...inspectablePeriods.flatMap((period) => period.blockingReasons),
      ...population.blockingReasons,
    ]),
  ]);
  return Object.freeze({
    ready:
      lifeToDateInspectable &&
      periodPopulationValid &&
      input.lifeToDateGovernance.ready &&
      inspectablePeriods.length === periodGovernance.length &&
      inspectablePeriods.every((period) => period.ready) &&
      population.passed &&
      blockingReasons.length === 0,
    lifeToDateGovernance: input.lifeToDateGovernance,
    periodGovernance,
    population,
    blockingReasons,
  });
}
