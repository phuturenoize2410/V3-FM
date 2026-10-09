import type { PlanVsActualFieldSelector } from '../calculations/planVsActualFieldReconciliationDiagnostics';

export interface CostCompletionSelectorIdentity {
  readonly ready: boolean;
  readonly identity: string | null;
  readonly blockingReasons: readonly string[];
}

const exact = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

const OPTIONAL_STRING_KEYS = ['finmodCategory', 'finmodSubcategory', 'projectId', 'currency'] as const;
const OPTIONAL_ENUM_KEYS = ['phase', 'dataClass', 'accountingTreatment'] as const;

/**
 * Canonical, versioned identity for a retained Plan-vs-Actual selector.
 *
 * This is deliberately not a hash and performs no normalization. It serializes
 * only the governed selector dimensions in a fixed order so the exact retained
 * Actual selector can be compared with independently supplied forward-cost
 * evidence without reconstructing identity from UI state. Omitted dimensions
 * remain explicitly null and therefore cannot silently widen/narrow identity.
 */
export function buildCostCompletionSelectorIdentity(
  selector: Readonly<PlanVsActualFieldSelector> | null
): CostCompletionSelectorIdentity {
  const blockers: string[] = [];
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) {
    return Object.freeze({
      ready: false,
      identity: null,
      blockingReasons: Object.freeze(['A retained governed selector object is required.']),
    });
  }

  if (!exact(selector.finmodLineItem)) {
    blockers.push('finmodLineItem must be an exact non-empty identity without surrounding whitespace.');
  }

  for (const key of OPTIONAL_STRING_KEYS) {
    const value = selector[key];
    if (value !== undefined && !exact(value)) {
      blockers.push(`${key} must remain exact non-empty evidence when supplied.`);
    }
  }
  for (const key of OPTIONAL_ENUM_KEYS) {
    const value = selector[key];
    if (value !== undefined && !exact(value)) {
      blockers.push(`${key} must remain exact non-empty evidence when supplied.`);
    }
  }

  if (blockers.length > 0) {
    return Object.freeze({ ready: false, identity: null, blockingReasons: Object.freeze(blockers) });
  }

  const canonical = {
    version: 1,
    finmodLineItem: selector.finmodLineItem,
    finmodCategory: selector.finmodCategory ?? null,
    finmodSubcategory: selector.finmodSubcategory ?? null,
    projectId: selector.projectId ?? null,
    phase: selector.phase ?? null,
    dataClass: selector.dataClass ?? null,
    accountingTreatment: selector.accountingTreatment ?? null,
    currency: selector.currency ?? null,
  };

  return Object.freeze({
    ready: true,
    identity: `finmod-selector:v1:${JSON.stringify(canonical)}`,
    blockingReasons: Object.freeze([]),
  });
}
