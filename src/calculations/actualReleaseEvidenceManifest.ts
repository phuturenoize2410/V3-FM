import type { ActualReleaseCheck, ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface ActualReleaseEvidenceMetadata {
  readonly importBatchId: string;
  readonly sourceReference: string;
  readonly mappingMasterVersion: string;
  readonly preparedBy?: string;
  readonly preparedAt?: string;
  readonly notes?: string;
}

export interface ActualReleaseEvidenceManifest {
  readonly evidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly metadata: Readonly<ActualReleaseEvidenceMetadata>;
  readonly diagnostics: ActualReleaseDiagnostics;
  readonly cutoffDate: string;
  readonly releasePopulation: Readonly<{
    sourceRows: number;
    acceptedRows: number;
    rejectedRows: number;
    mappedRows: number;
    unmappedRows: number;
    releasedRows: number;
    actualRows: number;
    nonActualRows: number;
    sourceAmount: number;
    releasedAmount: number;
  }>;
  readonly failedErrorCheckIds: ReadonlyArray<string>;
}

export const REQUIRED_ACTUAL_RELEASE_ERROR_CHECK_IDS = Object.freeze([
  'actual-cutoff-control',
  'actual-source-validation-row-bridge',
  'actual-source-validation-amount-bridge',
  'actual-mapping-master-rule-population',
  'actual-accepted-mapping-row-bridge',
  'actual-accepted-mapping-amount-bridge',
  'actual-release-population-bridge',
  'actual-release-amount-bridge',
] as const);

const ACTUAL_RELEASE_COUNT_FIELDS = Object.freeze([
  'sourceRows',
  'acceptedRows',
  'rejectedRows',
  'mappedRows',
  'unmappedRows',
  'releasedRows',
  'actualRows',
  'nonActualRows',
] as const);

const ACTUAL_RELEASE_AMOUNT_FIELDS = Object.freeze([
  'sourceAmount',
  'acceptedAmount',
  'rejectedAmount',
  'mappedAmount',
  'unmappedAmount',
  'releasedAmount',
] as const);

function present(value: unknown): boolean {
  return typeof value === 'string' && Boolean(value.trim());
}

function runtimeRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : Object.freeze({});
}

function trimmedRuntimeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function exactRuntimeIdentity(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized !== value) return undefined;
  return value;
}

function isReleaseCheckEnvelope(value: unknown): value is ActualReleaseCheck {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const check = value as Partial<ActualReleaseCheck>;
  return typeof check.id === 'string' &&
    typeof check.passed === 'boolean' &&
    (check.severity === 'error' || check.severity === 'warning' || check.severity === 'info') &&
    typeof check.label === 'string' &&
    typeof check.detail === 'string';
}

function retainRuntimeDiagnosticChecks(diagnostics: ActualReleaseDiagnostics): Readonly<{
  checks: ReadonlyArray<ActualReleaseCheck>;
  populationMalformed: boolean;
  malformedRows: number;
}> {
  const runtimeChecks = (diagnostics as { readonly checks?: unknown }).checks;
  if (!Array.isArray(runtimeChecks)) {
    return Object.freeze({
      checks: Object.freeze([]),
      populationMalformed: true,
      malformedRows: 0,
    });
  }

  const checks = runtimeChecks.filter(isReleaseCheckEnvelope);
  return Object.freeze({
    checks: Object.freeze([...checks]),
    populationMalformed: false,
    malformedRows: runtimeChecks.length - checks.length,
  });
}

function duplicatedDiagnosticCheckIds(checks: ReadonlyArray<ActualReleaseCheck>): ReadonlyArray<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  checks.forEach((check) => {
    const comparisonKey = check.id.trim();
    if (seen.has(comparisonKey)) {
      duplicates.add(comparisonKey);
      return;
    }
    seen.add(comparisonKey);
  });

  return Object.freeze(Array.from(duplicates));
}

function diagnoseRuntimeDiagnosticScalars(
  diagnostics: ActualReleaseDiagnostics
): ReadonlyArray<string> {
  const runtimeDiagnostics = runtimeRecord(diagnostics as unknown);
  const blockingReasons: string[] = [];

  ACTUAL_RELEASE_COUNT_FIELDS.forEach((field) => {
    const value = runtimeDiagnostics[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      blockingReasons.push(
        `Actual release diagnostic "${field}" must remain a finite non-negative integer.`
      );
    }
  });

  ACTUAL_RELEASE_AMOUNT_FIELDS.forEach((field) => {
    const value = runtimeDiagnostics[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      blockingReasons.push(
        `Actual release diagnostic "${field}" must remain a finite numeric amount.`
      );
    }
  });

  if (typeof runtimeDiagnostics.releaseReady !== 'boolean') {
    blockingReasons.push('Actual release diagnostic "releaseReady" must remain explicit boolean evidence.');
  }

  if (typeof runtimeDiagnostics.actualOnlyReleaseReady !== 'boolean') {
    blockingReasons.push(
      'Actual release diagnostic "actualOnlyReleaseReady" must remain explicit boolean evidence.'
    );
  }

  return Object.freeze(blockingReasons);
}

/**
 * Builds an immutable evidence manifest for a controlled Actual release.
 *
 * The manifest is intentionally calculation-free and asset-generic. It does not
 * import, map, repair, approve, persist or reclassify Actual rows. It only binds
 * externally supplied source/mapping references to the independent release
 * diagnostics that already govern lifecycle/PIR eligibility.
 *
 * The returned manifest and its nested evidence objects/arrays are frozen so a
 * release-ready evidence package cannot be mutated in-memory after construction
 * before it is handed to baseline, PIR or reporting governance. The manifest
 * retains the exact authoritative diagnostics object supplied by the caller so
 * downstream governance can preserve object-identity continuity instead of
 * reconstructing release evidence from copied scalar summaries alone.
 *
 * Design boundaries:
 * - diagnostics must already be generic release-ready and explicitly Actual-only;
 * - retained/deserialized row-count, amount and readiness scalar evidence must
 *   remain runtime-valid; malformed scalar shapes fail closed and are not coerced;
 * - diagnostic check evidence must retain a runtime-safe array of complete check
 *   envelopes. Malformed/deserialized rows fail closed and are never repaired,
 *   coerced or silently discarded into evidence readiness;
 * - diagnostic check IDs must remain explicit and unique under trimmed comparison
 *   so retained/reconstructed diagnostics cannot become audit-ambiguous;
 * - the core error-level diagnostic controls emitted by the authoritative Actual
 *   release builder must remain present at this evidence boundary. A retained or
 *   reconstructed diagnostic object cannot become evidence-ready by omitting a
 *   required population/cutoff/Mapping Master bridge while retaining stale scalar
 *   readiness flags;
 * - generic controlled lifecycle releases may still carry commitment / ETC /
 *   budget / model-baseline classes, but those populations cannot be represented
 *   by this Actual evidence manifest without a separate purpose-built handoff;
 * - import batch, source reference and Mapping Master version are mandatory and
 *   must be supplied by the caller; no identifiers are inferred or invented;
 * - governed metadata identities must remain exact caller evidence. Leading or
 *   trailing whitespace fails closed rather than being silently normalized into a
 *   different import batch, source reference or Mapping Master version identity;
 * - metadata is also treated as runtime evidence: malformed/deserialized scalar
 *   fields fail closed instead of throwing or being coerced into identifiers;
 * - cutoff evidence must independently satisfy the shared governed date control;
 * - optional preparation timestamp remains descriptive evidence only, but when
 *   supplied it must also satisfy the shared governed date control rather than
 *   carrying invalid audit chronology into downstream evidence packages;
 * - optional preparer/notes fields remain descriptive evidence only and are not
 *   treated as approval;
 * - retaining diagnostics identity does not authenticate an external source,
 *   persist evidence or create a stronger release decision than diagnostics;
 * - this manifest does not create or approve an Actual-to-Date baseline.
 */
export function buildActualReleaseEvidenceManifest(
  diagnostics: ActualReleaseDiagnostics,
  metadata: ActualReleaseEvidenceMetadata
): ActualReleaseEvidenceManifest {
  const blockingReasons: string[] = [];
  const runtimeDiagnostics = runtimeRecord(diagnostics as unknown);
  const runtimeMetadata = runtimeRecord(metadata as unknown);
  const importBatchId = exactRuntimeIdentity(runtimeMetadata.importBatchId);
  const sourceReference = exactRuntimeIdentity(runtimeMetadata.sourceReference);
  const mappingMasterVersion = exactRuntimeIdentity(runtimeMetadata.mappingMasterVersion);
  const preparedBy = trimmedRuntimeString(runtimeMetadata.preparedBy);
  const preparedAt = trimmedRuntimeString(runtimeMetadata.preparedAt);
  const notes = trimmedRuntimeString(runtimeMetadata.notes);

  blockingReasons.push(...diagnoseRuntimeDiagnosticScalars(diagnostics));

  if (!importBatchId) {
    blockingReasons.push(
      'Actual release evidence requires an explicit import batch ID with exact, non-whitespace-normalized identity.'
    );
  }

  if (!sourceReference) {
    blockingReasons.push(
      'Actual release evidence requires an explicit source reference with exact, non-whitespace-normalized identity.'
    );
  }

  if (!mappingMasterVersion) {
    blockingReasons.push(
      'Actual release evidence requires an explicit Mapping Master version with exact, non-whitespace-normalized identity.'
    );
  }

  if (!isValidDateEvidence(runtimeDiagnostics.cutoffDate)) {
    blockingReasons.push('Actual release diagnostics must contain a valid explicit cutoff date.');
  }

  if (runtimeMetadata.preparedAt !== undefined && !preparedAt) {
    blockingReasons.push(
      'Actual release preparation timestamp must be valid governed date evidence when supplied.'
    );
  } else if (preparedAt !== undefined && !isValidDateEvidence(preparedAt)) {
    blockingReasons.push(
      'Actual release preparation timestamp must be valid governed date evidence when supplied.'
    );
  }

  if (runtimeMetadata.preparedBy !== undefined && typeof runtimeMetadata.preparedBy !== 'string') {
    blockingReasons.push('Actual release preparer evidence must be a string when supplied.');
  }

  if (runtimeMetadata.notes !== undefined && typeof runtimeMetadata.notes !== 'string') {
    blockingReasons.push('Actual release notes evidence must be a string when supplied.');
  }

  const retainedChecks = retainRuntimeDiagnosticChecks(diagnostics);
  if (retainedChecks.populationMalformed) {
    blockingReasons.push(
      'Actual release diagnostics check population is malformed; audit check evidence must be an explicit array.'
    );
  }
  if (retainedChecks.malformedRows > 0) {
    blockingReasons.push(
      `Actual release diagnostics contain ${retainedChecks.malformedRows} malformed check row(s); retained audit evidence cannot be repaired or coerced.`
    );
  }

  const blankDiagnosticCheckIds = retainedChecks.checks.filter((check) => !present(check.id)).length;
  const duplicateDiagnosticCheckIds = duplicatedDiagnosticCheckIds(retainedChecks.checks);
  const diagnosticChecksById = new Map(
    retainedChecks.checks.map((check) => [check.id.trim(), check] as const)
  );

  if (blankDiagnosticCheckIds > 0) {
    blockingReasons.push(
      `Actual release diagnostics contain ${blankDiagnosticCheckIds} blank check ID(s); audit check identity must be explicit.`
    );
  }

  if (duplicateDiagnosticCheckIds.length > 0) {
    blockingReasons.push(
      `Actual release diagnostics contain ${duplicateDiagnosticCheckIds.length} duplicate check ID(s) under trimmed comparison; audit check identity must be unique.`
    );
  }

  REQUIRED_ACTUAL_RELEASE_ERROR_CHECK_IDS.forEach((requiredCheckId) => {
    const retainedCheck = diagnosticChecksById.get(requiredCheckId);
    if (!retainedCheck) {
      blockingReasons.push(
        `Actual release diagnostics are missing required error check "${requiredCheckId}".`
      );
      return;
    }

    if (retainedCheck.severity !== 'error') {
      blockingReasons.push(
        `Actual release diagnostic "${requiredCheckId}" must remain error-severity evidence.`
      );
    }
  });

  const failedErrorCheckIds = retainedChecks.checks
    .filter((check) => check.severity === 'error' && !check.passed)
    .map((check) => check.id)
    .sort();

  if (runtimeDiagnostics.releaseReady !== true) {
    blockingReasons.push('Controlled Actual release diagnostics are not release-ready.');
  }

  if (runtimeDiagnostics.actualOnlyReleaseReady !== true) {
    blockingReasons.push(
      'Actual release evidence requires an Actual-only controlled population; explicit non-Actual lifecycle data classes cannot be promoted into Actual evidence.'
    );
  }

  if (failedErrorCheckIds.length > 0) {
    blockingReasons.push(
      `Actual release evidence has ${failedErrorCheckIds.length} failed error-severity diagnostic check(s).`
    );
  }

  const runtimeReleasedRows = runtimeDiagnostics.releasedRows;
  if (
    typeof runtimeReleasedRows === 'number' &&
    Number.isFinite(runtimeReleasedRows) &&
    Number.isInteger(runtimeReleasedRows) &&
    runtimeReleasedRows === 0
  ) {
    blockingReasons.push('Actual release evidence requires a non-empty released population.');
  }

  const normalizedMetadata = Object.freeze({
    importBatchId: typeof runtimeMetadata.importBatchId === 'string' ? runtimeMetadata.importBatchId : '',
    sourceReference: typeof runtimeMetadata.sourceReference === 'string' ? runtimeMetadata.sourceReference : '',
    mappingMasterVersion: typeof runtimeMetadata.mappingMasterVersion === 'string'
      ? runtimeMetadata.mappingMasterVersion
      : '',
    preparedBy,
    preparedAt,
    notes,
  });

  const releasePopulation = Object.freeze({
    sourceRows: diagnostics.sourceRows,
    acceptedRows: diagnostics.acceptedRows,
    rejectedRows: diagnostics.rejectedRows,
    mappedRows: diagnostics.mappedRows,
    unmappedRows: diagnostics.unmappedRows,
    releasedRows: diagnostics.releasedRows,
    actualRows: diagnostics.actualRows,
    nonActualRows: diagnostics.nonActualRows,
    sourceAmount: diagnostics.sourceAmount,
    releasedAmount: diagnostics.releasedAmount,
  });

  return Object.freeze({
    evidenceReady: blockingReasons.length === 0,
    blockingReasons: Object.freeze([...blockingReasons]),
    metadata: normalizedMetadata,
    diagnostics,
    cutoffDate: diagnostics.cutoffDate,
    releasePopulation,
    failedErrorCheckIds: Object.freeze([...failedErrorCheckIds]),
  });
}
