import { AnnualOperatingRow, FullModelAssumptions, SourcesAndUses } from '../types';
import { evaluateLegacyOpexThroughLineItems } from './opexLineItemEngine';

export interface OpexScheduleReconciliationRow {
  year: number;
  dateStr: string;
  legacyTotalOpexIdrBillion: number;
  lineItemTotalOpexIdrBillion: number;
  differenceIdrBillion: number;
  passed: boolean;
  blockers: string[];
}

export interface OpexScheduleReconciliationResult {
  passed: boolean;
  toleranceIdrBillion: number;
  maxAbsoluteDifferenceIdrBillion: number;
  failedYears: number[];
  rows: OpexScheduleReconciliationRow[];
  blockers: string[];
}

/**
 * Reconciles the candidate editable OPEX line-item engine to the existing
 * annual operating population without changing live economics.
 *
 * The current annual operating rows remain the reference population until this
 * diagnostic passes for every year. Any mismatch is a migration blocker, not a
 * reason to overwrite the reference calculation or introduce a plug.
 */
export function reconcileOpexLineItemsToOperatingSchedule(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  operatingRows: AnnualOperatingRow[],
  toleranceIdrBillion = 1e-8
): OpexScheduleReconciliationResult {
  const blockers: string[] = [];

  const capitalizedPpeAtCod =
    sourcesAndUses.totalUses -
    sourcesAndUses.initialWorkingCapital -
    sourcesAndUses.dsraPreFunding;

  if (!Number.isFinite(capitalizedPpeAtCod) || capitalizedPpeAtCod < 0) {
    blockers.push('Capitalized PPE at COD is invalid; OPEX schedule reconciliation cannot be released.');
  }

  const rows = operatingRows.map((row, index): OpexScheduleReconciliationRow => {
    const evaluated = evaluateLegacyOpexThroughLineItems(assumptions, {
      yearIndex: index,
      outputKWh: row.netGenerationKWh,
      capacityMW: row.capacityMW,
      capexIdrBillion: capitalizedPpeAtCod,
      revenueIdrBillion: row.revenueIdrBillion,
      date: row.dateStr,
    });

    const difference = evaluated.totalOpexIdrBillion - row.totalOpexIdrBillion;
    const rowBlockers = [...evaluated.blockers];

    if (!Number.isFinite(row.totalOpexIdrBillion)) {
      rowBlockers.push(`Operating row ${row.year} has a non-finite legacy OPEX total.`);
    }

    return {
      year: row.year,
      dateStr: row.dateStr,
      legacyTotalOpexIdrBillion: row.totalOpexIdrBillion,
      lineItemTotalOpexIdrBillion: evaluated.totalOpexIdrBillion,
      differenceIdrBillion: difference,
      passed:
        rowBlockers.length === 0 &&
        Number.isFinite(difference) &&
        Math.abs(difference) <= toleranceIdrBillion,
      blockers: rowBlockers,
    };
  });

  if (operatingRows.length === 0) {
    blockers.push('Operating schedule is empty; OPEX migration cannot be demonstrated.');
  }

  const failedYears = rows.filter((row) => !row.passed).map((row) => row.year);
  const maxAbsoluteDifferenceIdrBillion = rows.reduce(
    (max, row) => Math.max(max, Number.isFinite(row.differenceIdrBillion) ? Math.abs(row.differenceIdrBillion) : Infinity),
    0
  );

  for (const row of rows) {
    for (const blocker of row.blockers) {
      if (!blockers.includes(blocker)) blockers.push(blocker);
    }
  }

  if (failedYears.length > 0) {
    blockers.push(
      `Editable OPEX migration does not reconcile to the current operating schedule in year(s): ${failedYears.join(', ')}.`
    );
  }

  return {
    passed: blockers.length === 0 && failedYears.length === 0,
    toleranceIdrBillion,
    maxAbsoluteDifferenceIdrBillion,
    failedYears,
    rows,
    blockers,
  };
}
