import type { ActualReleaseEvidenceManifest } from './actualReleaseEvidenceManifest';
import { runPlanVsActualGovernanceDiagnostics } from './planVsActualGovernanceDiagnostics';

export type LifecycleGovernanceCheckCategory =
  | 'actual_provenance'
  | 'baseline_governance'
  | 'pir_governance';

export interface LifecycleGovernanceCheckItem {
  id: string;
  name: string;
  category: LifecycleGovernanceCheckCategory;
  passed: boolean;
  blocking: boolean;
  details: string;
}

export interface LifecycleGovernanceCheckBundle {
  passed: boolean;
  checks: LifecycleGovernanceCheckItem[];
  blockingReasons: string[];
}

function hasText(value?: string): boolean {
  return Boolean(value?.trim());
}

function buildActualReleaseEvidenceChecks(
  manifest: ActualReleaseEvidenceManifest
): LifecycleGovernanceCheckItem[] {
  const evidenceChecks: LifecycleGovernanceCheckItem[] = [
    {
      id: 'lifecycle-actual-release-evidence-ready',
      name: 'Actual release evidence readiness',
      category: 'actual_provenance',
      passed: manifest.evidenceReady,
      blocking: true,
      details: manifest.evidenceReady
        ? 'Controlled Actual release evidence is ready for governed downstream use.'
        : manifest.blockingReasons.join(' ') || 'Actual release evidence is not ready.',
    },
    {
      id: 'lifecycle-actual-import-batch-reference',
      name: 'Actual import batch reference',
      category: 'actual_provenance',
      passed: hasText(manifest.metadata.importBatchId),
      blocking: true,
      details: hasText(manifest.metadata.importBatchId)
        ? `Import batch is explicitly referenced as ${manifest.metadata.importBatchId}.`
        : 'Controlled Actual evidence is missing an explicit import batch reference.',
    },
    {
      id: 'lifecycle-actual-source-reference',
      name: 'Actual source reference',
      category: 'actual_provenance',
      passed: hasText(manifest.metadata.sourceReference),
      blocking: true,
      details: hasText(manifest.metadata.sourceReference)
        ? `Source population is explicitly referenced as ${manifest.metadata.sourceReference}.`
        : 'Controlled Actual evidence is missing an explicit source reference.',
    },
    {
      id: 'lifecycle-actual-mapping-master-version',
      name: 'Mapping Master version reference',
      category: 'actual_provenance',
      passed: hasText(manifest.metadata.mappingMasterVersion),
      blocking: true,
      details: hasText(manifest.metadata.mappingMasterVersion)
        ? `Mapping Master is explicitly referenced as version ${manifest.metadata.mappingMasterVersion}.`
        : 'Controlled Actual evidence is missing an explicit Mapping Master version.',
    },
    {
      id: 'lifecycle-actual-release-cutoff',
      name: 'Actual release cutoff date',
      category: 'actual_provenance',
      passed: hasText(manifest.cutoffDate),
      blocking: true,
      details: hasText(manifest.cutoffDate)
        ? `Released Actual population is bounded by cutoff ${manifest.cutoffDate}.`
        : 'Controlled Actual evidence is missing an explicit cutoff date.',
    },
    {
      id: 'lifecycle-actual-release-population',
      name: 'Actual released population',
      category: 'actual_provenance',
      passed: manifest.releasePopulation.releasedRows > 0,
      blocking: true,
      details:
        manifest.releasePopulation.releasedRows > 0
          ? `${manifest.releasePopulation.releasedRows} released row(s) are bound to the evidence manifest.`
          : 'Controlled Actual evidence does not contain a non-empty released population.',
    },
    {
      id: 'lifecycle-actual-release-error-checks',
      name: 'Actual release error diagnostics',
      category: 'actual_provenance',
      passed: manifest.failedErrorCheckIds.length === 0,
      blocking: true,
      details:
        manifest.failedErrorCheckIds.length === 0
          ? 'No failed error-severity release diagnostics are carried by the evidence manifest.'
          : `Failed release diagnostics: ${manifest.failedErrorCheckIds.join(', ')}`,
    },
  ];

  return evidenceChecks;
}

/**
 * Asset-generic lifecycle governance checks.
 *
 * This bundle intentionally sits beside, rather than inside, the finance-model
 * arithmetic checks. It verifies migration/governance boundaries without
 * pretending that provenance controls are cash-flow, debt or tax calculations.
 *
 * When a controlled Actual release evidence manifest is supplied, its explicit
 * import batch, source reference, Mapping Master version, cutoff, released
 * population and failed-error state become first-class lifecycle checks. The
 * bundle does not fabricate missing evidence, approve a baseline, select a PIR
 * case, infer accounting mappings or change any financial result.
 *
 * No project economics, commercial terms, accounting mappings, approvals or
 * source-system authenticity are inferred here.
 */
export function buildLifecycleGovernanceCheckBundle(
  actualReleaseEvidence?: ActualReleaseEvidenceManifest | null
): LifecycleGovernanceCheckBundle {
  const planVsActual = runPlanVsActualGovernanceDiagnostics();

  const checks: LifecycleGovernanceCheckItem[] = planVsActual.checks.map((check) => ({
    id: `lifecycle-${check.id}`,
    name: check.label,
    category: 'actual_provenance',
    passed: check.passed,
    blocking: check.severity === 'error',
    details: check.detail,
  }));

  if (actualReleaseEvidence) {
    checks.push(...buildActualReleaseEvidenceChecks(actualReleaseEvidence));
  }

  const duplicateIds = checks
    .map((check) => check.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  checks.push({
    id: 'lifecycle-check-id-integrity',
    name: 'Lifecycle check ID integrity',
    category: 'actual_provenance',
    passed: duplicateIds.length === 0,
    blocking: true,
    details:
      duplicateIds.length === 0
        ? 'Lifecycle governance checks have unique stable IDs.'
        : `Duplicate lifecycle governance check IDs: ${Array.from(new Set(duplicateIds)).join(', ')}`,
  });

  const blockingReasons = checks
    .filter((check) => check.blocking && !check.passed)
    .map((check) => `${check.name}: ${check.details}`);

  return {
    passed: blockingReasons.length === 0,
    checks,
    blockingReasons,
  };
}
