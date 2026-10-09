import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import {
  buildActualReleaseEvidenceManifest,
  type ActualReleaseEvidenceManifest,
  type ActualReleaseEvidenceMetadata,
} from './actualReleaseEvidenceManifest';
import { diagnoseActualReleaseEvidenceInputs } from './actualReleaseEvidenceInputDiagnostics';

export interface ControlledActualReleaseEvidenceManifestBundle {
  readonly inputReady: boolean;
  readonly evidenceReady: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly diagnostics?: ActualReleaseDiagnostics;
  readonly metadata?: ActualReleaseEvidenceMetadata;
  readonly manifest?: ActualReleaseEvidenceManifest;
}

/**
 * Runtime-safe admission boundary for retained/deserialized Actual release evidence.
 *
 * The authoritative evidence-manifest builder intentionally assumes typed inputs.
 * This wrapper protects that builder from malformed top-level runtime envelopes
 * without normalizing, repairing or fabricating source diagnostics or metadata.
 *
 * A malformed envelope therefore fails closed before any nested property access.
 * Valid envelopes are passed through by exact object identity to the existing
 * manifest builder, which remains the sole owner of release, cutoff, Mapping Master,
 * metadata and diagnostic-check semantics.
 *
 * This bundle is calculation-free and asset-generic. It does not import, map,
 * classify, convert, release, approve, persist or promote Actual rows.
 */
export function buildControlledActualReleaseEvidenceManifestBundle(
  diagnostics: unknown,
  metadata: unknown
): ControlledActualReleaseEvidenceManifestBundle {
  const inputDiagnostics = diagnoseActualReleaseEvidenceInputs(diagnostics, metadata);

  if (!inputDiagnostics.inputReady || !inputDiagnostics.diagnostics || !inputDiagnostics.metadata) {
    return Object.freeze({
      inputReady: false,
      evidenceReady: false,
      blockingReasons: Object.freeze([...inputDiagnostics.blockingReasons]),
      diagnostics: inputDiagnostics.diagnostics,
      metadata: inputDiagnostics.metadata,
      manifest: undefined,
    });
  }

  const manifest = buildActualReleaseEvidenceManifest(
    inputDiagnostics.diagnostics,
    inputDiagnostics.metadata
  );

  return Object.freeze({
    inputReady: true,
    evidenceReady: manifest.evidenceReady,
    blockingReasons: manifest.blockingReasons,
    diagnostics: inputDiagnostics.diagnostics,
    metadata: inputDiagnostics.metadata,
    manifest,
  });
}
