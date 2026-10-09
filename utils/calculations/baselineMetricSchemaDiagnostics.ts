import { type InvestmentBaselineSnapshot } from './baselineVersioningEngine';

/**
 * Asset-generic metric-definition controls for lifecycle baselines and future
 * holding / portfolio comparison.
 *
 * This module deliberately does not ship a default metric catalog. Metric
 * semantics, units and aggregation behaviour must be supplied by the caller so
 * code does not silently invent investment, accounting or sector economics.
 */

export type BaselineMetricValueType = 'amount' | 'ratio' | 'multiple' | 'physical' | 'count';
export type BaselineMetricAggregation =
  | 'sum'
  | 'weighted_average'
  | 'average'
  | 'minimum'
  | 'maximum'
  | 'latest'
  | 'not_aggregatable';

export interface BaselineMetricDefinition {
  key: string;
  label: string;
  valueType: BaselineMetricValueType;
  unit: string;
  scale?: number;
  aggregation: BaselineMetricAggregation;
  /**
   * Explicit metric key to use as the economic weight when aggregation is
   * `weighted_average`. This is governance metadata only; this module never
   * performs the weighting calculation.
   */
  weightMetricKey?: string;
  description?: string;
}

export interface BaselineMetricSchemaDiagnostic {
  id: string;
  severity: 'error' | 'warning';
  metricKey?: string;
  baselineId?: string;
  message: string;
}

export interface BaselineMetricSchemaDiagnosticsResult {
  ready: boolean;
  diagnostics: BaselineMetricSchemaDiagnostic[];
  errorCount: number;
  warningCount: number;
  definedMetricKeys: string[];
  observedMetricKeys: string[];
  undefinedMetricKeys: string[];
}

function normalizeKey(value: string): string {
  return value.trim();
}

function isFinitePositiveScale(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value > 0);
}

/**
 * Verifies that baseline metrics intended for lifecycle / portfolio comparison
 * are backed by an explicit caller-supplied metric schema.
 *
 * Boundaries:
 * - No metric definitions are inferred from names or values.
 * - No currency conversion, unit conversion or scaling is performed.
 * - No portfolio aggregation is calculated.
 * - Aggregation metadata states caller intent only; it does not make a metric
 *   economically comparable across projects by itself.
 * - Weighted-average definitions must explicitly name their weight metric; the
 *   engine never chooses a weighting basis on the caller's behalf.
 * - Null metric values remain valid missing/not-populated values and are not
 *   converted to zero.
 */
export function diagnoseBaselineMetricSchema(
  snapshots: InvestmentBaselineSnapshot[],
  definitions: BaselineMetricDefinition[]
): BaselineMetricSchemaDiagnosticsResult {
  const diagnostics: BaselineMetricSchemaDiagnostic[] = [];
  const definitionByKey = new Map<string, BaselineMetricDefinition>();

  definitions.forEach((definition, index) => {
    const key = normalizeKey(definition.key);

    if (!key) {
      diagnostics.push({
        id: `BASELINE_METRIC_SCHEMA_EMPTY_KEY_${index}`,
        severity: 'error',
        message: `Metric definition ${index + 1} has an empty key.`,
      });
      return;
    }

    if (definitionByKey.has(key)) {
      diagnostics.push({
        id: `BASELINE_METRIC_SCHEMA_DUPLICATE_KEY_${key}`,
        severity: 'error',
        metricKey: key,
        message: `Metric definition key "${key}" is duplicated.`,
      });
      return;
    }

    if (!definition.label.trim()) {
      diagnostics.push({
        id: `BASELINE_METRIC_SCHEMA_EMPTY_LABEL_${key}`,
        severity: 'error',
        metricKey: key,
        message: `Metric definition "${key}" requires an explicit label.`,
      });
    }

    if (!definition.unit.trim()) {
      diagnostics.push({
        id: `BASELINE_METRIC_SCHEMA_EMPTY_UNIT_${key}`,
        severity: 'error',
        metricKey: key,
        message: `Metric definition "${key}" requires an explicit unit.`,
      });
    }

    if (!isFinitePositiveScale(definition.scale)) {
      diagnostics.push({
        id: `BASELINE_METRIC_SCHEMA_INVALID_SCALE_${key}`,
        severity: 'error',
        metricKey: key,
        message: `Metric definition "${key}" scale must be finite and greater than zero when supplied.`,
      });
    }

    definitionByKey.set(key, definition);
  });

  for (const [key, definition] of definitionByKey.entries()) {
    const rawWeightMetricKey = definition.weightMetricKey;
    const weightMetricKey = rawWeightMetricKey === undefined ? '' : normalizeKey(rawWeightMetricKey);

    if (definition.aggregation === 'weighted_average') {
      if (!weightMetricKey) {
        diagnostics.push({
          id: `BASELINE_METRIC_SCHEMA_MISSING_WEIGHT_${key}`,
          severity: 'error',
          metricKey: key,
          message: `Weighted-average metric "${key}" requires an explicit weightMetricKey.`,
        });
      } else if (weightMetricKey === key) {
        diagnostics.push({
          id: `BASELINE_METRIC_SCHEMA_SELF_WEIGHT_${key}`,
          severity: 'error',
          metricKey: key,
          message: `Weighted-average metric "${key}" cannot use itself as its weight metric.`,
        });
      } else if (!definitionByKey.has(weightMetricKey)) {
        diagnostics.push({
          id: `BASELINE_METRIC_SCHEMA_UNDEFINED_WEIGHT_${key}_${weightMetricKey}`,
          severity: 'error',
          metricKey: key,
          message: `Weighted-average metric "${key}" references undefined weight metric "${weightMetricKey}".`,
        });
      }
    } else if (rawWeightMetricKey !== undefined) {
      diagnostics.push({
        id: `BASELINE_METRIC_SCHEMA_UNUSED_WEIGHT_${key}`,
        severity: 'warning',
        metricKey: key,
        message: `Metric "${key}" supplies weightMetricKey but aggregation is "${definition.aggregation}"; the weight metadata will not be used by this schema contract.`,
      });
    }
  }

  const observedMetricKeys = Array.from(
    new Set(snapshots.flatMap((snapshot) => Object.keys(snapshot.metrics).map(normalizeKey)))
  )
    .filter(Boolean)
    .sort();

  const undefinedMetricKeys = observedMetricKeys.filter((key) => !definitionByKey.has(key));

  for (const key of undefinedMetricKeys) {
    diagnostics.push({
      id: `BASELINE_METRIC_SCHEMA_UNDEFINED_${key}`,
      severity: 'error',
      metricKey: key,
      message: `Observed baseline metric "${key}" has no caller-supplied metric definition.`,
    });
  }

  for (const snapshot of snapshots) {
    for (const [rawKey, value] of Object.entries(snapshot.metrics)) {
      const key = normalizeKey(rawKey);

      if (!key) {
        diagnostics.push({
          id: `BASELINE_METRIC_SCHEMA_EMPTY_OBSERVED_KEY_${snapshot.id}`,
          severity: 'error',
          baselineId: snapshot.id,
          message: `Baseline "${snapshot.id}" contains an empty metric key.`,
        });
        continue;
      }

      if (value !== null && !Number.isFinite(value)) {
        diagnostics.push({
          id: `BASELINE_METRIC_SCHEMA_NON_FINITE_${snapshot.id}_${key}`,
          severity: 'error',
          metricKey: key,
          baselineId: snapshot.id,
          message: `Baseline "${snapshot.id}" metric "${key}" must be finite or null.`,
        });
      }
    }
  }

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;

  return {
    ready: errorCount === 0,
    diagnostics,
    errorCount,
    warningCount,
    definedMetricKeys: Array.from(definitionByKey.keys()).sort(),
    observedMetricKeys,
    undefinedMetricKeys,
  };
}
