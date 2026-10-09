import {
  diagnoseBaselineMetricSchema,
  type BaselineMetricDefinition,
  type BaselineMetricSchemaDiagnosticsResult,
} from './baselineMetricSchemaDiagnostics';
import {
  buildBaselinePortfolioIndex,
  type BaselinePortfolioIndexResult,
} from './baselinePortfolioIndex';
import {
  validateBaselineRegistry,
  type BaselineGovernanceResult,
} from './baselineGovernanceEngine';
import {
  diagnoseBaselineLineage,
  type BaselineLineageDiagnosticsResult,
} from './baselineLineageDiagnostics';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';

export interface BaselinePortfolioGovernanceBundle {
  /**
   * True only when the exact supplied baseline population is clean across
   * registry governance, lineage integrity, metric-definition governance and
   * the resulting portfolio index.
   */
  ready: boolean;
  baselineCount: number;
  projectCount: number;
  approvedBaselineCount: number;
  draftBaselineCount: number;
  supersededBaselineCount: number;
  unscopedBaselineCount: number;
  registry: BaselineGovernanceResult;
  lineage: BaselineLineageDiagnosticsResult;
  metricSchema: BaselineMetricSchemaDiagnosticsResult;
  portfolioIndex: BaselinePortfolioIndexResult;
  blockerCount: number;
  warningCount: number;
}

/**
 * Single-source, read-only governance bundle for lifecycle baseline populations
 * intended for holding / portfolio presentation.
 *
 * Why this exists:
 * `buildBaselinePortfolioIndex` already protects registry and lineage integrity,
 * while `diagnoseBaselineMetricSchema` separately protects KPI meaning, units and
 * aggregation metadata. Downstream portfolio consumers should not be able to
 * combine an index built from one snapshot population with metric-governance
 * evidence built from another population or an unrelated definition set.
 *
 * This bundle therefore evaluates one explicit snapshot population and one
 * caller-supplied metric-definition set together, and exposes one conservative
 * readiness state.
 *
 * Boundaries:
 * - snapshots and metric definitions remain caller-supplied governance evidence;
 * - no baseline is approved, superseded, selected or mutated here;
 * - no PIR comparison case is chosen;
 * - no metric semantics, units, scales, aggregation rules or weights are inferred;
 * - no currency conversion or portfolio aggregation is performed;
 * - no lifecycle-kind ordering is assumed;
 * - no electricity, tariff, PPA/EBL or other asset-specific commercial logic is
 *   introduced into this asset-generic baseline layer.
 */
export function buildBaselinePortfolioGovernanceBundle(
  snapshots: InvestmentBaselineSnapshot[],
  metricDefinitions: BaselineMetricDefinition[]
): BaselinePortfolioGovernanceBundle {
  const registry = validateBaselineRegistry(snapshots);
  const lineage = diagnoseBaselineLineage(snapshots);
  const metricSchema = diagnoseBaselineMetricSchema(snapshots, metricDefinitions);
  const portfolioIndex = buildBaselinePortfolioIndex(snapshots);

  const approvedBaselineCount = snapshots.filter(
    (snapshot) => snapshot.status === 'approved'
  ).length;
  const draftBaselineCount = snapshots.filter(
    (snapshot) => snapshot.status === 'draft'
  ).length;
  const supersededBaselineCount = snapshots.filter(
    (snapshot) => snapshot.status === 'superseded'
  ).length;

  // Registry and lineage diagnostics are intentionally exposed independently even
  // though the portfolio index re-performs those controls internally. The bundle
  // does not reconstruct or weaken the index's validity signal; all authoritative
  // control surfaces must agree before downstream portfolio presentation is ready.
  const blockerCount =
    registry.errors.length +
    lineage.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length +
    metricSchema.errorCount;

  const warningCount =
    registry.warnings.length +
    lineage.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length +
    metricSchema.warningCount +
    portfolioIndex.warnings.length;

  return {
    ready:
      snapshots.length > 0 &&
      registry.valid &&
      lineage.lineageReady &&
      metricSchema.ready &&
      portfolioIndex.valid,
    baselineCount: snapshots.length,
    projectCount: portfolioIndex.projects.length,
    approvedBaselineCount,
    draftBaselineCount,
    supersededBaselineCount,
    unscopedBaselineCount: portfolioIndex.unscopedBaselineIds.length,
    registry,
    lineage,
    metricSchema,
    portfolioIndex,
    blockerCount,
    warningCount,
  };
}
