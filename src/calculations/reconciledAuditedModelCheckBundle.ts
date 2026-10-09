import type {
  FullModelAssumptions,
  ModelCheckItem,
  ModelMetrics,
  MonthlyCapexSchedule,
  SourcesAndUses,
} from '../types';
import type { AuditedOperatingResult } from './auditedOperatingEngine';
import { buildAuditedModelCheckBundle } from './auditedModelCheckBundle';

function buildCompositionIdIntegrityCheck(checks: ModelCheckItem[]): ModelCheckItem {
  const counts = checks.reduce<Record<string, number>>((acc, check) => {
    acc[check.id] = (acc[check.id] ?? 0) + 1;
    return acc;
  }, {});
  const duplicateIds = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();

  return {
    id: 'chk_reconciled_audit_bundle_unique_ids',
    name: 'Reconciled Audited Bundle ID Integrity',
    category: 'cash_flow',
    passed: duplicateIds.length === 0,
    valueDescription: duplicateIds.length === 0
      ? `${checks.length} reconciled audited checks | all IDs unique`
      : `Duplicate IDs: ${duplicateIds.join(', ')}`,
    tolerance: 0,
    delta: duplicateIds.length,
    details: duplicateIds.length === 0
      ? 'The authoritative audited finance and schedule-source-identity control set has unique stable IDs for downstream model-check presentation.'
      : 'Duplicate IDs in the authoritative audited control set can collapse separate finance or schedule-lineage checks in downstream consumers. Resolve the duplicate IDs before relying on this bundle.',
  };
}

/**
 * Preferred compatibility wrapper for consumers of the reconciled audited
 * finance/model-check pipeline.
 *
 * Schedule compatibility-alias diagnostics are now composed centrally inside
 * `buildAuditedModelCheckBundle`. This wrapper therefore consumes that single
 * authoritative check population rather than appending the alias diagnostics a
 * second time. Keeping one composition point prevents duplicate stable IDs from
 * creating a false fail-closed result after the audited bundle was strengthened.
 *
 * The additional composition-integrity control remains useful for downstream
 * consumers because it explicitly verifies that the complete authoritative
 * population can be keyed safely by stable check ID.
 *
 * Boundary: this wrapper is read-only. It does not alter assumptions, schedule
 * rows, finance calculations, commercial terms, baseline/PIR governance or
 * electricity-module economics. It does not select an authoritative alias or
 * repair a mismatch; failed source-identity checks from the audited bundle remain
 * explicit blockers.
 */
export function buildReconciledAuditedModelCheckBundle(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  monthlyCapexSchedule: MonthlyCapexSchedule[],
  operatingResult: AuditedOperatingResult,
  metrics: ModelMetrics
): ModelCheckItem[] {
  const authoritativeChecks = buildAuditedModelCheckBundle(
    assumptions,
    sourcesAndUses,
    monthlyCapexSchedule,
    operatingResult,
    metrics
  );
  const compositionIntegrityCheck = buildCompositionIdIntegrityCheck(
    authoritativeChecks
  );

  return [
    ...authoritativeChecks,
    compositionIntegrityCheck,
  ];
}
