import {
  type BaselineKind,
  type InvestmentBaselineSnapshot,
} from './baselineVersioningEngine';
import {
  validateBaselineRegistry,
  type BaselineGovernanceIssue,
} from './baselineGovernanceEngine';
import {
  diagnoseBaselineLineage,
  type BaselineLineageDiagnostic,
} from './baselineLineageDiagnostics';

export interface BaselinePortfolioBucket {
  projectId: string;
  kind: BaselineKind;
  baselineIds: string[];
  approvedIds: string[];
  draftIds: string[];
  supersededIds: string[];
  latestApprovedId: string | null;
  latestApprovedAsOfDate: string | null;
}

export interface BaselinePortfolioProjectIndex {
  projectId: string;
  baselineIds: string[];
  kinds: BaselineKind[];
  approvedCount: number;
  draftCount: number;
  supersededCount: number;
  buckets: BaselinePortfolioBucket[];
}

export interface BaselinePortfolioIndexResult {
  valid: boolean;
  projects: BaselinePortfolioProjectIndex[];
  unscopedBaselineIds: string[];
  blockers: BaselineGovernanceIssue[];
  lineageDiagnostics: ReadonlyArray<BaselineLineageDiagnostic>;
  lineageReady: boolean;
  warnings: string[];
}

const BASELINE_KINDS = new Set<BaselineKind>([
  'ic_case',
  'entry_case',
  'financial_close_case',
  'approved_budget',
  'actual_to_date',
  'latest_forecast',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function trimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function exactNonBlankString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() === value
    ? value
    : null;
}

function baselineKind(value: unknown): BaselineKind | null {
  return typeof value === 'string' && BASELINE_KINDS.has(value as BaselineKind)
    ? (value as BaselineKind)
    : null;
}

function usableSnapshot(value: unknown): InvestmentBaselineSnapshot | null {
  if (!isRecord(value)) return null;
  // Baseline identity is governed evidence. Portfolio indexing must not trim or
  // otherwise repair it before grouping/presentation, even when registry
  // governance independently marks the population invalid.
  if (!exactNonBlankString(value.id)) return null;
  if (!baselineKind(value.kind)) return null;
  if (!trimmedString(value.asOfDate) || !trimmedString(value.createdAt)) return null;
  if (!['draft', 'approved', 'superseded'].includes(String(value.status))) return null;
  // projectId is optional, but a supplied runtime identity must be an exact,
  // non-blank string. Portfolio grouping must not normalize caller-owned identity
  // evidence or reinterpret malformed/ambiguous evidence as intentionally unscoped.
  if (value.projectId !== undefined && !exactNonBlankString(value.projectId)) {
    return null;
  }
  return value as unknown as InvestmentBaselineSnapshot;
}

function time(value: unknown): number {
  if (typeof value !== 'string') return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function sortNewestFirst(
  a: InvestmentBaselineSnapshot,
  b: InvestmentBaselineSnapshot
): number {
  const asOfDelta = time(b.asOfDate) - time(a.asOfDate);
  if (asOfDelta !== 0) return asOfDelta;

  const createdDelta = time(b.createdAt) - time(a.createdAt);
  if (createdDelta !== 0) return createdDelta;

  const aId = exactNonBlankString((a as unknown as Record<string, unknown>).id) ?? '';
  const bId = exactNonBlankString((b as unknown as Record<string, unknown>).id) ?? '';
  return aId.localeCompare(bId);
}

function buildBucket(
  projectId: string,
  kind: BaselineKind,
  snapshots: InvestmentBaselineSnapshot[]
): BaselinePortfolioBucket {
  const ordered = snapshots.slice().sort(sortNewestFirst);
  const approved = ordered.filter((snapshot) => snapshot.status === 'approved');

  return {
    projectId,
    kind,
    baselineIds: ordered.map((snapshot) => snapshot.id),
    approvedIds: approved.map((snapshot) => snapshot.id),
    draftIds: ordered.filter((snapshot) => snapshot.status === 'draft').map((snapshot) => snapshot.id),
    supersededIds: ordered
      .filter((snapshot) => snapshot.status === 'superseded')
      .map((snapshot) => snapshot.id),
    latestApprovedId: approved[0]?.id ?? null,
    latestApprovedAsOfDate: approved[0]?.asOfDate ?? null,
  };
}

/**
 * Builds a read-only, asset-generic index over governed lifecycle baselines for
 * holding / portfolio presentation.
 *
 * Important boundaries:
 * - Registry governance and independent lineage integrity are re-performed before
 *   the index is considered valid.
 * - Baselines without projectId are kept visible as unscoped evidence rather
 *   than silently assigned to a project.
 * - Malformed retained/deserialized rows remain blockers and are excluded from
 *   portfolio grouping rather than being coerced into a project/kind/status.
 * - `latestApprovedId` is an informational catalog pointer only. It must not be
 *   used to auto-select a PIR comparison case; PIR selection remains explicit
 *   through `pirBaselineSelectionControl.ts`.
 * - No lifecycle ordering, KPI semantics, asset class, materiality threshold,
 *   tariff, EBL term or commercial meaning is inferred here.
 */
export function buildBaselinePortfolioIndex(
  snapshots: InvestmentBaselineSnapshot[]
): BaselinePortfolioIndexResult {
  const governance = validateBaselineRegistry(snapshots);
  const lineage = diagnoseBaselineLineage(snapshots);
  const warnings: string[] = [];

  const usable = snapshots
    .map((snapshot) => usableSnapshot(snapshot as unknown))
    .filter((snapshot): snapshot is InvestmentBaselineSnapshot => snapshot !== null);
  const malformedCount = snapshots.length - usable.length;
  if (malformedCount > 0) {
    warnings.push(
      `${malformedCount} malformed baseline row(s) are excluded from portfolio grouping and remain governance blockers.`
    );
  }

  const unscoped = usable.filter((snapshot) => {
    const runtime = snapshot as unknown as Record<string, unknown>;
    return runtime.projectId === undefined;
  });
  if (unscoped.length > 0) {
    warnings.push(
      `${unscoped.length} baseline(s) have no projectId and are excluded from project-level portfolio grouping.`
    );
  }

  const scoped = usable.filter((snapshot) => {
    const runtime = snapshot as unknown as Record<string, unknown>;
    return exactNonBlankString(runtime.projectId) !== null;
  });
  const byProject = new Map<string, InvestmentBaselineSnapshot[]>();

  for (const snapshot of scoped) {
    const runtime = snapshot as unknown as Record<string, unknown>;
    const projectId = exactNonBlankString(runtime.projectId);
    if (!projectId) continue;
    const population = byProject.get(projectId) ?? [];
    population.push(snapshot);
    byProject.set(projectId, population);
  }

  const projects: BaselinePortfolioProjectIndex[] = Array.from(byProject.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([projectId, projectSnapshots]) => {
      const kinds = Array.from(
        new Set(
          projectSnapshots
            .map((snapshot) => baselineKind((snapshot as unknown as Record<string, unknown>).kind))
            .filter((kind): kind is BaselineKind => kind !== null)
        )
      ).sort();
      const buckets = kinds.map((kind) =>
        buildBucket(
          projectId,
          kind,
          projectSnapshots.filter((snapshot) => snapshot.kind === kind)
        )
      );

      return {
        projectId,
        baselineIds: projectSnapshots.slice().sort(sortNewestFirst).map((snapshot) => snapshot.id),
        kinds,
        approvedCount: projectSnapshots.filter((snapshot) => snapshot.status === 'approved').length,
        draftCount: projectSnapshots.filter((snapshot) => snapshot.status === 'draft').length,
        supersededCount: projectSnapshots.filter((snapshot) => snapshot.status === 'superseded').length,
        buckets,
      };
    });

  return {
    valid: governance.valid && lineage.lineageReady,
    projects,
    unscopedBaselineIds: unscoped.map((snapshot) => snapshot.id),
    blockers: governance.errors,
    lineageDiagnostics: lineage.diagnostics,
    lineageReady: lineage.lineageReady,
    warnings,
  };
}
