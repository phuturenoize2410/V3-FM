import {
  buildBaselinePortfolioIndex,
  type BaselinePortfolioIndexResult,
} from './baselinePortfolioIndex';
import {
  diagnoseBaselineMetricSchema,
  type BaselineMetricDefinition,
  type BaselineMetricSchemaDiagnosticsResult,
} from './baselineMetricSchemaDiagnostics';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';

export interface GovernedBaselinePortfolioComparisonIndex {
  /**
   * True only when baseline registry/lineage governance and explicit metric
   * schema governance both pass for the same snapshot population.
   */
  readyForPortfolioComparison: boolean;
  baselineGovernanceReady: boolean;
  metricSchemaReady: boolean;
  index: BaselinePortfolioIndexResult;
  metricSchema: BaselineMetricSchemaDiagnosticsResult;
  blockingReasons: string[];
}

/**
 * Preferred read-only handoff for future holding / portfolio comparison.
 *
 * This wrapper intentionally strengthens readiness without changing the existing
 * `buildBaselinePortfolioIndex` contract. A baseline population may be indexed
 * for catalog / lineage presentation while still being blocked from cross-project
 * metric comparison when its metric semantics are not explicitly governed.
 *
 * Boundaries:
 * - No baseline is approved, superseded, selected, reordered or assigned.
 * - No KPI catalog, accounting meaning, asset class or lifecycle ordering is inferred.
 * - No currency/unit conversion, scaling, weighting or portfolio aggregation occurs.
 * - Aggregation metadata in the supplied metric definitions remains descriptive
 *   governance intent only; it is not executed here.
 * - Electricity-specific metrics remain caller/module supplied and are not promoted
 *   into the asset-generic finance/lifecycle core.
 */
export function buildGovernedBaselinePortfolioComparisonIndex(
  snapshots: InvestmentBaselineSnapshot[],
  metricDefinitions: BaselineMetricDefinition[]
): GovernedBaselinePortfolioComparisonIndex {
  const index = buildBaselinePortfolioIndex(snapshots);
  const metricSchema = diagnoseBaselineMetricSchema(snapshots, metricDefinitions);

  const blockingReasons = [
    ...index.blockers.map((issue) => `${issue.baselineId}: ${issue.message}`),
    ...index.lineageDiagnostics.map((diagnostic) => {
      const prefix = diagnostic.baselineId ? `${diagnostic.baselineId}: ` : '';
      return `${prefix}${diagnostic.message}`;
    }),
    ...metricSchema.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => {
        const prefix = diagnostic.baselineId
          ? `${diagnostic.baselineId}: `
          : diagnostic.metricKey
            ? `${diagnostic.metricKey}: `
            : '';
        return `${prefix}${diagnostic.message}`;
      }),
  ];

  return {
    readyForPortfolioComparison: index.valid && metricSchema.ready,
    baselineGovernanceReady: index.valid,
    metricSchemaReady: metricSchema.ready,
    index,
    metricSchema,
    blockingReasons,
  };
}
