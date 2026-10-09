import { FullModelAssumptions, ModelMetrics } from '../types';
import { calculateModelMetrics } from './financialEngine';
import {
  calculateAuditedMonthlyCapex,
  calculateAuditedSourcesAndUses,
} from './constructionFundingEngine';
import { calculateAuditedDebtAndOperations } from './auditedOperatingEngine';
import {
  EconomicDriverId,
  ECONOMIC_DRIVER_REGISTRY,
  applyEconomicDriverShock,
  getEconomicDriver,
} from './economicDriverRegistry';

export type SensitivityDriverId = EconomicDriverId;

export type SensitivityMetricId =
  | 'equityIrr'
  | 'projectIrr'
  | 'minDscr'
  | 'avgDscr'
  | 'minLlcr'
  | 'projectNpv'
  | 'equityNpv'
  | 'lcoe';

export interface SensitivityDriverDefinition {
  id: SensitivityDriverId;
  label: string;
  unit: string;
  shockMode: 'relative_pct' | 'absolute';
  defaultSteps: number[];
}

export interface DynamicSensitivityMatrix {
  rowDriver: SensitivityDriverDefinition;
  colDriver: SensitivityDriverDefinition;
  metric: SensitivityMetricId;
  rowLabels: string[];
  colLabels: string[];
  matrix: number[][];
}

export interface OneWaySensitivityRow {
  shock: number;
  label: string;
  projectIrr: number;
  equityIrr: number;
  minDscr: number;
  avgDscr: number;
  minLlcr: number;
  projectNpv: number;
  equityNpv: number;
  lcoe: number;
}

/**
 * Backward-compatible sensitivity presentation list derived from the central
 * economic-driver registry. UI consumers no longer own a separate list of
 * business drivers or shock steps.
 */
export const SENSITIVITY_DRIVERS: SensitivityDriverDefinition[] = ECONOMIC_DRIVER_REGISTRY.map(
  ({ id, label, unit, shockMode, defaultSteps }) => ({
    id,
    label,
    unit,
    shockMode,
    defaultSteps: [...defaultSteps],
  })
);

export const SENSITIVITY_METRICS: { id: SensitivityMetricId; label: string; format: 'pct' | 'multiple' | 'currency' | 'lcoe' }[] = [
  { id: 'equityIrr', label: 'Equity IRR', format: 'pct' },
  { id: 'projectIrr', label: 'Project IRR', format: 'pct' },
  { id: 'minDscr', label: 'Minimum DSCR', format: 'multiple' },
  { id: 'avgDscr', label: 'Average DSCR', format: 'multiple' },
  { id: 'minLlcr', label: 'Minimum LLCR', format: 'multiple' },
  { id: 'projectNpv', label: 'Project NPV', format: 'currency' },
  { id: 'equityNpv', label: 'Equity NPV', format: 'currency' },
  { id: 'lcoe', label: 'LCOE', format: 'lcoe' },
];

export function getSensitivityDriver(id: SensitivityDriverId): SensitivityDriverDefinition {
  const driver = getEconomicDriver(id);
  return {
    id: driver.id,
    label: driver.label,
    unit: driver.unit,
    shockMode: driver.shockMode,
    defaultSteps: [...driver.defaultSteps],
  };
}

export function formatSensitivityShock(driverId: SensitivityDriverId, shock: number): string {
  const driver = getSensitivityDriver(driverId);
  const sign = shock > 0 ? '+' : '';
  if (shock === 0) return 'Base';
  if (driver.shockMode === 'absolute') return `${sign}${shock.toFixed(shock % 1 === 0 ? 0 : 1)} ${driver.unit}`;
  return `${sign}${shock.toFixed(shock % 1 === 0 ? 0 : 1)}%`;
}

export function applySensitivityShock(
  baseAssumptions: FullModelAssumptions,
  driverId: SensitivityDriverId,
  shock: number
): FullModelAssumptions {
  return applyEconomicDriverShock(baseAssumptions, driverId, shock);
}

export function evaluateSensitivityCase(assumptions: FullModelAssumptions): ModelMetrics {
  // Sensitivity must use exactly the same audited economics as the live model.
  const capex = calculateAuditedMonthlyCapex(assumptions);
  const sourcesUses = calculateAuditedSourcesAndUses(assumptions, capex);
  const operating = calculateAuditedDebtAndOperations(assumptions, sourcesUses);
  return calculateModelMetrics(
    assumptions,
    capex,
    operating.annualRows,
    sourcesUses
  );
}

export function metricValue(metrics: ModelMetrics, metricId: SensitivityMetricId): number {
  switch (metricId) {
    case 'equityIrr': return metrics.equityIrrPct;
    case 'projectIrr': return metrics.projectIrrPct;
    case 'minDscr': return metrics.minDscr;
    case 'avgDscr': return metrics.avgDscr;
    case 'minLlcr': return metrics.minLlcr;
    case 'projectNpv': return metrics.projectNpvIdrBillion;
    case 'equityNpv': return metrics.equityNpvIdrBillion;
    case 'lcoe': return metrics.lcoeIdrPerKWh;
  }
}

export function generateDynamicSensitivityMatrix(
  baseAssumptions: FullModelAssumptions,
  rowDriverId: SensitivityDriverId,
  colDriverId: SensitivityDriverId,
  metric: SensitivityMetricId,
  rowSteps?: number[],
  colSteps?: number[]
): DynamicSensitivityMatrix {
  const rowDriver = getSensitivityDriver(rowDriverId);
  const colDriver = getSensitivityDriver(colDriverId);
  const rows = rowSteps ?? rowDriver.defaultSteps;
  const cols = colSteps ?? colDriver.defaultSteps;

  const matrix = rows.map((rowShock) => cols.map((colShock) => {
    let scenario = applySensitivityShock(baseAssumptions, rowDriverId, rowShock);
    scenario = applySensitivityShock(scenario, colDriverId, colShock);
    return metricValue(evaluateSensitivityCase(scenario), metric);
  }));

  return {
    rowDriver,
    colDriver,
    metric,
    rowLabels: rows.map((shock) => formatSensitivityShock(rowDriverId, shock)),
    colLabels: cols.map((shock) => formatSensitivityShock(colDriverId, shock)),
    matrix,
  };
}

export function generateOneWaySensitivity(
  baseAssumptions: FullModelAssumptions,
  driverId: SensitivityDriverId,
  steps?: number[]
): OneWaySensitivityRow[] {
  const driver = getSensitivityDriver(driverId);
  const shocks = steps ?? driver.defaultSteps;

  return shocks.map((shock) => {
    const metrics = evaluateSensitivityCase(applySensitivityShock(baseAssumptions, driverId, shock));
    return {
      shock,
      label: formatSensitivityShock(driverId, shock),
      projectIrr: metrics.projectIrrPct,
      equityIrr: metrics.equityIrrPct,
      minDscr: metrics.minDscr,
      avgDscr: metrics.avgDscr,
      minLlcr: metrics.minLlcr,
      projectNpv: metrics.projectNpvIdrBillion,
      equityNpv: metrics.equityNpvIdrBillion,
      lcoe: metrics.lcoeIdrPerKWh,
    };
  });
}
