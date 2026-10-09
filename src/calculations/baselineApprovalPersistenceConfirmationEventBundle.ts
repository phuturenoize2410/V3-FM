import type { BaselineApprovalPersistenceConfirmationBundle } from './baselineApprovalPersistenceIntentBundle';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface BaselineApprovalPersistenceConfirmationEventEvidence {
  readonly eventType: 'baseline_approval_registry_persistence_confirmed';
  readonly requestId: string;
  readonly requestedAt: string;
  readonly confirmedAt: string;
  readonly targetBaselineId: string;
  readonly observedRegistryVersion: string;
  readonly persistedRegistryVersion: string;
  readonly observedRegistrySize: number;
  readonly candidateRegistrySize: number;
  readonly persistedRegistrySize: number;
  readonly observedRegistryStructuralSignature: string;
  readonly candidateRegistryStructuralSignature: string;
  readonly persistedRegistryStructuralSignature: string;
}

export interface BaselineApprovalPersistenceConfirmationEventBundle {
  readonly ready: boolean;
  readonly confirmation: BaselineApprovalPersistenceConfirmationBundle;
  readonly appendOnlyConfirmationEventEvidence: Readonly<BaselineApprovalPersistenceConfirmationEventEvidence> | null;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Produces append-only audit evidence only after a persistence confirmation has
 * already proved that the caller-supplied durable-store read-back structurally
 * matches the exact reviewed candidate registry population.
 *
 * The event retains the observed/pre-write, reviewed-candidate and persisted
 * read-back structural signatures and population cardinalities together so
 * downstream audit consumers can navigate the full structural transition without
 * reconstructing the pre-write or reviewed populations from loose registry-version
 * tokens. These remain canonical evidence strings only; they are not cryptographic
 * hashes or durable-store authentication.
 *
 * The retained persistence-request event must also remain exactly aligned with its
 * enclosing intent envelope. This protects the confirmation boundary against a
 * structurally compatible but drifted/deserialized caller object whose request id,
 * version token, target identity, registry cardinality or structural signatures no
 * longer describe the same reviewed intent. This is in-memory evidence continuity,
 * not authentication of the caller or durable store.
 *
 * Confirmation evidence is also fail-closed on event chronology. The retained
 * request timestamp, exact approved-candidate timestamp and confirmation timestamp
 * must each remain valid governed date evidence at this event boundary before
 * chronology is evaluated, and confirmation cannot precede either request or
 * approval. This is defense-in-depth for retained/reconstructed governance objects:
 * it does not infer storage latency, write semantics, business-day conventions or
 * any commercial/financial timing assumption.
 *
 * The returned governance envelope and append-only event contract are immutable,
 * together with the blocker/warning populations, so reporting consumers cannot
 * mutate retained persistence evidence or diagnostic state after evaluation. This
 * does not freeze or alter the caller-owned durable store, and it changes no
 * approval or financial logic.
 *
 * This is deliberately not a persistence adapter and does not authenticate the
 * storage system, prove a successful compare-and-swap operation, or choose between
 * in-place, event-sourced, or append-new-version storage semantics. It only binds
 * the already-governed request/confirmation identities and structural evidence into
 * a stable event payload that an external audit/event store may retain.
 */
export function buildBaselineApprovalPersistenceConfirmationEventBundle(input: {
  readonly confirmation: BaselineApprovalPersistenceConfirmationBundle;
}): BaselineApprovalPersistenceConfirmationEventBundle {
  const blockingReasons: string[] = [];
  const warnings = [...input.confirmation.warnings];
  const intent = input.confirmation.intent;
  const intentEvent = intent.appendOnlyEventEvidence;
  const approvedCandidate = intent.approvedCandidate;
  const candidateRegistryStructuralSignature = intent.candidateRegistryStructuralSignature;

  if (!input.confirmation.ready) {
    blockingReasons.push(
      'Persistence confirmation event requires a ready durable-store read-back confirmation.'
    );
  }
  if (!intent.ready || !intentEvent || !candidateRegistryStructuralSignature) {
    blockingReasons.push(
      'Persistence confirmation event requires the exact ready persistence intent and its retained append-only request evidence.'
    );
  }
  if (intentEvent && !isValidDateEvidence(intentEvent.requestedAt)) {
    blockingReasons.push(
      'Persistence confirmation event requires the retained persistence-request timestamp to remain valid governed date evidence.'
    );
  }
  if (!isValidDateEvidence(input.confirmation.confirmedAt)) {
    blockingReasons.push(
      'Persistence confirmation event requires the retained confirmation timestamp to remain valid governed date evidence.'
    );
  }
  if (!approvedCandidate?.approvedAt || !isValidDateEvidence(approvedCandidate.approvedAt)) {
    blockingReasons.push(
      'Persistence confirmation event requires valid explicit approval timestamp evidence on the exact approved baseline candidate.'
    );
  }
  if (
    intentEvent &&
    (
      intentEvent.requestId !== intent.requestId ||
      intentEvent.requestedAt !== intent.requestedAt ||
      intentEvent.observedRegistryVersion !== intent.observedRegistryVersion ||
      intentEvent.targetBaselineId !== intent.handoff.targetBaselineId ||
      intentEvent.observedRegistrySize !== intent.handoff.registrySnapshot.length ||
      intentEvent.candidateRegistrySize !== (intent.handoff.candidateRegistry?.length ?? 0) ||
      intentEvent.observedRegistryStructuralSignature !== intent.observedRegistryStructuralSignature ||
      intentEvent.candidateRegistryStructuralSignature !== candidateRegistryStructuralSignature
    )
  ) {
    blockingReasons.push(
      'Persistence confirmation event cannot be emitted because retained request evidence no longer matches the exact persistence intent envelope.'
    );
  }
  if (
    candidateRegistryStructuralSignature &&
    input.confirmation.persistedRegistryStructuralSignature !== candidateRegistryStructuralSignature
  ) {
    blockingReasons.push(
      'Persistence confirmation event cannot be emitted because persisted registry evidence no longer matches the reviewed candidate registry.'
    );
  }
  if (
    intentEvent &&
    input.confirmation.persistedRegistrySnapshot.length !== intentEvent.candidateRegistrySize
  ) {
    blockingReasons.push(
      'Persistence confirmation event cannot be emitted because durable-store read-back cardinality differs from the reviewed candidate registry.'
    );
  }
  if (
    intentEvent &&
    isValidDateEvidence(intentEvent.requestedAt) &&
    isValidDateEvidence(input.confirmation.confirmedAt) &&
    new Date(input.confirmation.confirmedAt).getTime() < new Date(intentEvent.requestedAt).getTime()
  ) {
    blockingReasons.push(
      'Persistence confirmation event cannot precede the retained persistence-request timestamp.'
    );
  }
  if (
    approvedCandidate?.approvedAt &&
    isValidDateEvidence(approvedCandidate.approvedAt) &&
    isValidDateEvidence(input.confirmation.confirmedAt) &&
    new Date(input.confirmation.confirmedAt).getTime() <
      new Date(approvedCandidate.approvedAt).getTime()
  ) {
    blockingReasons.push(
      'Persistence confirmation event cannot precede the explicit approval timestamp retained on the approved baseline candidate.'
    );
  }

  const ready = blockingReasons.length === 0;
  const appendOnlyConfirmationEventEvidence =
    ready && intentEvent && candidateRegistryStructuralSignature
      ? Object.freeze<BaselineApprovalPersistenceConfirmationEventEvidence>({
          eventType: 'baseline_approval_registry_persistence_confirmed',
          requestId: intentEvent.requestId,
          requestedAt: intentEvent.requestedAt,
          confirmedAt: input.confirmation.confirmedAt,
          targetBaselineId: intentEvent.targetBaselineId,
          observedRegistryVersion: intentEvent.observedRegistryVersion,
          persistedRegistryVersion: input.confirmation.persistedRegistryVersion,
          observedRegistrySize: intentEvent.observedRegistrySize,
          candidateRegistrySize: intentEvent.candidateRegistrySize,
          persistedRegistrySize: input.confirmation.persistedRegistrySnapshot.length,
          observedRegistryStructuralSignature:
            intentEvent.observedRegistryStructuralSignature,
          candidateRegistryStructuralSignature,
          persistedRegistryStructuralSignature:
            input.confirmation.persistedRegistryStructuralSignature,
        })
      : null;

  return Object.freeze({
    ready,
    confirmation: input.confirmation,
    appendOnlyConfirmationEventEvidence,
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze(Array.from(new Set(warnings))),
  });
}
