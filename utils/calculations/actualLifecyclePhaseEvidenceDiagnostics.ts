import type { LifecyclePhase, MappedActualRow } from './investmentLifecycleEngine';

export type LifecyclePhaseEvidenceIssueCode =
  | 'empty_population'
  | 'duplicate_requested_row_id'
  | 'missing_released_row'
  | 'row_not_mapped'
  | 'missing_lifecycle_phase';

export interface LifecyclePhaseEvidenceIssue {
  readonly rowId: string | null;
  readonly code: LifecyclePhaseEvidenceIssueCode;
  readonly message: string;
}

export interface LifecyclePhaseEvidenceSummary {
  readonly requestedRows: number;
  readonly matchedRows: number;
  readonly phasedRows: number;
  readonly unphasedRows: number;
  readonly amount: number;
  readonly amountByPhase: Readonly<Partial<Record<LifecyclePhase, number>>>;
}

export interface LifecyclePhaseEvidenceDiagnostics {
  readonly ready: boolean;
  readonly requestedRowIds: ReadonlyArray<string>;
  readonly matchedRows: ReadonlyArray<Readonly<MappedActualRow>>;
  readonly issues: ReadonlyArray<LifecyclePhaseEvidenceIssue>;
  readonly summary: LifecyclePhaseEvidenceSummary;
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Proves that an explicitly selected lifecycle-monitoring population can be
 * traced back to released mapped Actual rows and that every selected row carries
 * an explicit lifecycle phase.
 *
 * The caller must select the population by source row ID. This diagnostic does
 * not infer which GL/WBS/cost rows belong in development, construction, COD or
 * operations monitoring, and it never derives phase from posting date or model
 * timing. Phase remains source/Mapping-Master evidence.
 *
 * This control is intentionally asset-generic. Electricity-specific operating
 * KPIs and tariff logic belong in their module-specific governance paths.
 */
export function buildActualLifecyclePhaseEvidenceDiagnostics(
  releasedRows: ReadonlyArray<Readonly<MappedActualRow>>,
  requestedRowIds: ReadonlyArray<string>
): LifecyclePhaseEvidenceDiagnostics {
  const issues: LifecyclePhaseEvidenceIssue[] = [];
  const normalizedIds = requestedRowIds.map((rowId) => rowId.trim());
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();

  normalizedIds.forEach((rowId) => {
    if (seen.has(rowId)) duplicateIds.add(rowId);
    seen.add(rowId);
  });

  duplicateIds.forEach((rowId) => {
    issues.push({
      rowId,
      code: 'duplicate_requested_row_id',
      message: `Lifecycle evidence population requests source row ID ${rowId} more than once.`,
    });
  });

  if (normalizedIds.length === 0) {
    issues.push({
      rowId: null,
      code: 'empty_population',
      message: 'Lifecycle phase evidence requires an explicit non-empty source-row population.',
    });
  }

  const releasedById = new Map(releasedRows.map((row) => [row.rowId, row] as const));
  const matchedRows: Readonly<MappedActualRow>[] = [];

  normalizedIds.forEach((rowId) => {
    const row = releasedById.get(rowId);
    if (!row) {
      issues.push({
        rowId,
        code: 'missing_released_row',
        message: `Source row ID ${rowId} is not present in the supplied released Actual population.`,
      });
      return;
    }

    matchedRows.push(row);

    if (row.mappingStatus !== 'mapped') {
      issues.push({
        rowId,
        code: 'row_not_mapped',
        message: `Source row ID ${rowId} is not Mapping-Master mapped and cannot support lifecycle phase evidence.`,
      });
    }

    if (!row.phase) {
      issues.push({
        rowId,
        code: 'missing_lifecycle_phase',
        message: `Source row ID ${rowId} has no explicit lifecycle phase. Phase is not inferred from posting date or model timing.`,
      });
    }
  });

  const amountByPhase: Partial<Record<LifecyclePhase, number>> = {};
  let phasedRows = 0;
  let unphasedRows = 0;
  let amount = 0;

  matchedRows.forEach((row) => {
    const rowAmount = safeAmount(row.amount);
    amount += rowAmount;
    if (!row.phase) {
      unphasedRows += 1;
      return;
    }

    phasedRows += 1;
    amountByPhase[row.phase] = (amountByPhase[row.phase] ?? 0) + rowAmount;
  });

  const frozenMatchedRows = Object.freeze([...matchedRows]);
  const frozenIssues = Object.freeze(
    issues.map((issue) => Object.freeze({ ...issue }))
  );
  const frozenRequestedRowIds = Object.freeze([...normalizedIds]);
  const frozenAmountByPhase = Object.freeze({ ...amountByPhase });

  return Object.freeze({
    ready: frozenIssues.length === 0,
    requestedRowIds: frozenRequestedRowIds,
    matchedRows: frozenMatchedRows,
    issues: frozenIssues,
    summary: Object.freeze({
      requestedRows: normalizedIds.length,
      matchedRows: frozenMatchedRows.length,
      phasedRows,
      unphasedRows,
      amount,
      amountByPhase: frozenAmountByPhase,
    }),
  });
}
