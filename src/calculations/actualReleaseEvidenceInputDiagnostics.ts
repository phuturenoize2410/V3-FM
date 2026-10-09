import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ActualReleaseEvidenceMetadata } from './actualReleaseEvidenceManifest';

export interface ActualReleaseEvidenceInputDiagnostics {
  readonly inputReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly diagnostics?: ActualReleaseDiagnostics;
  readonly metadata?: ActualReleaseEvidenceMetadata;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runtime preflight for retained/deserialized inputs before they enter the
 * Actual release evidence-manifest builder.
 *
 * This diagnostic is deliberately structural and asset-generic. It does not
 * calculate, normalize, repair, map, release, approve or persist Actual data.
 * It exists because TypeScript declarations do not protect a governance boundary
 * once evidence has crossed storage, JSON or other runtime serialization layers.
 *
 * Readiness here only means the two top-level envelopes remain inspectable and
 * therefore safe to pass into the authoritative manifest builder. The manifest
 * remains responsible for all release, Actual-only, Mapping Master, cutoff,
 * diagnostic-check and metadata governance semantics.
 */
export function diagnoseActualReleaseEvidenceInputs(
  diagnostics: unknown,
  metadata: unknown
): ActualReleaseEvidenceInputDiagnostics {
  const blockingReasons: string[] = [];

  const diagnosticsRecord = isRecord(diagnostics) ? diagnostics : undefined;
  const metadataRecord = isRecord(metadata) ? metadata : undefined;

  if (!diagnosticsRecord) {
    blockingReasons.push(
      'Actual release diagnostics must remain an inspectable object envelope before evidence-manifest construction.'
    );
  }

  if (!metadataRecord) {
    blockingReasons.push(
      'Actual release evidence metadata must remain an inspectable object envelope before evidence-manifest construction.'
    );
  }

  return Object.freeze({
    inputReady: blockingReasons.length === 0,
    blockingReasons: Object.freeze([...blockingReasons]),
    diagnostics: diagnosticsRecord
      ? diagnosticsRecord as unknown as ActualReleaseDiagnostics
      : undefined,
    metadata: metadataRecord
      ? metadataRecord as unknown as ActualReleaseEvidenceMetadata
      : undefined,
  });
}
