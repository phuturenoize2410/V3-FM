import {
  buildRegistryStructuralSignature,
  type BaselineApprovalPersistenceConfirmationBundle,
} from './baselineApprovalPersistenceIntentBundle';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface BaselinePersistenceRetainedIdentityDiagnostics {
  readonly ready: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

function present(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeRegistryStructuralSignature(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  try {
    return buildRegistryStructuralSignature(
      value as ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>
    );
  } catch {
    return null;
  }
}

/**
 * Re-validates retained/deserialized baseline-persistence confirmation identity
 * evidence without performing a write or changing baseline economics.
 *
 * A confirmation can legitimately cross a serialization boundary before an
 * audit/reporting or storage-adapter consumer observes it. This diagnostic does
 * not trust previously-computed `ready` flags alone: the retained request id,
 * registry-version tokens, target baseline id and governed timestamps must still
 * be explicit, retained approval/request/confirmation chronology must still be
 * valid, retained append-only request evidence must still describe the same
 * persistence intent envelope, the retained intent signatures must still reproduce
 * the exact handoff registry populations, and the retained durable-store read-back
 * snapshot must still reproduce its own retained structural evidence.
 *
 * Runtime envelope shape, identity tokens and retained registry populations are
 * validated before nested access, normalization or signature comparison so
 * malformed retained/deserialized evidence fails closed rather than throwing merely
 * because it no longer matches its TypeScript declaration.
 *
 * Structural signatures remain deterministic evidence strings only. This check
 * does not authenticate storage, prove compare-and-swap success, select an
 * in-place/event-sourced/append-new-version persistence semantic, or infer any
 * commercial, accounting or project-finance assumption.
 */
export function diagnoseBaselinePersistenceRetainedIdentity(
  confirmation: BaselineApprovalPersistenceConfirmationBundle
): BaselinePersistenceRetainedIdentityDiagnostics {
  const blockingReasons: string[] = [];
  const runtimeConfirmation = confirmation as unknown;

  if (!isRecord(runtimeConfirmation)) {
    return Object.freeze({
      ready: false,
      blockingReasons: Object.freeze([
        'Retained baseline persistence confirmation must remain an inspectable object envelope.',
      ]),
      warnings: Object.freeze([]),
    });
  }

  const warningsEvidence = runtimeConfirmation.warnings;
  const warnings = Array.isArray(warningsEvidence)
    ? warningsEvidence.filter((warning): warning is string => typeof warning === 'string')
    : [];

  if (!Array.isArray(warningsEvidence)) {
    blockingReasons.push(
      'Retained persistence confirmation warnings must remain an inspectable population.'
    );
  }

  const intentEvidence = runtimeConfirmation.intent;
  if (!isRecord(intentEvidence)) {
    blockingReasons.push(
      'Retained baseline persistence intent must remain an inspectable object envelope.'
    );
    return Object.freeze({
      ready: false,
      blockingReasons: Object.freeze([...blockingReasons]),
      warnings: Object.freeze(Array.from(new Set(warnings))),
    });
  }

  const handoffEvidence = intentEvidence.handoff;
  if (!isRecord(handoffEvidence)) {
    blockingReasons.push(
      'Retained baseline approval registry handoff must remain an inspectable object envelope.'
    );
    return Object.freeze({
      ready: false,
      blockingReasons: Object.freeze([...blockingReasons]),
      warnings: Object.freeze(Array.from(new Set(warnings))),
    });
  }

  const intent = intentEvidence as unknown as BaselineApprovalPersistenceConfirmationBundle['intent'];
  const handoff = handoffEvidence as unknown as BaselineApprovalPersistenceConfirmationBundle['intent']['handoff'];
  const intentEventEvidence = intentEvidence.appendOnlyEventEvidence;
  const intentEvent = isRecord(intentEventEvidence)
    ? intentEventEvidence as unknown as NonNullable<BaselineApprovalPersistenceConfirmationBundle['intent']['appendOnlyEventEvidence']>
    : null;
  const approvedCandidateEvidence = intentEvidence.approvedCandidate;
  const approvedAt = isRecord(approvedCandidateEvidence)
    ? approvedCandidateEvidence.approvedAt
    : undefined;
  const observedRegistry = handoff.registrySnapshot as unknown;
  const candidateRegistry = handoff.candidateRegistry as unknown;
  const persistedRegistry = runtimeConfirmation.persistedRegistrySnapshot as unknown;
  const retainedObservedRegistryStructuralSignature =
    safeRegistryStructuralSignature(observedRegistry);
  const retainedCandidateRegistryStructuralSignature = candidateRegistry === null
    ? null
    : safeRegistryStructuralSignature(candidateRegistry);
  const retainedPersistedRegistryStructuralSignature =
    safeRegistryStructuralSignature(persistedRegistry);

  if (runtimeConfirmation.ready !== true) {
    blockingReasons.push(
      'Retained baseline persistence identity requires a ready persistence confirmation.'
    );
  }

  if (intentEvidence.ready !== true) {
    blockingReasons.push(
      'Retained baseline persistence identity requires the retained persistence intent to remain ready.'
    );
  }

  if (!present(intentEvidence.requestId)) {
    blockingReasons.push('Retained persistence request id must remain explicit.');
  }
  if (!present(intentEvidence.observedRegistryVersion)) {
    blockingReasons.push('Retained observed registry version token must remain explicit.');
  }
  if (!present(runtimeConfirmation.persistedRegistryVersion)) {
    blockingReasons.push('Retained persisted registry version token must remain explicit.');
  }
  if (!present(handoffEvidence.targetBaselineId)) {
    blockingReasons.push('Retained persistence target baseline id must remain explicit.');
  }

  if (!isValidDateEvidence(intentEvidence.requestedAt as string)) {
    blockingReasons.push(
      'Retained persistence request timestamp must remain valid governed date evidence.'
    );
  }
  if (!isValidDateEvidence(runtimeConfirmation.confirmedAt as string)) {
    blockingReasons.push(
      'Retained persistence confirmation timestamp must remain valid governed date evidence.'
    );
  }
  if (typeof approvedAt !== 'string' || !isValidDateEvidence(approvedAt)) {
    blockingReasons.push(
      'Retained approved baseline candidate must retain valid explicit approval timestamp evidence.'
    );
  }

  if (retainedObservedRegistryStructuralSignature === null) {
    blockingReasons.push(
      'Retained observed registry population must remain structurally serializable baseline evidence.'
    );
  } else if (
    intentEvidence.observedRegistryStructuralSignature !==
    retainedObservedRegistryStructuralSignature
  ) {
    blockingReasons.push(
      'Retained observed registry population no longer reproduces the persistence intent structural evidence.'
    );
  }

  if (candidateRegistry !== null && retainedCandidateRegistryStructuralSignature === null) {
    blockingReasons.push(
      'Retained candidate registry population must remain structurally serializable baseline evidence.'
    );
  } else if (
    intentEvidence.candidateRegistryStructuralSignature !==
    retainedCandidateRegistryStructuralSignature
  ) {
    blockingReasons.push(
      'Retained candidate registry population no longer reproduces the persistence intent structural evidence.'
    );
  }

  if (intentEventEvidence !== null && intentEventEvidence !== undefined && !isRecord(intentEventEvidence)) {
    blockingReasons.push(
      'Retained append-only persistence-request evidence must remain an inspectable object envelope.'
    );
  }

  if (!intentEvent) {
    blockingReasons.push(
      'Retained persistence identity requires the append-only persistence-request evidence emitted by the exact intent.'
    );
  } else {
    const observedRegistrySize = Array.isArray(observedRegistry)
      ? observedRegistry.length
      : null;
    const candidateRegistrySize = Array.isArray(candidateRegistry)
      ? candidateRegistry.length
      : candidateRegistry === null
        ? 0
        : null;

    if (
      intentEvent.requestId !== intent.requestId ||
      intentEvent.requestedAt !== intent.requestedAt ||
      intentEvent.observedRegistryVersion !== intent.observedRegistryVersion ||
      intentEvent.targetBaselineId !== handoff.targetBaselineId ||
      observedRegistrySize === null ||
      candidateRegistrySize === null ||
      intentEvent.observedRegistrySize !== observedRegistrySize ||
      intentEvent.candidateRegistrySize !== candidateRegistrySize ||
      intentEvent.observedRegistryStructuralSignature !== intent.observedRegistryStructuralSignature ||
      intentEvent.candidateRegistryStructuralSignature !== intent.candidateRegistryStructuralSignature
    ) {
      blockingReasons.push(
        'Retained persistence-request evidence no longer matches the exact persistence intent envelope.'
      );
    }
  }

  if (retainedPersistedRegistryStructuralSignature === null) {
    blockingReasons.push(
      'Retained persisted registry snapshot must remain structurally serializable baseline evidence.'
    );
  } else if (
    runtimeConfirmation.persistedRegistryStructuralSignature !==
    retainedPersistedRegistryStructuralSignature
  ) {
    blockingReasons.push(
      'Retained persisted registry snapshot no longer reproduces its retained structural evidence.'
    );
  }

  if (
    present(intentEvidence.candidateRegistryStructuralSignature) &&
    runtimeConfirmation.persistedRegistryStructuralSignature !== intentEvidence.candidateRegistryStructuralSignature
  ) {
    blockingReasons.push(
      'Retained persisted registry structural evidence no longer matches the reviewed candidate registry.'
    );
  }

  const requestedAt = intentEvidence.requestedAt;
  const confirmedAt = runtimeConfirmation.confirmedAt;
  if (
    typeof approvedAt === 'string' &&
    typeof requestedAt === 'string' &&
    isValidDateEvidence(approvedAt) &&
    isValidDateEvidence(requestedAt) &&
    new Date(requestedAt).getTime() < new Date(approvedAt).getTime()
  ) {
    blockingReasons.push(
      'Retained persistence request cannot precede the explicit baseline approval timestamp.'
    );
  }

  if (
    typeof requestedAt === 'string' &&
    typeof confirmedAt === 'string' &&
    isValidDateEvidence(requestedAt) &&
    isValidDateEvidence(confirmedAt) &&
    new Date(confirmedAt).getTime() < new Date(requestedAt).getTime()
  ) {
    blockingReasons.push(
      'Retained persistence confirmation cannot precede the retained persistence-request timestamp.'
    );
  }

  if (
    typeof approvedAt === 'string' &&
    typeof confirmedAt === 'string' &&
    isValidDateEvidence(approvedAt) &&
    isValidDateEvidence(confirmedAt) &&
    new Date(confirmedAt).getTime() < new Date(approvedAt).getTime()
  ) {
    blockingReasons.push(
      'Retained persistence confirmation cannot precede the explicit baseline approval timestamp.'
    );
  }

  return Object.freeze({
    ready: blockingReasons.length === 0,
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze(Array.from(new Set(warnings))),
  });
}
