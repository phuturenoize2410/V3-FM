import type { BaselinePortfolioGovernanceBundle } from './baselinePortfolioGovernanceBundle';
import type { BaselinePortfolioIndexResult } from './baselinePortfolioIndex';

export type BaselinePortfolioGovernanceStatus = 'READY' | 'BLOCKED' | 'WARNING';

export interface BaselinePortfolioGovernanceCategory {
  id: 'registry' | 'lineage' | 'metric_schema' | 'scope';
  label: string;
  status: BaselinePortfolioGovernanceStatus;
  issueCount: number;
  messages: string[];
}

export interface BaselinePortfolioGovernancePresentation {
  governanceReady: boolean;
  registryReady: boolean;
  lineageReady: boolean;
  metricSchemaReady?: boolean;
  categories: BaselinePortfolioGovernanceCategory[];
  projectCount: number;
  unscopedBaselineCount: number;
}

/**
 * Calculation-free presentation adapter for the authoritative holding / portfolio
 * baseline governance bundle.
 *
 * The bundle already binds the exact baseline population to registry governance,
 * predecessor lineage, caller-supplied metric definitions and the portfolio index.
 * This adapter only exposes those authoritative states for UI consumption; it does
 * not reconstruct readiness from a bare index or re-perform any finance logic.
 *
 * Boundaries:
 * - KPI meaning, units, scales, aggregation rules and weights remain caller-supplied;
 * - no baseline is approved, superseded, selected, reordered or assigned here;
 * - no portfolio metric is aggregated and no currency/unit conversion is performed;
 * - no PIR case or investment decision is selected;
 * - no electricity, tariff, PPA/EBL or other asset-specific economics are introduced.
 */
export function buildBaselinePortfolioGovernanceBundlePresentation(
  bundle: BaselinePortfolioGovernanceBundle
): BaselinePortfolioGovernancePresentation {
  const registryMessages = [
    ...bundle.registry.errors.map((issue) => issue.message),
    ...bundle.registry.warnings.map((issue) => issue.message),
  ];
  const lineageMessages = bundle.lineage.diagnostics.map((diagnostic) => {
    const baselinePrefix = diagnostic.baselineId ? `${diagnostic.baselineId}: ` : '';
    return `${baselinePrefix}${diagnostic.message}`;
  });
  const metricSchemaMessages = bundle.metricSchema.diagnostics.map((diagnostic) => {
    const baselinePrefix = diagnostic.baselineId ? `${diagnostic.baselineId}: ` : '';
    const metricPrefix = diagnostic.metricKey ? `${diagnostic.metricKey}: ` : '';
    return `${baselinePrefix}${metricPrefix}${diagnostic.message}`;
  });
  const scopeMessages = bundle.portfolioIndex.unscopedBaselineIds.map(
    (baselineId) => `${baselineId}: no projectId supplied; excluded from project-level grouping.`
  );

  const registryIssueCount = bundle.registry.errors.length + bundle.registry.warnings.length;
  const lineageIssueCount = bundle.lineage.diagnostics.length;
  const metricSchemaIssueCount = bundle.metricSchema.diagnostics.length;

  return {
    governanceReady: bundle.ready,
    registryReady: bundle.registry.valid,
    lineageReady: bundle.lineage.lineageReady,
    metricSchemaReady: bundle.metricSchema.ready,
    projectCount: bundle.projectCount,
    unscopedBaselineCount: bundle.unscopedBaselineCount,
    categories: [
      {
        id: 'registry',
        label: 'Registry governance',
        status: bundle.registry.valid
          ? bundle.registry.warnings.length > 0
            ? 'WARNING'
            : 'READY'
          : 'BLOCKED',
        issueCount: registryIssueCount,
        messages: registryMessages,
      },
      {
        id: 'lineage',
        label: 'Lineage integrity',
        status: bundle.lineage.lineageReady
          ? bundle.lineage.diagnostics.some((diagnostic) => diagnostic.severity === 'warning')
            ? 'WARNING'
            : 'READY'
          : 'BLOCKED',
        issueCount: lineageIssueCount,
        messages: lineageMessages,
      },
      {
        id: 'metric_schema',
        label: 'Metric schema',
        status: bundle.metricSchema.ready
          ? bundle.metricSchema.warningCount > 0
            ? 'WARNING'
            : 'READY'
          : 'BLOCKED',
        issueCount: metricSchemaIssueCount,
        messages: metricSchemaMessages,
      },
      {
        id: 'scope',
        label: 'Portfolio scope',
        status: bundle.unscopedBaselineCount === 0 ? 'READY' : 'WARNING',
        issueCount: bundle.unscopedBaselineCount,
        messages: scopeMessages,
      },
    ],
  };
}

/**
 * Legacy calculation-free adapter retained for existing callers that only hold a
 * `BaselinePortfolioIndexResult`.
 *
 * This path cannot represent metric-schema governance because a bare portfolio
 * index does not carry caller-supplied KPI definitions. New holding/portfolio UI
 * should use `buildBaselinePortfolioGovernanceBundlePresentation` instead.
 */
export function buildBaselinePortfolioGovernancePresentation(
  index: BaselinePortfolioIndexResult
): BaselinePortfolioGovernancePresentation {
  const registryMessages = index.blockers.map(
    (issue) => `${issue.baselineId}: ${issue.message}`
  );
  const lineageMessages = index.lineageDiagnostics.map((diagnostic) => {
    const baselinePrefix = diagnostic.baselineId ? `${diagnostic.baselineId}: ` : '';
    return `${baselinePrefix}${diagnostic.message}`;
  });
  const scopeMessages = index.unscopedBaselineIds.map(
    (baselineId) => `${baselineId}: no projectId supplied; excluded from project-level grouping.`
  );

  return {
    governanceReady: index.valid,
    registryReady: index.blockers.length === 0,
    lineageReady: index.lineageReady,
    projectCount: index.projects.length,
    unscopedBaselineCount: index.unscopedBaselineIds.length,
    categories: [
      {
        id: 'registry',
        label: 'Registry governance',
        status: index.blockers.length === 0 ? 'READY' : 'BLOCKED',
        issueCount: index.blockers.length,
        messages: registryMessages,
      },
      {
        id: 'lineage',
        label: 'Lineage integrity',
        status: index.lineageReady ? 'READY' : 'BLOCKED',
        issueCount: index.lineageDiagnostics.length,
        messages: lineageMessages,
      },
      {
        id: 'scope',
        label: 'Portfolio scope',
        status: index.unscopedBaselineIds.length === 0 ? 'READY' : 'WARNING',
        issueCount: index.unscopedBaselineIds.length,
        messages: scopeMessages,
      },
    ],
  };
}
