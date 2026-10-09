import type { ControlledActualFieldReview } from './controlledActualFieldReview';
import { buildGovernedActualCostCompletionHandoff } from './governedActualCostCompletionHandoff';
import { buildGovernedOutstandingCommitmentHandoff, type OutstandingCommitmentEvidence } from './outstandingCommitmentEvidence';
import { buildGovernedEtcHandoff, type EtcEvidence } from './etcEvidence';
import { composeGovernedForwardCost, type CostCompletionCoveragePartitionEvidence } from './costCompletionComposition';
import { composeGovernedEacFromActualHandoff } from './governedEacActualHandoffComposition';

export interface EacCoverageEvidence {
  sourceReference: string;
  revision: string;
  populationComplete: true;
  /** Source-owned disjoint scope atoms, including realized and future portions.
   * Partial obligations must be explicitly split by the source; no inference here. */
  scopeAtoms: string[];
  rows: Array<{ component: 'ACTUAL' | 'COMMITMENT' | 'ETC'; rowId: string; scopeAtoms: string[] }>;
}
export interface ExactEacPackage {
  evidenceUse: 'source_evidence';
  commitment: OutstandingCommitmentEvidence;
  etc: EtcEvidence;
  partition: CostCompletionCoveragePartitionEvidence;
  coverage: EacCoverageEvidence;
}
const exact = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v;
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));

/** Live read-only review: exact released Actual + retained forward handoffs +
 * exhaustive source-owned row/coverage reconciliation. No baseline or KPI output. */
export function reviewExactEac(actualReview: ControlledActualFieldReview | null, input: unknown) {
  const actual = buildGovernedActualCostCompletionHandoff(actualReview);
  const blockers = [...actual.blockingReasons];
  const blocked = () => ({ ready: false as const, eac: null, provenance: null, blockingReasons: blockers });
  if (!actual.ready || !actual.basis || !actualReview) return blocked();
  try {
    const p = input as ExactEacPackage;
    if (p?.evidenceUse !== 'source_evidence') blockers.push('Only explicitly supplied source evidence may enter EAC; demo/manual packages are not authoritative.');
    const commitment = buildGovernedOutstandingCommitmentHandoff(p.commitment);
    const etc = buildGovernedEtcHandoff(p.etc);
    const forward = composeGovernedForwardCost(commitment, etc, p.partition);
    const admission = composeGovernedEacFromActualHandoff(actual, forward);
    const eac = admission.eacComposition;
    blockers.push(...admission.blockingReasons);
    const coverage = p.coverage;
    if (!coverage || !exact(coverage.sourceReference) || !exact(coverage.revision) || coverage.populationComplete !== true || !Array.isArray(coverage.scopeAtoms) || !Array.isArray(coverage.rows)) {
      blockers.push('Explicit complete source-owned coverage with revision, scope atoms and row mappings is required.');
      return blocked();
    }
    if (coverage.scopeAtoms.some(x => !exact(x)) || new Set(coverage.scopeAtoms).size !== coverage.scopeAtoms.length) blockers.push('Coverage scope atoms must be exact unique identities.');
    const populations = {
      ACTUAL: actualReview.review!.migrationControl.reconciliation.fields[0].matchedRowIds,
      COMMITMENT: commitment.evidence.rows.map(r => r.rowId),
      ETC: etc.evidence.rows.map(r => r.rowId),
    };
    const seenAtoms = new Set<string>();
    const byComponent = { ACTUAL: [] as string[], COMMITMENT: [] as string[], ETC: [] as string[] };
    for (const component of ['ACTUAL', 'COMMITMENT', 'ETC'] as const) {
      const mapped = coverage.rows.filter(r => r.component === component);
      if (!same(mapped.map(r => r.rowId), populations[component])) blockers.push(`${component} coverage must match every exact retained component row once, with no omitted or extra row.`);
      for (const row of mapped) {
        if (!Array.isArray(row.scopeAtoms) || !row.scopeAtoms.length) { blockers.push(`Coverage row ${row.rowId} requires explicit non-empty scope atoms.`); continue; }
        for (const atom of row.scopeAtoms) {
          if (!exact(atom) || !coverage.scopeAtoms.includes(atom) || seenAtoms.has(atom)) blockers.push(`Overlapping, unknown or malformed coverage atom: ${atom}.`);
          seenAtoms.add(atom); byComponent[component].push(atom);
        }
      }
    }
    if (coverage.rows.some(r => !['ACTUAL', 'COMMITMENT', 'ETC'].includes(r.component))) blockers.push('Unknown coverage component.');
    if (!same([...seenAtoms], coverage.scopeAtoms)) blockers.push('Coverage omits part of the explicitly complete source scope.');
    if (!same(byComponent.COMMITMENT, p.partition.commitmentCoverageKeys) || !same(byComponent.ETC, p.partition.etcCoverageKeys)) blockers.push('Retained forward partition must match exact row-linked coverage atoms.');
    if (blockers.length) return blocked();
    return Object.freeze({ ready: true as const, eac: eac.eac, blockingReasons: Object.freeze([] as string[]), provenance: Object.freeze({
      actualReview, actualHandoff: actual, admission, forward, arithmetic: eac,
      coverage: Object.freeze({ ...coverage, scopeAtoms: Object.freeze([...coverage.scopeAtoms]), rows: Object.freeze(coverage.rows.map(r => Object.freeze({ ...r, scopeAtoms: Object.freeze([...r.scopeAtoms]) }))) }),
    }) });
  } catch {
    blockers.push('Malformed EAC source package; no component evidence was admitted.');
    return blocked();
  }
}
