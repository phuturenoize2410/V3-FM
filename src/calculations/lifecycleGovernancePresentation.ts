import type {
  LifecycleGovernanceCheckBundle,
  LifecycleGovernanceCheckCategory,
  LifecycleGovernanceCheckItem,
} from './lifecycleGovernanceChecks';

export type LifecycleGovernancePresentationStatus = 'Ready' | 'Blocked';

export interface LifecycleGovernanceCategoryPresentation {
  category: LifecycleGovernanceCheckCategory;
  label: string;
  status: LifecycleGovernancePresentationStatus;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  blockingFailures: number;
  checks: LifecycleGovernanceCheckItem[];
}

export interface LifecycleGovernancePresentation {
  status: LifecycleGovernancePresentationStatus;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  blockingFailures: number;
  categories: LifecycleGovernanceCategoryPresentation[];
  blockingReasons: string[];
}

const CATEGORY_ORDER: LifecycleGovernanceCheckCategory[] = [
  'actual_provenance',
  'baseline_governance',
  'pir_governance',
];

const CATEGORY_LABELS: Record<LifecycleGovernanceCheckCategory, string> = {
  actual_provenance: 'Actual provenance',
  baseline_governance: 'Baseline governance',
  pir_governance: 'PIR governance',
};

function presentCategory(
  category: LifecycleGovernanceCheckCategory,
  checks: LifecycleGovernanceCheckItem[]
): LifecycleGovernanceCategoryPresentation {
  const categoryChecks = checks.filter((check) => check.category === category);
  const passedChecks = categoryChecks.filter((check) => check.passed).length;
  const failedChecks = categoryChecks.length - passedChecks;
  const blockingFailures = categoryChecks.filter(
    (check) => check.blocking && !check.passed
  ).length;

  return {
    category,
    label: CATEGORY_LABELS[category],
    status: blockingFailures === 0 ? 'Ready' : 'Blocked',
    totalChecks: categoryChecks.length,
    passedChecks,
    failedChecks,
    blockingFailures,
    checks: categoryChecks,
  };
}

/**
 * Calculation-free institutional presentation adapter for lifecycle governance.
 *
 * This adapter only summarizes the authoritative LifecycleGovernanceCheckBundle.
 * It deliberately does not re-run controls, reinterpret severity, fabricate
 * evidence, approve/supersede baselines, select PIR cases, mutate Actuals or
 * calculate any finance/electricity economics. Empty categories remain visible
 * with zero checks so downstream UI can distinguish "not evaluated here" from a
 * populated category whose blocking checks actually passed.
 */
export function buildLifecycleGovernancePresentation(
  bundle: LifecycleGovernanceCheckBundle
): LifecycleGovernancePresentation {
  const categories = CATEGORY_ORDER.map((category) =>
    presentCategory(category, bundle.checks)
  );
  const passedChecks = bundle.checks.filter((check) => check.passed).length;
  const failedChecks = bundle.checks.length - passedChecks;
  const blockingFailures = bundle.checks.filter(
    (check) => check.blocking && !check.passed
  ).length;

  return {
    status: bundle.passed ? 'Ready' : 'Blocked',
    totalChecks: bundle.checks.length,
    passedChecks,
    failedChecks,
    blockingFailures,
    categories,
    blockingReasons: [...bundle.blockingReasons],
  };
}
