import type { BaselineApprovalRegistryHandoffBundle } from './baselineApprovalRegistryHandoffBundle';
import type {
  BaselineSourceRef,
  InvestmentBaselineSnapshot,
} from './baselineVersioningEngine';
import { isValidDateEvidence } from './dateEvidenceControls';

export interface BaselineApprovalPersistenceEventEvidence {
  readonly eventType: 'baseline_approval_registry_handoff_ready';
  readonly requestId: string;
  readonly requestedAt: string;
  readonly observedRegistryVersion: string;
  readonly targetBaselineId: string;
  readonly observedRegistrySize: number;
  readonly candidateRegistrySize: number;
  /**
   * Canonical, deterministic structural evidence for the exact retained registry
   * populations reviewed by this persistence intent. These are not cryptographic
   * hashes and must not be treated as authentication, tamper-proofing or durable
   * storage versions.
   */
  readonly observedRegistryStructuralSignature: string;
  readonly candidateRegistryStructuralSignature: string;
}

export interface BaselineApprovalPersistenceIntentBundle {
  readonly ready: boolean;
  readonly handoff: BaselineApprovalRegistryHandoffBundle;
  readonly observedRegistryVersion: string;
  readonly requestId: string;
  readonly requestedAt: string;
  readonly targetDraft: Readonly<InvestmentBaselineSnapshot> | null;
  readonly approvedCandidate: Readonly<InvestmentBaselineSnapshot> | null;
  readonly observedRegistryStructuralSignature: string;
  readonly candidateRegistryStructuralSignature: string | null;
  readonly appendOnlyEventEvidence: Readonly<BaselineApprovalPersistenceEventEvidence> | null;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface BaselineApprovalPersistenceConfirmationBundle {
  readonly ready: boolean;
  readonly intent: BaselineApprovalPersistenceIntentBundle;
  readonly persistedRegistryVersion: string;
  readonly persistedRegistrySnapshot: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
  readonly persistedRegistryStructuralSignature: string;
  readonly confirmedAt: string;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

function canonicalOptional(value: string | undefined): string | null {
  return value === undefined ? null : value;
}

function canonicalSourceRef(sourceRef: Readonly<BaselineSourceRef>): object {
  return {
    sourceSystem: canonicalOptional(sourceRef.sourceSystem),
    sourceFile: canonicalOptional(sourceRef.sourceFile),
    sourceVersion: canonicalOptional(sourceRef.sourceVersion),
    sourceUrl: canonicalOptional(sourceRef.sourceUrl),
    importedAt: canonicalOptional(sourceRef.importedAt),
  };
}

function canonicalSnapshot(
  snapshot: Readonly<InvestmentBaselineSnapshot>
): object {
  const metrics = Object.keys(snapshot.metrics)
    .sort()
    .reduce<Record<string, number | null>>((result, metric) => {
      result[metric] = snapshot.metrics[metric];
      return result;
    }, {});

  return {
    id: snapshot.id,
    kind: snapshot.kind,
    name: snapshot.name,
    projectId: canonicalOptional(snapshot.projectId),
    asOfDate: snapshot.asOfDate,
    createdAt: snapshot.createdAt,
    status: snapshot.status,
    approvedAt: canonicalOptional(snapshot.approvedAt),
    approvedBy: canonicalOptional(snapshot.approvedBy),
    predecessorId: canonicalOptional(snapshot.predecessorId),
    modelVersion: canonicalOptional(snapshot.modelVersion),
    notes: canonicalOptional(snapshot.notes),
    sourceRefs: (snapshot.sourceRefs ?? []).map(canonicalSourceRef),
    metrics,
  };
}

function freezeSnapshotEvidence(
  snapshot: Readonly<InvestmentBaselineSnapshot>
): Readonly<InvestmentBaselineSnapshot> {
  return Object.freeze({
    ...snapshot,
    sourceRefs: snapshot.sourceRefs
      ? Object.freeze(snapshot.sourceRefs.map((ref) => Object.freeze({ ...ref })))
      : undefined,
    metrics: Object.freeze({ ...snapshot.metrics }),
  });
}

function freezeRegistryEvidence(
  registry: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>
): ReadonlyArray<Readonly<InvestmentBaselineSnapshot>> {
  return Object.freeze(registry.map(freezeSnapshotEvidence));
}

/**
 * Produces deterministic structural evidence over the full ordered baseline
 * population using only governed baseline fields. The output deliberately remains
 * a plain canonical serialization rather than pretending to be a cryptographic or
 * storage-system identity.
 */
export function buildRegistryStructuralSignature(
  registry: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>
): string {
  return JSON.stringify(registry.map(canonicalSnapshot));
}

/**
 * Builds a fail-closed persistence intent over one exact approval-to-registry
 * handoff. This is deliberately not a persistence adapter.
 *
 * The control proves only that the handoff still describes a single-record
 * approval transition over the exact retained registry population:
 * - registry length and ordering are unchanged;
 * - every non-target candidate entry is the exact retained registry object;
 * - exactly one target draft exists and exactly one approved candidate exists;
 * - the target id is unchanged and its status moves from draft to approved; and
 * - the append-only event is bound to deterministic structural evidence for the
 *   full observed and candidate registry populations reviewed by this intent.
 *
 * Persistence-request chronology is also fail-closed against the exact approved
 * candidate: the retained candidate must carry valid explicit `approvedAt` evidence,
 * and a valid `requestedAt` cannot precede that approval timestamp. This preserves
 * approval-to-persistence audit ordering without inferring storage latency or
 * durable-store write semantics.
 *
 * `observedRegistryVersion` is an opaque caller-supplied concurrency token. FinMod
 * retains it but does not invent, increment or authenticate it. A storage adapter
 * may use that token for compare-and-swap / optimistic-concurrency checks.
 *
 * The returned structural signatures are canonical evidence strings, not
 * cryptographic hashes. They let downstream audit/reporting code prove it is still
 * referring to the same reviewed registry content without reconstructing the
 * population from loose ids, but they do not authenticate a storage system or
 * replace its own version/checksum controls.
 *
 * The returned append-only event is governance evidence that can be written to an
 * external event/audit log. It does NOT mean the baseline registry itself has been
 * persisted, and it deliberately does not decide whether the durable baseline
 * store should use an in-place status transition, an event-sourced projection, or
 * a new versioned record id. That storage semantic remains unresolved and must not
 * be guessed here.
 *
 * The returned intent envelope and its blocker/warning populations are immutable.
 * This prevents downstream consumers from mutating reviewed readiness or diagnostic
 * state after the exact registry signatures have been established. Caller-owned
 * handoff objects and durable storage are not deep-frozen or otherwise modified.
 */
export function buildBaselineApprovalPersistenceIntentBundle(input: {
  handoff: BaselineApprovalRegistryHandoffBundle;
  observedRegistryVersion: string;
  requestId: string;
  requestedAt: string;
}): BaselineApprovalPersistenceIntentBundle {
  const blockingReasons: string[] = [];
  const warnings = [...input.handoff.warnings];
  const observedRegistryVersion = input.observedRegistryVersion.trim();
  const requestId = input.requestId.trim();
  const requestedAt = input.requestedAt.trim();

  if (!input.handoff.ready || !input.handoff.candidateRegistry) {
    blockingReasons.push(
      'Baseline approval registry handoff is not ready for persistence review.'
    );
  }
  if (!observedRegistryVersion) {
    blockingReasons.push(
      'Persistence review requires an explicit observed registry version token.'
    );
  }
  if (!requestId) {
    blockingReasons.push('Persistence review requires an explicit request id.');
  }
  if (!isValidDateEvidence(requestedAt)) {
    blockingReasons.push(
      'Persistence review requires a valid explicit request timestamp.'
    );
  }

  const registry = input.handoff.registrySnapshot;
  const candidate = input.handoff.candidateRegistry;
  const observedRegistryStructuralSignature = buildRegistryStructuralSignature(registry);
  const candidateRegistryStructuralSignature = candidate
    ? buildRegistryStructuralSignature(candidate)
    : null;
  let targetDraft: Readonly<InvestmentBaselineSnapshot> | null = null;
  let approvedCandidate: Readonly<InvestmentBaselineSnapshot> | null = null;

  if (candidate) {
    if (registry.length !== candidate.length) {
      blockingReasons.push(
        'Persistence candidate changes registry cardinality; approval handoff must not insert or delete baseline records.'
      );
    }

    let targetTransitions = 0;
    const comparableLength = Math.min(registry.length, candidate.length);

    for (let index = 0; index < comparableLength; index += 1) {
      const before = registry[index];
      const after = candidate[index];

      if (before.id !== after.id) {
        blockingReasons.push(
          `Persistence candidate changes registry ordering or baseline identity at index ${index}.`
        );
        continue;
      }

      if (before.id === input.handoff.targetBaselineId) {
        targetTransitions += 1;
        targetDraft = before;
        approvedCandidate = after;

        if (before.status !== 'draft') {
          blockingReasons.push(
            'Persistence intent requires the retained target baseline to still be draft.'
          );
        }
        if (after.status !== 'approved') {
          blockingReasons.push(
            'Persistence intent requires the target candidate to be explicitly approved.'
          );
        }
      } else if (before !== after) {
        blockingReasons.push(
          `Persistence candidate replaces non-target baseline ${before.id}; only the governed approval target may change.`
        );
      }
    }

    if (targetTransitions !== 1) {
      blockingReasons.push(
        `Persistence intent requires exactly one target transition for ${input.handoff.targetBaselineId}; found ${targetTransitions}.`
      );
    }
  }

  if (approvedCandidate && !isValidDateEvidence(approvedCandidate.approvedAt ?? '')) {
    blockingReasons.push(
      'Persistence intent requires valid explicit approval timestamp evidence on the retained approved baseline candidate.'
    );
  }

  if (
    approvedCandidate?.approvedAt &&
    isValidDateEvidence(approvedCandidate.approvedAt) &&
    isValidDateEvidence(requestedAt) &&
    new Date(requestedAt).getTime() < new Date(approvedCandidate.approvedAt).getTime()
  ) {
    blockingReasons.push(
      'Persistence review request cannot precede the explicit approval timestamp retained on the approved baseline candidate.'
    );
  }

  const ready = blockingReasons.length === 0;
  const appendOnlyEventEvidence =
    ready && candidateRegistryStructuralSignature
      ? Object.freeze<BaselineApprovalPersistenceEventEvidence>({
          eventType: 'baseline_approval_registry_handoff_ready',
          requestId,
          requestedAt,
          observedRegistryVersion,
          targetBaselineId: input.handoff.targetBaselineId,
          observedRegistrySize: registry.length,
          candidateRegistrySize: candidate?.length ?? 0,
          observedRegistryStructuralSignature,
          candidateRegistryStructuralSignature,
        })
      : null;

  return Object.freeze({
    ready,
    handoff: input.handoff,
    observedRegistryVersion,
    requestId,
    requestedAt,
    targetDraft,
    approvedCandidate,
    observedRegistryStructuralSignature,
    candidateRegistryStructuralSignature,
    appendOnlyEventEvidence,
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze(Array.from(new Set(warnings))),
  });
}

/**
 * Verifies a caller-supplied durable-store read-back against the exact registry
 * population reviewed by a ready persistence intent.
 *
 * The caller-owned read-back is copied into immutable structural evidence before
 * its signature is calculated, so downstream consumers cannot observe a later
 * mutation that no longer matches the signature retained by this confirmation.
 *
 * Confirmation readiness also enforces audit chronology against the exact retained
 * persistence request and approved candidate: a valid `confirmedAt` cannot precede
 * either the request's `requestedAt` or the explicit `approvedAt` retained on the
 * exact candidate being persisted. This prevents downstream consumers from treating
 * a structurally reconciled but chronologically impossible confirmation as
 * authoritative before append-only event evidence is built.
 *
 * The returned confirmation envelope and its blocker/warning populations are also
 * immutable, while the retained registry read-back remains the separately frozen
 * structural snapshot built at this boundary. This prevents post-evaluation changes
 * to readiness or diagnostic state without changing storage semantics.
 *
 * This boundary remains storage-semantic-neutral: the caller owns the write,
 * durable version token and post-write read-back. FinMod only verifies that the
 * observed post-write registry structurally equals the reviewed candidate registry.
 * It does not perform a write, authenticate the storage system, infer a successful
 * compare-and-swap operation, or decide whether storage uses in-place state,
 * event sourcing or append-new-version semantics.
 */
export function buildBaselineApprovalPersistenceConfirmationBundle(input: {
  intent: BaselineApprovalPersistenceIntentBundle;
  persistedRegistryVersion: string;
  persistedRegistrySnapshot: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>>;
  confirmedAt: string;
}): BaselineApprovalPersistenceConfirmationBundle {
  const blockingReasons: string[] = [];
  const warnings = [...input.intent.warnings];
  const persistedRegistryVersion = input.persistedRegistryVersion.trim();
  const confirmedAt = input.confirmedAt.trim();
  const persistedRegistrySnapshot = freezeRegistryEvidence(input.persistedRegistrySnapshot);
  const persistedRegistryStructuralSignature = buildRegistryStructuralSignature(
    persistedRegistrySnapshot
  );

  if (!input.intent.ready || !input.intent.candidateRegistryStructuralSignature) {
    blockingReasons.push(
      'Persistence confirmation requires a ready baseline approval persistence intent.'
    );
  }
  if (!persistedRegistryVersion) {
    blockingReasons.push(
      'Persistence confirmation requires an explicit durable-store registry version token.'
    );
  }
  if (!isValidDateEvidence(confirmedAt)) {
    blockingReasons.push(
      'Persistence confirmation requires a valid explicit confirmation timestamp.'
    );
  }
  if (
    isValidDateEvidence(input.intent.requestedAt) &&
    isValidDateEvidence(confirmedAt) &&
    new Date(confirmedAt).getTime() < new Date(input.intent.requestedAt).getTime()
  ) {
    blockingReasons.push(
      'Persistence confirmation cannot precede the retained persistence-request timestamp.'
    );
  }
  if (
    input.intent.approvedCandidate?.approvedAt &&
    isValidDateEvidence(input.intent.approvedCandidate.approvedAt) &&
    isValidDateEvidence(confirmedAt) &&
    new Date(confirmedAt).getTime() <
      new Date(input.intent.approvedCandidate.approvedAt).getTime()
  ) {
    blockingReasons.push(
      'Persistence confirmation cannot precede the explicit approval timestamp retained on the approved baseline candidate.'
    );
  }
  if (
    input.intent.candidateRegistryStructuralSignature &&
    persistedRegistryStructuralSignature !== input.intent.candidateRegistryStructuralSignature
  ) {
    blockingReasons.push(
      'Durable-store read-back does not match the exact reviewed candidate registry population.'
    );
  }
  if (
    persistedRegistryVersion &&
    persistedRegistryVersion === input.intent.observedRegistryVersion
  ) {
    warnings.push(
      'Durable-store registry version token is unchanged after the reported write; this may be valid for the adapter, but FinMod cannot infer write semantics from the token alone.'
    );
  }

  return Object.freeze({
    ready: blockingReasons.length === 0,
    intent: input.intent,
    persistedRegistryVersion,
    persistedRegistrySnapshot,
    persistedRegistryStructuralSignature,
    confirmedAt,
    blockingReasons: Object.freeze([...blockingReasons]),
    warnings: Object.freeze(Array.from(new Set(warnings))),
  });
}
