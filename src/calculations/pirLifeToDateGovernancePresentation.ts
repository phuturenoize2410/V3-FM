import {
  buildPirGovernancePresentation,
  type PirGovernancePresentation,
  type PirGovernancePresentationStatus,
} from './pirGovernancePresentation';
import type { PirLifeToDateGovernanceBundle } from './pirLifeToDateGovernanceBundle';

export interface PirLifeToDateReconciliationPresentation {
  status: PirGovernancePresentationStatus;
  label: string;
  detail: string;
  periodCount: number;
  uniqueYearCount: number;
  blockingIssueCount: number;
  warningCount: number;
}

export interface PirLifeToDateGovernancePresentation {
  status: PirGovernancePresentationStatus;
  headline: string;
  summary: string;
  governance: PirGovernancePresentation;
  reconciliation: PirLifeToDateReconciliationPresentation;
  blockingReasons: string[];
}

/**
 * Calculation-free presentation adapter for population-bound PIR life-to-date
 * governance.
 *
 * The authoritative readiness state comes only from
 * `PirLifeToDateGovernanceBundle`. This adapter deliberately reuses the existing
 * PIR governance presentation for the baseline/lifecycle stages and reads the
 * reconciliation diagnostics already bound to the exact operating-period
 * population. It does not re-perform reconciliation or reconstruct readiness
 * from partial lower-level signals.
 *
 * Governance boundaries:
 * - does not select, approve, supersede or auto-promote a baseline;
 * - does not infer a reporting cutoff or missing operating periods;
 * - does not mutate Actuals, PIR periods, life-to-date summaries or diagnostics;
 * - does not infer tariff, PPA, EBL or other commercial economics;
 * - does not turn arithmetic reconciliation into commercial or investment
 *   approval;
 * - keeps module-specific calculation semantics outside the core lifecycle
 *   governance presentation.
 */
export function buildPirLifeToDateGovernancePresentation(
  bundle: PirLifeToDateGovernanceBundle
): PirLifeToDateGovernancePresentation {
  const governance = buildPirGovernancePresentation(bundle.governance);
  const diagnostics = bundle.reconciliation.diagnostics;

  const reconciliation: PirLifeToDateReconciliationPresentation = {
    status: bundle.reconciliationReady ? 'ready' : 'blocked',
    label: 'Life-to-date reconciliation',
    detail: bundle.reconciliationReady
      ? 'The supplied life-to-date summary reconciles to the exact governed operating-period population.'
      : 'Life-to-date summary or operating-period population reconciliation remains blocked.',
    periodCount: diagnostics.periodCount,
    uniqueYearCount: diagnostics.uniqueYearCount,
    blockingIssueCount: diagnostics.blockingIssueCount,
    warningCount: diagnostics.warningCount,
  };

  return {
    status: bundle.ready ? 'ready' : 'blocked',
    headline: bundle.ready
      ? 'Reconciled PIR governance ready'
      : 'Reconciled PIR governance blocked',
    summary: bundle.ready
      ? 'Governance and population-bound life-to-date reconciliation are both ready for downstream PIR presentation; PIR economics and investment approval remain separate responsibilities.'
      : 'Governance readiness and life-to-date reconciliation must both pass before downstream PIR presentation may imply a reconciled comparison.',
    governance,
    reconciliation,
    blockingReasons: [...bundle.blockingReasons],
  };
}
