import type { EnergySalesGovernanceBundle } from './energySalesGovernanceBundle';

export type EnergySalesGovernanceStageStatus = 'passed' | 'blocked';

export interface EnergySalesGovernancePresentationStage {
  readonly id: 'calculation-controls' | 'output-identity' | 'commercial-terms';
  readonly label: string;
  readonly status: EnergySalesGovernanceStageStatus;
  readonly blockingIssueCount: number;
  readonly warningCount: number;
}

export interface EnergySalesGovernancePresentation {
  readonly status: EnergySalesGovernanceStageStatus;
  readonly statusLabel: 'Governed' | 'Blocked';
  readonly blockingIssueCount: number;
  readonly warningCount: number;
  readonly stages: readonly EnergySalesGovernancePresentationStage[];
  readonly blockingReasons: readonly string[];
  readonly warningReasons: readonly string[];
}

function countIssues(
  issues: ReadonlyArray<{ severity: 'error' | 'warning'; message: string }>,
  severity: 'error' | 'warning'
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

/**
 * Calculation-free presentation adapter over the authoritative Energy Sales
 * governance bundle.
 *
 * This adapter deliberately cannot strengthen governance. It does not calculate
 * energy, revenue or effective tariff; alter allocation; infer contract tiers,
 * commitments, escalation, PPA/EBL terms or enforceability; or promote
 * electricity concepts into the asset-generic finance core. UI/PIR callers
 * should display this adapter rather than reconstructing readiness from partial
 * Energy Sales controls.
 *
 * Commercial-term diagnostics are surfaced as their own stage because a result
 * can be arithmetically reconciled and output-identical while still lacking the
 * explicit commercial evidence required to call the result governed. Presentation
 * must preserve that distinction rather than hiding it behind aggregate status.
 *
 * Both blocking and warning reason populations are retained. Warnings do not
 * strengthen or weaken readiness, but keeping them in the same immutable
 * presentation envelope prevents institutional UI/reporting consumers from
 * silently dropping non-blocking governance diagnostics.
 *
 * Aggregate presentation readiness is derived fail-closed from both the retained
 * bundle decision and the three retained stage decisions. Aggregate counts are
 * derived from the same issue populations rendered as reasons rather than trusting
 * a second scalar count. This prevents a malformed/deserialized envelope from
 * presenting Governed while any retained stage is blocked, without recalculating
 * or strengthening the authoritative Energy Sales decision.
 *
 * The presentation envelope, stage population, individual stage rows and reason
 * populations are runtime-frozen snapshots. This prevents downstream UI or
 * reporting consumers from mutating a governed presentation into a second apparent
 * state while leaving the authoritative Energy Sales bundle unchanged. The adapter
 * still does not deep-freeze or otherwise claim ownership of the bundle itself.
 */
export function buildEnergySalesGovernancePresentation(
  bundle: EnergySalesGovernanceBundle
): EnergySalesGovernancePresentation {
  const calculationBlocking = countIssues(
    bundle.calculationControls.issues,
    'error'
  );
  const calculationWarnings = countIssues(
    bundle.calculationControls.issues,
    'warning'
  );
  const identityBlocking = countIssues(bundle.outputIdentity.issues, 'error');
  const identityWarnings = countIssues(bundle.outputIdentity.issues, 'warning');
  const commercialBlocking = countIssues(bundle.commercialTerms.issues, 'error');
  const commercialWarnings = countIssues(bundle.commercialTerms.issues, 'warning');

  const stages = Object.freeze([
    Object.freeze({
      id: 'calculation-controls' as const,
      label: 'Calculation & reconciliation controls',
      status: bundle.calculationControls.passed ? ('passed' as const) : ('blocked' as const),
      blockingIssueCount: calculationBlocking,
      warningCount: calculationWarnings,
    }),
    Object.freeze({
      id: 'output-identity' as const,
      label: 'Contract output identity',
      status: bundle.outputIdentity.passed ? ('passed' as const) : ('blocked' as const),
      blockingIssueCount: identityBlocking,
      warningCount: identityWarnings,
    }),
    Object.freeze({
      id: 'commercial-terms' as const,
      label: 'Commercial term completeness',
      status: bundle.commercialTerms.passed ? ('passed' as const) : ('blocked' as const),
      blockingIssueCount: commercialBlocking,
      warningCount: commercialWarnings,
    }),
  ] satisfies EnergySalesGovernancePresentationStage[]);

  const issues = [
    ...bundle.calculationControls.issues,
    ...bundle.outputIdentity.issues,
    ...bundle.commercialTerms.issues,
  ];
  const blockingReasons = Object.freeze(
    issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message)
  );
  const warningReasons = Object.freeze(
    issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message)
  );
  const presentationPassed =
    bundle.passed && stages.every((stage) => stage.status === 'passed');

  return Object.freeze({
    status: presentationPassed ? 'passed' : 'blocked',
    statusLabel: presentationPassed ? 'Governed' : 'Blocked',
    blockingIssueCount: blockingReasons.length,
    warningCount: warningReasons.length,
    stages,
    blockingReasons,
    warningReasons,
  });
}
