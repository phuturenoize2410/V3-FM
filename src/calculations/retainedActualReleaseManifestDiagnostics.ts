import {
  REQUIRED_ACTUAL_RELEASE_ERROR_CHECK_IDS,
  type ActualReleaseEvidenceManifest,
} from './actualReleaseEvidenceManifest';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface RetainedActualReleaseManifestIssue {
  readonly code:
    | 'DERIVED_EVIDENCE_NOT_READY'
    | 'RETAINED_EVIDENCE_NOT_READY'
    | 'DERIVED_DIAGNOSTICS_MANIFEST_MISMATCH'
    | 'RETAINED_DIAGNOSTICS_MANIFEST_MISMATCH'
    | 'DERIVED_DIAGNOSTIC_CHECK_IDENTITY_INVALID'
    | 'RETAINED_DIAGNOSTIC_CHECK_IDENTITY_INVALID'
    | 'DERIVED_REQUIRED_ERROR_CHECKS_INVALID'
    | 'RETAINED_REQUIRED_ERROR_CHECKS_INVALID'
    | 'DERIVED_NUMERIC_EVIDENCE_INVALID'
    | 'RETAINED_NUMERIC_EVIDENCE_INVALID'
    | 'DERIVED_RELEASE_IDENTITY_INVALID'
    | 'RETAINED_RELEASE_IDENTITY_INVALID'
    | 'DERIVED_CUTOFF_DATE_INVALID'
    | 'RETAINED_CUTOFF_DATE_INVALID'
    | 'DERIVED_PREPARATION_DATE_INVALID'
    | 'RETAINED_PREPARATION_DATE_INVALID'
    | 'IMPORT_BATCH_ID_MISMATCH'
    | 'SOURCE_REFERENCE_MISMATCH'
    | 'MAPPING_MASTER_VERSION_MISMATCH'
    | 'CUTOFF_DATE_MISMATCH'
    | 'RELEASE_POPULATION_MISMATCH'
    | 'FAILED_CHECK_POPULATION_MISMATCH'
    | 'DERIVED_FAILED_CHECK_IDENTITY_INVALID'
    | 'RETAINED_FAILED_CHECK_IDENTITY_INVALID';
  readonly message: string;
}

export interface RetainedActualReleaseManifestDiagnostics {
  readonly passed: boolean;
  readonly issues: ReadonlyArray<RetainedActualReleaseManifestIssue>;
}

function normalized(value?: string): string {
  return (value ?? '').trim();
}

function sorted(values: ReadonlyArray<string>): string[] {
  return [...values].sort();
}

function sameStrings(
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function hasValidSetIdentity(values: ReadonlyArray<string>): boolean {
  const normalizedValues = values.map(normalized);
  return (
    normalizedValues.every((value) => value.length > 0) &&
    new Set(normalizedValues).size === normalizedValues.length
  );
}

function hasValidDiagnosticCheckIdentity(
  manifest: ActualReleaseEvidenceManifest
): boolean {
  return hasValidSetIdentity(manifest.diagnostics.checks.map((check) => check.id));
}

function hasRequiredErrorChecks(manifest: ActualReleaseEvidenceManifest): boolean {
  const checksById = new Map(
    manifest.diagnostics.checks.map((check) => [normalized(check.id), check] as const)
  );

  return REQUIRED_ACTUAL_RELEASE_ERROR_CHECK_IDS.every((requiredCheckId) => {
    const check = checksById.get(requiredCheckId);
    return check !== undefined && check.severity === 'error';
  });
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

const RETAINED_AMOUNT_TOLERANCE = 1e-9;

function amountsReconcile(total: number, components: ReadonlyArray<number>): boolean {
  return (
    Number.isFinite(total) &&
    components.every(Number.isFinite) &&
    Math.abs(total - components.reduce((sum, value) => sum + value, 0)) <=
      RETAINED_AMOUNT_TOLERANCE
  );
}

function hasValidNumericEvidence(manifest: ActualReleaseEvidenceManifest): boolean {
  const diagnostics = manifest.diagnostics;
  const population = manifest.releasePopulation;
  const diagnosticCounts = [
    diagnostics.sourceRows,
    diagnostics.acceptedRows,
    diagnostics.rejectedRows,
    diagnostics.mappedRows,
    diagnostics.unmappedRows,
    diagnostics.releasedRows,
    diagnostics.actualRows,
    diagnostics.nonActualRows,
  ];
  const manifestCounts = [
    population.sourceRows,
    population.acceptedRows,
    population.rejectedRows,
    population.mappedRows,
    population.unmappedRows,
    population.releasedRows,
    population.actualRows,
    population.nonActualRows,
  ];
  const amounts = [
    diagnostics.sourceAmount,
    diagnostics.acceptedAmount,
    diagnostics.rejectedAmount,
    diagnostics.mappedAmount,
    diagnostics.unmappedAmount,
    diagnostics.releasedAmount,
    population.sourceAmount,
    population.releasedAmount,
  ];

  return (
    diagnosticCounts.every(isNonNegativeInteger) &&
    manifestCounts.every(isNonNegativeInteger) &&
    amounts.every(Number.isFinite) &&
    diagnostics.sourceRows === diagnostics.acceptedRows + diagnostics.rejectedRows &&
    diagnostics.acceptedRows === diagnostics.mappedRows + diagnostics.unmappedRows &&
    diagnostics.releasedRows === diagnostics.actualRows + diagnostics.nonActualRows &&
    population.sourceRows === population.acceptedRows + population.rejectedRows &&
    population.acceptedRows === population.mappedRows + population.unmappedRows &&
    population.releasedRows === population.actualRows + population.nonActualRows &&
    amountsReconcile(diagnostics.sourceAmount, [
      diagnostics.acceptedAmount,
      diagnostics.rejectedAmount,
    ]) &&
    amountsReconcile(diagnostics.acceptedAmount, [
      diagnostics.mappedAmount,
      diagnostics.unmappedAmount,
    ])
  );
}

function hasValidReleaseIdentity(manifest: ActualReleaseEvidenceManifest): boolean {
  return (
    normalized(manifest.metadata.importBatchId).length > 0 &&
    normalized(manifest.metadata.sourceReference).length > 0 &&
    normalized(manifest.metadata.mappingMasterVersion).length > 0
  );
}

function sameReleasePopulation(
  left: ActualReleaseEvidenceManifest['releasePopulation'],
  right: ActualReleaseEvidenceManifest['releasePopulation']
): boolean {
  return (
    left.sourceRows === right.sourceRows &&
    left.acceptedRows === right.acceptedRows &&
    left.rejectedRows === right.rejectedRows &&
    left.mappedRows === right.mappedRows &&
    left.unmappedRows === right.unmappedRows &&
    left.releasedRows === right.releasedRows &&
    left.actualRows === right.actualRows &&
    left.nonActualRows === right.nonActualRows &&
    left.sourceAmount === right.sourceAmount &&
    left.releasedAmount === right.releasedAmount
  );
}

function manifestMatchesRetainedDiagnostics(
  manifest: ActualReleaseEvidenceManifest
): boolean {
  const diagnostics = manifest.diagnostics;
  const failedErrorCheckIds = diagnostics.checks
    .filter((check) => check.severity === 'error' && !check.passed)
    .map((check) => check.id);

  return (
    normalized(manifest.cutoffDate) === normalized(diagnostics.cutoffDate) &&
    manifest.releasePopulation.sourceRows === diagnostics.sourceRows &&
    manifest.releasePopulation.acceptedRows === diagnostics.acceptedRows &&
    manifest.releasePopulation.rejectedRows === diagnostics.rejectedRows &&
    manifest.releasePopulation.mappedRows === diagnostics.mappedRows &&
    manifest.releasePopulation.unmappedRows === diagnostics.unmappedRows &&
    manifest.releasePopulation.releasedRows === diagnostics.releasedRows &&
    manifest.releasePopulation.actualRows === diagnostics.actualRows &&
    manifest.releasePopulation.nonActualRows === diagnostics.nonActualRows &&
    manifest.releasePopulation.sourceAmount === diagnostics.sourceAmount &&
    manifest.releasePopulation.releasedAmount === diagnostics.releasedAmount &&
    sameStrings(manifest.failedErrorCheckIds, failedErrorCheckIds)
  );
}

/**
 * Independently reconciles a freshly derived controlled Actual release manifest
 * to an externally retained manifest for the same release.
 *
 * This closes a single-source-of-truth gap: rebuilding a manifest from current
 * runtime inputs is not, by itself, evidence that the release identity matches
 * the manifest retained by a governed external repository/version store.
 *
 * The diagnostic first checks that each manifest remains internally consistent
 * with the exact authoritative release-diagnostics object it retains. This is a
 * structural provenance check only: it deliberately does not require JavaScript
 * object identity, because a valid externally retained manifest may be
 * serialized/deserialized by a future durable-store adapter. The full diagnostic
 * check population must also retain explicit unique IDs under trimmed comparison,
 * matching the release-manifest construction boundary; this prevents passing/info
 * checks with ambiguous identity from being silently accepted after retention.
 * The canonical required error-level release controls must also remain present at
 * error severity on both the derived and retained sides. This independently
 * fail-closes retained evidence if a cutoff, source-validation, Mapping Master,
 * accepted/mapped, or release population bridge is omitted or downgraded after
 * serialization even when a stale evidenceReady flag remains true.
 * Numeric evidence is independently fail-closed as well: all retained row counts
 * must be non-negative integers, all retained monetary scalars must be finite, the
 * source/validation and accepted/mapping amount bridges must still reconcile within
 * the same audit tolerance used by controlled Actual diagnostics, and the retained
 * row-population identities must remain arithmetically possible. Monetary amounts
 * may legitimately be negative for reversals/credits; this control validates
 * reconciliation and finiteness rather than inventing a non-negative accounting rule.
 * Core release identity must remain explicit on both sides as well: import batch,
 * source reference and Mapping Master version cannot be blank merely because an
 * externally reconstructed manifest carries a stale or incorrect evidenceReady flag.
 * It also independently requires both retained cutoff values, plus any supplied
 * optional preparation timestamp, to satisfy the shared governed date-evidence
 * control before comparing release identity. Preparation time remains descriptive
 * audit evidence only: it is not compared across manifests and does not become an
 * approval, release chronology or commercial assumption. The diagnostic then compares
 * explicit release identity and control-population fields across the derived and
 * retained manifests: import batch, source reference, Mapping Master version, cutoff,
 * release population and failed error-check ids. Failed check ids are additionally
 * required to behave as stable set identities: blank or duplicate ids are blocking
 * because they make the retained control population ambiguous. Optional descriptive
 * preparer/notes fields and human-readable blocking-reason text are deliberately
 * excluded from identity because they do not define the released financial population.
 *
 * Boundary: this is read-only and asset-generic. It does not import/map/repair
 * Actuals, create or approve evidence, authenticate storage, approve/select
 * baselines, calculate PIR/economics, or introduce electricity/commercial terms.
 * Passing this diagnostic is not a cryptographic attestation; the retained
 * manifest must still come from an independently governed evidence store.
 */
export function diagnoseRetainedActualReleaseManifest(input: {
  derived: ActualReleaseEvidenceManifest;
  retained: ActualReleaseEvidenceManifest;
}): RetainedActualReleaseManifestDiagnostics {
  const issues: RetainedActualReleaseManifestIssue[] = [];
  const { derived, retained } = input;

  if (!derived.evidenceReady) {
    issues.push({
      code: 'DERIVED_EVIDENCE_NOT_READY',
      message: 'Freshly derived Actual release evidence is not release-ready.',
    });
  }

  if (!retained.evidenceReady) {
    issues.push({
      code: 'RETAINED_EVIDENCE_NOT_READY',
      message: 'Retained Actual release evidence is not marked release-ready.',
    });
  }

  if (!manifestMatchesRetainedDiagnostics(derived)) {
    issues.push({
      code: 'DERIVED_DIAGNOSTICS_MANIFEST_MISMATCH',
      message:
        'Freshly derived Actual release manifest does not reconcile to its retained authoritative diagnostics.',
    });
  }

  if (!manifestMatchesRetainedDiagnostics(retained)) {
    issues.push({
      code: 'RETAINED_DIAGNOSTICS_MANIFEST_MISMATCH',
      message:
        'Retained Actual release manifest does not reconcile to its retained authoritative diagnostics.',
    });
  }

  if (!hasValidDiagnosticCheckIdentity(derived)) {
    issues.push({
      code: 'DERIVED_DIAGNOSTIC_CHECK_IDENTITY_INVALID',
      message:
        'Freshly derived Actual release diagnostics must retain non-empty unique check ids under trimmed comparison.',
    });
  }

  if (!hasValidDiagnosticCheckIdentity(retained)) {
    issues.push({
      code: 'RETAINED_DIAGNOSTIC_CHECK_IDENTITY_INVALID',
      message:
        'Retained Actual release diagnostics must retain non-empty unique check ids under trimmed comparison.',
    });
  }

  if (!hasRequiredErrorChecks(derived)) {
    issues.push({
      code: 'DERIVED_REQUIRED_ERROR_CHECKS_INVALID',
      message:
        'Freshly derived Actual release diagnostics must retain every canonical required release control at error severity.',
    });
  }

  if (!hasRequiredErrorChecks(retained)) {
    issues.push({
      code: 'RETAINED_REQUIRED_ERROR_CHECKS_INVALID',
      message:
        'Retained Actual release diagnostics must retain every canonical required release control at error severity.',
    });
  }

  if (!hasValidNumericEvidence(derived)) {
    issues.push({
      code: 'DERIVED_NUMERIC_EVIDENCE_INVALID',
      message:
        'Freshly derived Actual release evidence must retain finite amounts, non-negative integer row counts, reconcilable source/mapping amount bridges and internally reconcilable row populations.',
    });
  }

  if (!hasValidNumericEvidence(retained)) {
    issues.push({
      code: 'RETAINED_NUMERIC_EVIDENCE_INVALID',
      message:
        'Retained Actual release evidence must retain finite amounts, non-negative integer row counts, reconcilable source/mapping amount bridges and internally reconcilable row populations.',
    });
  }

  if (!hasValidReleaseIdentity(derived)) {
    issues.push({
      code: 'DERIVED_RELEASE_IDENTITY_INVALID',
      message:
        'Freshly derived Actual release evidence must retain explicit import batch, source reference and Mapping Master version identities.',
    });
  }

  if (!hasValidReleaseIdentity(retained)) {
    issues.push({
      code: 'RETAINED_RELEASE_IDENTITY_INVALID',
      message:
        'Retained Actual release evidence must retain explicit import batch, source reference and Mapping Master version identities.',
    });
  }

  if (!isValidDateEvidence(derived.cutoffDate)) {
    issues.push({
      code: 'DERIVED_CUTOFF_DATE_INVALID',
      message: 'Freshly derived Actual release cutoff must be valid governed date evidence.',
    });
  }

  if (!isValidDateEvidence(retained.cutoffDate)) {
    issues.push({
      code: 'RETAINED_CUTOFF_DATE_INVALID',
      message: 'Retained Actual release cutoff must be valid governed date evidence.',
    });
  }

  if (
    derived.metadata.preparedAt !== undefined &&
    !isValidDateEvidence(derived.metadata.preparedAt)
  ) {
    issues.push({
      code: 'DERIVED_PREPARATION_DATE_INVALID',
      message:
        'Freshly derived Actual release preparation timestamp must be valid governed date evidence when supplied.',
    });
  }

  if (
    retained.metadata.preparedAt !== undefined &&
    !isValidDateEvidence(retained.metadata.preparedAt)
  ) {
    issues.push({
      code: 'RETAINED_PREPARATION_DATE_INVALID',
      message:
        'Retained Actual release preparation timestamp must be valid governed date evidence when supplied.',
    });
  }

  if (normalized(derived.metadata.importBatchId) !== normalized(retained.metadata.importBatchId)) {
    issues.push({
      code: 'IMPORT_BATCH_ID_MISMATCH',
      message: 'Derived Actual release import batch ID does not match retained evidence.',
    });
  }

  if (normalized(derived.metadata.sourceReference) !== normalized(retained.metadata.sourceReference)) {
    issues.push({
      code: 'SOURCE_REFERENCE_MISMATCH',
      message: 'Derived Actual release source reference does not match retained evidence.',
    });
  }

  if (
    normalized(derived.metadata.mappingMasterVersion) !==
    normalized(retained.metadata.mappingMasterVersion)
  ) {
    issues.push({
      code: 'MAPPING_MASTER_VERSION_MISMATCH',
      message: 'Derived Actual release Mapping Master version does not match retained evidence.',
    });
  }

  if (normalized(derived.cutoffDate) !== normalized(retained.cutoffDate)) {
    issues.push({
      code: 'CUTOFF_DATE_MISMATCH',
      message: 'Derived Actual release cutoff date does not match retained evidence.',
    });
  }

  if (!sameReleasePopulation(derived.releasePopulation, retained.releasePopulation)) {
    issues.push({
      code: 'RELEASE_POPULATION_MISMATCH',
      message: 'Derived Actual release population or amount does not exactly match retained evidence.',
    });
  }

  if (!hasValidSetIdentity(derived.failedErrorCheckIds)) {
    issues.push({
      code: 'DERIVED_FAILED_CHECK_IDENTITY_INVALID',
      message: 'Derived failed error-check ids must be non-empty and unique.',
    });
  }

  if (!hasValidSetIdentity(retained.failedErrorCheckIds)) {
    issues.push({
      code: 'RETAINED_FAILED_CHECK_IDENTITY_INVALID',
      message: 'Retained failed error-check ids must be non-empty and unique.',
    });
  }

  if (!sameStrings(derived.failedErrorCheckIds, retained.failedErrorCheckIds)) {
    issues.push({
      code: 'FAILED_CHECK_POPULATION_MISMATCH',
      message: 'Derived failed error-check population does not match retained evidence.',
    });
  }

  const frozenIssues: ReadonlyArray<RetainedActualReleaseManifestIssue> = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );

  return Object.freeze({
    passed: frozenIssues.length === 0,
    issues: frozenIssues,
  });
}