import type { ModelCheckItem } from '../types';
import type {
  FullModelAssumptions,
  ModelMetrics,
  MonthlyCapexSchedule,
  SourcesAndUses,
} from '../types';
import type { AuditedOperatingResult } from './auditedOperatingEngine';
import { buildReconciledAuditedModelCheckBundle } from './reconciledAuditedModelCheckBundle';

export interface ReconciledAuditedModelControlCategory {
  readonly category: ModelCheckItem['category'];
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly passed: boolean;
}

export interface ReconciledAuditedModelControlResult {
  readonly passed: boolean;
  readonly checks: ReadonlyArray<Readonly<ModelCheckItem>>;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly blockingCheckIds: ReadonlyArray<string>;
  readonly categories: ReadonlyArray<Readonly<ReconciledAuditedModelControlCategory>>;
}

function summarizeCategories(
  checks: ReadonlyArray<Readonly<ModelCheckItem>>
): ReadonlyArray<Readonly<ReconciledAuditedModelControlCategory>> {
  const categoryMap = new Map<
    ModelCheckItem['category'],
    { totalChecks: number; passedChecks: number; failedChecks: number }
  >();

  for (const check of checks) {
    const current = categoryMap.get(check.category) ?? {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
    };

    current.totalChecks += 1;
    if (check.passed) {
      current.passedChecks += 1;
    } else {
      current.failedChecks += 1;
    }

    categoryMap.set(check.category, current);
  }

  return Object.freeze(
    Array.from(categoryMap.entries())
      .map(([category, summary]) =>
        Object.freeze({
          category,
          ...summary,
          passed: summary.totalChecks > 0 && summary.failedChecks === 0,
        })
      )
      .sort((a, b) => String(a.category).localeCompare(String(b.category)))
  );
}

/**
 * Preferred fail-closed control contract for consumers of the reconciled
 * audited finance/model-check pipeline.
 *
 * The lower-level bundle intentionally remains an array of ModelCheckItem for
 * compatibility with existing screens. This wrapper makes overall readiness an
 * explicit engine-owned result so downstream UI/export/PIR-adjacent consumers do
 * not reconstruct pass/fail status independently from a partial check subset.
 *
 * Readiness requires a non-empty check population and every composed audited
 * finance plus schedule-source-identity check to pass. Failed check IDs and
 * category summaries are exposed only as deterministic diagnostics; they do not
 * change the underlying finance calculations or severity semantics.
 *
 * The returned evidence graph is runtime-immutable. Authoritative check objects
 * are snapshotted and frozen once for this control result, and the blocking-ID and
 * category populations are derived from that same retained check population.
 * Downstream consumers therefore cannot mutate one view of model readiness while
 * leaving another equivalent-looking summary unchanged. This is an in-memory SSOT
 * guarantee only; it does not claim persisted-record identity or durable storage.
 *
 * Boundary: this control is asset-generic and read-only. It does not alter
 * assumptions, audited schedules, Actuals, Mapping Master evidence, baseline or
 * PIR governance, Energy Sales/effective-tariff economics, Shareholder Loan
 * treatment, or commercial terms. It does not repair failed checks or treat a
 * category summary as a substitute for the underlying authoritative checks.
 */
export function assessReconciledAuditedModelControl(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  monthlyCapexSchedule: MonthlyCapexSchedule[],
  operatingResult: AuditedOperatingResult,
  metrics: ModelMetrics
): ReconciledAuditedModelControlResult {
  const checks = Object.freeze(
    buildReconciledAuditedModelCheckBundle(
      assumptions,
      sourcesAndUses,
      monthlyCapexSchedule,
      operatingResult,
      metrics
    ).map((check) => Object.freeze({ ...check }))
  );

  const blockingCheckIds = Object.freeze(
    checks
      .filter((check) => !check.passed)
      .map((check) => check.id)
      .sort()
  );
  const passedChecks = checks.length - blockingCheckIds.length;
  const categories = summarizeCategories(checks);

  return Object.freeze({
    passed: checks.length > 0 && blockingCheckIds.length === 0,
    checks,
    totalChecks: checks.length,
    passedChecks,
    failedChecks: blockingCheckIds.length,
    blockingCheckIds,
    categories,
  });
}
