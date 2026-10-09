import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Layers3,
  Link2,
  ListChecks,
  ShieldAlert,
} from 'lucide-react';
import type {
  BaselinePortfolioGovernanceCategory,
  BaselinePortfolioGovernancePresentation,
} from '../../calculations/baselinePortfolioGovernancePresentation';

interface BaselinePortfolioGovernancePanelProps {
  presentation: BaselinePortfolioGovernancePresentation;
  compact?: boolean;
}

const statusMeta = {
  READY: {
    label: 'Ready',
    icon: CheckCircle2,
    className: 'border-emerald-200/90 bg-[#f3f8f4] text-emerald-800',
  },
  WARNING: {
    label: 'Warning',
    icon: AlertTriangle,
    className: 'border-amber-200/90 bg-[#fff9ed] text-amber-900',
  },
  BLOCKED: {
    label: 'Blocked',
    icon: ShieldAlert,
    className: 'border-rose-200/90 bg-[#fff5f3] text-rose-900',
  },
} as const;

const categoryIcon = {
  registry: Layers3,
  lineage: Link2,
  metric_schema: ListChecks,
  scope: AlertTriangle,
} as const;

/**
 * Calculation-free institutional presentation surface for holding / portfolio
 * baseline governance.
 *
 * The component renders only the statuses produced by
 * `buildBaselinePortfolioGovernancePresentation`. It does not re-perform or alter
 * registry governance, baseline lineage, metric-schema governance, project scoping,
 * approval, supersession, preferred-case selection, PIR selection, lifecycle ordering
 * or finance economics.
 */
export const BaselinePortfolioGovernancePanel: React.FC<BaselinePortfolioGovernancePanelProps> = ({
  presentation,
  compact = false,
}) => {
  const overall = presentation.governanceReady ? statusMeta.READY : statusMeta.BLOCKED;
  const OverallIcon = overall.icon;

  return (
    <section className="overflow-hidden rounded-xl border border-stone-200/90 bg-[#fdfcf9] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/90 bg-[#f7f5f0] px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[12px] font-semibold tracking-[0.005em] text-slate-950">
              Portfolio Baseline Governance
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.095em] ${overall.className}`}
            >
              <OverallIcon className="h-3 w-3" />
              {overall.label}
            </span>
          </div>
          <p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-stone-600">
            Registry, lineage, metric semantics and portfolio scope remain separate controls before lifecycle baselines are represented as holding-ready evidence.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200/80 bg-[#fffefa] px-3 py-2 text-right">
          <Metric label="Projects" value={presentation.projectCount} />
          <Metric label="Unscoped" value={presentation.unscopedBaselineCount} />
        </div>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="grid gap-3 lg:grid-cols-3">
          {presentation.categories.map((category) => (
            <CategoryCard key={category.id} category={category} compact={compact} />
          ))}
        </div>
      </div>
    </section>
  );
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div>
    <div className="text-[9px] font-semibold uppercase tracking-[0.105em] text-stone-500">
      {label}
    </div>
    <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-slate-950">
      {value}
    </div>
  </div>
);

const CategoryCard: React.FC<{
  category: BaselinePortfolioGovernanceCategory;
  compact: boolean;
}> = ({ category, compact }) => {
  const meta = statusMeta[category.status];
  const StatusIcon = meta.icon;
  const CategoryIcon = categoryIcon[category.id];
  const visibleMessages = compact ? category.messages.slice(0, 1) : category.messages.slice(0, 3);
  const hiddenCount = Math.max(0, category.messages.length - visibleMessages.length);

  return (
    <div className="min-w-0 rounded-lg border border-stone-200/90 bg-[#fffefa] px-3 py-3 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-[#f8f6f1] text-slate-700">
            <CategoryIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold text-slate-900">
              {category.label}
            </div>
            <div className="mt-0.5 text-[9px] font-medium tabular-nums text-stone-500">
              {category.issueCount} issue{category.issueCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${meta.className}`}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {meta.label}
        </span>
      </div>

      {visibleMessages.length > 0 ? (
        <div className="mt-2.5 space-y-1.5 border-t border-stone-100 pt-2.5">
          {visibleMessages.map((message, index) => (
            <div key={`${category.id}-${index}`} className="text-[9px] leading-3.5 text-stone-600">
              {message}
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="text-[9px] font-semibold tabular-nums text-stone-500">
              +{hiddenCount} additional issue{hiddenCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2.5 border-t border-stone-100 pt-2.5 text-[9px] leading-3.5 text-stone-500">
          No issues reported by this control category.
        </div>
      )}
    </div>
  );
};
