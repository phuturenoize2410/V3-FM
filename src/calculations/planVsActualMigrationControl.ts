import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';
import {
  reconcilePlanVsActualFieldsToControlledActual,
  type PlanVsActualFieldReconciliationBundle,
  type PlanVsActualFieldReconciliationInput,
  type PlanVsActualFieldSelector,
} from './planVsActualFieldReconciliationDiagnostics';

export type PlanVsActualMigrationState = 'BLOCKED' | 'RECONCILED_READ_ONLY';

export interface PlanVsActualMigrationEvidenceIdentity {
  readonly importBatchId: string;
  readonly sourceReference: string;
  readonly mappingMasterVersion: string;
  readonly cutoffDate: string;
  readonly releasedRows: number;
  readonly actualRows: number;
  readonly nonActualRows: number;
  readonly releasedAmount: number;
}

export interface PlanVsActualMigrationCandidate {
  readonly fieldId: string;
  readonly displayLabel: string;
  readonly governedActualAmount: number;
  readonly matchedRowIds: ReadonlyArray<string>;
  readonly selector: Readonly<PlanVsActualFieldSelector>;
}

export interface PlanVsActualMigrationControlResult {
  readonly state: PlanVsActualMigrationState;
  readonly migrationEligible: boolean;
  readonly evidenceIdentity: Readonly<PlanVsActualMigrationEvidenceIdentity> | null;
  readonly reconciliation: PlanVsActualFieldReconciliationBundle;
  readonly candidates: ReadonlyArray<PlanVsActualMigrationCandidate>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  return Array.from(duplicates).sort();
}

function runtimeFieldId(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return '';
  const fieldId = (value as Record<string, unknown>).fieldId;
  return typeof fieldId === 'string' ? fieldId.trim() : '';
}

function retainSelectorEvidence(
  selector: PlanVsActualFieldSelector
): Readonly<PlanVsActualFieldSelector> {
  return Object.freeze({
    finmodLineItem: selector.finmodLineItem,
    ...(selector.finmodCategory !== undefined
      ? { finmodCategory: selector.finmodCategory }
      : {}),
    ...(selector.finmodSubcategory !== undefined
      ? { finmodSubcategory: selector.finmodSubcategory }
      : {}),
    ...(selector.projectId !== undefined ? { projectId: selector.projectId } : {}),
    ...(selector.phase !== undefined ? { phase: selector.phase } : {}),
    ...(selector.dataClass !== undefined ? { dataClass: selector.dataClass } : {}),
    ...(selector.accountingTreatment !== undefined
      ? { accountingTreatment: selector.accountingTreatment }
      : {}),
    ...(selector.currency !== undefined ? { currency: selector.currency } : {}),
  });
}

/**
 * Single-source migration control for moving legacy Plan vs Actual display fields
 * toward governed controlled Actual amounts.
 *
 * The control intentionally stops one step before mutation. It produces a
 * read-only set of replacement candidates only when every requested legacy field
 * reconciles to released rows from the same Actual-to-Date-ready controlled Actual
 * bundle. Consumers may therefore review one authoritative migration object
 * without independently rebuilding evidence identity, field reconciliation or
 * governed replacement amounts.
 *
 * Each eligible replacement candidate also retains an immutable projection of the
 * exact governed selector dimensions supplied for that field. Downstream handoff
 * and presentation layers can therefore audit which controlled Actual population
 * produced the governed amount without reconstructing selector criteria from a
 * parallel UI/input object. Retention is provenance only: the selector is not
 * broadened, normalized, inferred or reapplied to calculate a second amount.
 *
 * The retained migration evidence carries the authoritative Actual/non-Actual row
 * composition from the same immutable Actual release manifest that supplies the
 * rest of the migration evidence identity. Downstream audit surfaces can therefore
 * show why the population qualified as Actual without reading a parallel diagnostic
 * path, reclassifying rows or recounting released rows.
 *
 * The returned migration-control shell, evidence identity, candidate population,
 * matched-row identity populations and blocking-reason population are runtime-frozen.
 * This prevents a downstream consumer from mutating the reviewed SSOT snapshot after
 * eligibility has been determined. The authoritative reconciliation object is retained
 * by exact reference rather than cloned, preserving continuity with its own governance
 * boundary without inventing persisted-record identity.
 *
 * Governance boundaries:
 * - no legacy value is overwritten here;
 * - no Mapping Master selector, classification or currency translation is inferred;
 * - generic lifecycle release is insufficient for a Plan vs Actual Actual identity;
 *   the released population must pass the explicit Actual-only semantic gate;
 * - retained data-class counts are copied from authoritative manifest evidence and
 *   do not perform a second classification pass;
 * - retained field-selector evidence is copied only after the full migration set is
 *   eligible and does not recalculate or rematch controlled Actual rows;
 * - partial field success does not authorize partial silent migration;
 * - the reconciliation-input population must remain an array at runtime; direct
 *   callers with malformed retained/deserialized evidence fail closed at this
 *   authoritative migration boundary rather than relying on a wrapper to sanitize it;
 * - field identities must be unique within a migration set;
 * - malformed runtime field-reconciliation envelopes cannot participate in
 *   duplicate-identity arithmetic or authorize migration merely because the
 *   compile-time contract claimed a string fieldId;
 * - matched released-row identities must also be unique inside each replacement
 *   candidate, so reconstructed evidence cannot double count one governed Actual
 *   row merely because the same rowId appears twice in one field population;
 * - one governed released Actual row may not support multiple simultaneous
 *   replacement candidates because that would make migration-set arithmetic
 *   ambiguous and could double count the same source evidence;
 * - a successful result proves arithmetic/source identity only and does not
 *   approve an Actual-to-Date baseline, select a PIR case or validate accounting
 *   completeness;
 * - electricity-specific concepts are deliberately absent from this asset-generic
 *   migration control.
 */
export function buildPlanVsActualMigrationControl(
  bundle: ControlledActualWorkflowBundle,
  inputs: PlanVsActualFieldReconciliationInput[]
): PlanVsActualMigrationControlResult {
  const runtimeInputs = Array.isArray(inputs)
    ? (inputs as PlanVsActualFieldReconciliationInput[])
    : [];
  const inputEnvelopeBlockers = Array.isArray(inputs)
    ? []
    : [
        'Plan vs Actual migration input evidence is malformed; expected an array of explicit field reconciliation inputs.',
      ];
  const reconciliation = reconcilePlanVsActualFieldsToControlledActual(bundle, runtimeInputs);
  const controlledEvidence =
    bundle.governedEvidence.mappingMasterEvidence.controlledEvidence;
  const manifest = controlledEvidence.manifest;

  const evidenceIdentity =
    bundle.actualToDateEvidenceReady &&
    bundle.governedEvidence.evidenceReady &&
    manifest.evidenceReady
      ? Object.freeze({
          importBatchId: manifest.metadata.importBatchId,
          sourceReference: manifest.metadata.sourceReference,
          mappingMasterVersion: manifest.metadata.mappingMasterVersion,
          cutoffDate: manifest.cutoffDate,
          releasedRows: manifest.releasePopulation.releasedRows,
          actualRows: manifest.releasePopulation.actualRows,
          nonActualRows: manifest.releasePopulation.nonActualRows,
          releasedAmount: manifest.releasePopulation.releasedAmount,
        })
      : null;

  const duplicateFieldIds = duplicateValues(
    (runtimeInputs as ReadonlyArray<unknown>).map(runtimeFieldId).filter(Boolean)
  );
  const matchedRowOwners = new Map<string, string[]>();

  reconciliation.fields.forEach((field) => {
    field.matchedRowIds.forEach((rowId) => {
      const owners = matchedRowOwners.get(rowId) ?? [];
      owners.push(field.fieldId);
      matchedRowOwners.set(rowId, owners);
    });
  });

  const duplicateRowsWithinCandidates = reconciliation.fields
    .map((field) => ({
      fieldId: field.fieldId,
      rowIds: duplicateValues([...field.matchedRowIds]),
    }))
    .filter((item) => item.rowIds.length > 0);

  const overlappingReleasedRows = Array.from(matchedRowOwners.entries())
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([rowId, owners]) => ({ rowId, fieldIds: Array.from(new Set(owners)).sort() }));

  const migrationSetBlockers = [
    ...inputEnvelopeBlockers,
    ...(duplicateFieldIds.length > 0
      ? [
          `Migration field identities must be unique; duplicate fieldId(s): ${duplicateFieldIds.join(', ')}.`,
        ]
      : []),
    ...(duplicateRowsWithinCandidates.length > 0
      ? [
          `Governed released Actual row identities must be unique within each replacement candidate; duplicate rowId evidence: ${duplicateRowsWithinCandidates
            .map((item) => `${item.fieldId || '[blank fieldId]'} [${item.rowIds.join(', ')}]`)
            .join('; ')}.`,
        ]
      : []),
    ...(overlappingReleasedRows.length > 0
      ? [
          `Governed released Actual rows may not be reused across simultaneous replacement candidates; overlapping rowId(s): ${overlappingReleasedRows
            .map((item) => `${item.rowId} [${item.fieldIds.join(', ')}]`)
            .join('; ')}.`,
        ]
      : []),
  ];

  const blockingReasons = Object.freeze(
    Array.from(
      new Set([
        ...bundle.blockingReasons,
        ...bundle.governedEvidence.blockingReasons,
        ...reconciliation.blockingReasons,
        ...migrationSetBlockers,
        ...(bundle.lifecycleEvidenceReady && !bundle.actualToDateEvidenceReady
          ? [
              'Plan vs Actual migration requires Actual-to-Date evidence readiness; generic lifecycle release cannot supply governed Actual identity.',
            ]
          : []),
        ...(evidenceIdentity
          ? []
          : ['Governed Actual evidence identity is not ready for Plan vs Actual migration review.']),
      ])
    )
  );

  const migrationEligible =
    bundle.actualToDateEvidenceReady &&
    bundle.governedEvidence.evidenceReady &&
    reconciliation.migrationEligible &&
    evidenceIdentity !== null &&
    blockingReasons.length === 0;

  const candidates: ReadonlyArray<PlanVsActualMigrationCandidate> = migrationEligible
    ? Object.freeze(
        reconciliation.fields.map((field, fieldIndex) =>
          Object.freeze({
            fieldId: field.fieldId,
            displayLabel: field.displayLabel,
            governedActualAmount: field.governedActualAmount as number,
            matchedRowIds: Object.freeze([...field.matchedRowIds]),
            selector: retainSelectorEvidence(runtimeInputs[fieldIndex].selector),
          })
        )
      )
    : Object.freeze([]);

  return Object.freeze({
    state: migrationEligible ? 'RECONCILED_READ_ONLY' : 'BLOCKED',
    migrationEligible,
    evidenceIdentity,
    reconciliation,
    candidates,
    blockingReasons,
  });
}
