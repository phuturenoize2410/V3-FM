import type { FullModelAssumptions } from '../types';

export type ProjectAssumptionAuthority =
  | 'DEMO_DEFAULT'
  | 'DRAFT'
  | 'SAVED_VERSION'
  | 'APPROVED_BASELINE'
  | 'SUPERSEDED';

export interface ProjectAssumptionAuthorityHandoff {
  authority: 'DEMO_DEFAULT' | 'DRAFT';
  assumptions: Readonly<FullModelAssumptions>;
  projectId: null;
  persisted: false;
  retainedSnapshot: false;
  approved: false;
  authenticatedActor: null;
  versionId: null;
  approvalReference: null;
  blockers: readonly string[];
}

const DRAFT_BLOCKERS = Object.freeze([
  'Stable project identity is not connected to the current assumption population.',
  'Durable assumption-version persistence is not connected.',
  'Immutable retained assumption snapshot is not connected; the payload remains caller-owned transient state.',
  'Authenticated actor identity is not connected.',
  'Approval must be supplied by the existing baseline registry/versioning boundary.',
] as const);

function assertTransientAuthority(
  authority: ProjectAssumptionAuthority
): asserts authority is 'DEMO_DEFAULT' | 'DRAFT' {
  if (authority !== 'DEMO_DEFAULT' && authority !== 'DRAFT') {
    throw new Error(
      `Transient project-assumption handoff cannot represent ${authority}; persisted/versioned/approved authority must come from its governed registry boundary.`
    );
  }
}

/**
 * Creates the calculation-facing authority envelope for the current in-memory
 * assumption population without upgrading transient React state into
 * institutional evidence.
 *
 * This boundary is deliberately calculation-free and asset-generic. It does
 * not infer stable project identity from projectName or other display fields,
 * and it does not infer source evidence, persistence, approval, baseline
 * identity, PPA/EBL terms, or any other commercial/economic fact.
 *
 * Runtime authority is checked as well as statically typed so malformed or
 * reconstructed callers cannot smuggle SAVED_VERSION / APPROVED_BASELINE /
 * SUPERSEDED status through this transient boundary.
 *
 * The assumptions reference is intentionally not cloned or deep-frozen here:
 * doing so would imply a retained/versioned snapshot that the current runtime
 * does not possess. Consumers must treat it as caller-owned transient state.
 */
export function buildTransientProjectAssumptionHandoff(
  assumptions: FullModelAssumptions,
  authority: ProjectAssumptionAuthority
): ProjectAssumptionAuthorityHandoff {
  assertTransientAuthority(authority);

  return Object.freeze({
    authority,
    assumptions,
    projectId: null,
    persisted: false,
    retainedSnapshot: false,
    approved: false,
    authenticatedActor: null,
    versionId: null,
    approvalReference: null,
    blockers: DRAFT_BLOCKERS,
  });
}
