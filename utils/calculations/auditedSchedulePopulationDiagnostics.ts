import type { AnnualOperatingRow, DebtScheduleRow, ModelCheckItem } from '../types';

function countDuplicates(values: readonly number[]): number {
  const counts = values.reduce<Record<number, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.values(counts).reduce(
    (total, count) => total + Math.max(0, count - 1),
    0
  );
}

function isScheduleRowEnvelope(value: unknown): value is { year: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidYearEvidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isStrictlyIncreasing(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] <= values[index - 1]) return false;
  }
  return true;
}

/**
 * Read-only population controls for the audited annual operating and senior-debt
 * schedules.
 *
 * Reconciliation checks are only reliable when downstream schedules refer to the
 * same explicit period population. These controls therefore verify population
 * identity before model-check consumers rely on row-by-row bridges.
 *
 * Runtime population containers, row envelopes and year evidence are validated
 * before traversal, property access, duplicate/order analysis or positional
 * alignment. Malformed retained/deserialized schedule evidence therefore fails
 * closed instead of throwing or appearing ordered merely because JavaScript
 * comparisons do not reject NaN or non-finite values.
 *
 * Boundaries:
 * - no missing population, row or period is created or inferred;
 * - no row is sorted, dropped, repaired or mutated;
 * - no malformed population or row is coerced into schedule evidence;
 * - no financing, tariff, PPA/EBL, tax or other commercial term is introduced;
 * - no year is treated as preferred merely because it is latest;
 * - this layer checks structural identity only and does not replace the existing
 *   arithmetic, debt, tax, return or balance-sheet reconciliations.
 */
export function buildAuditedSchedulePopulationDiagnostics(
  annualRows: AnnualOperatingRow[],
  debtSchedule: DebtScheduleRow[]
): ModelCheckItem[] {
  const annualPopulationIsArray = Array.isArray(annualRows);
  const debtPopulationIsArray = Array.isArray(debtSchedule);
  const annualRuntimeRows = annualPopulationIsArray
    ? (annualRows as readonly unknown[])
    : [];
  const debtRuntimeRows = debtPopulationIsArray
    ? (debtSchedule as readonly unknown[])
    : [];
  const annualPopulationLength = annualRuntimeRows.length;
  const debtPopulationLength = debtRuntimeRows.length;

  const annualMalformedRowCount = annualRuntimeRows.filter(
    (row) => !isScheduleRowEnvelope(row)
  ).length;
  const debtMalformedRowCount = debtRuntimeRows.filter(
    (row) => !isScheduleRowEnvelope(row)
  ).length;

  const annualYearEvidence = annualRuntimeRows.map((row) =>
    isScheduleRowEnvelope(row) ? row.year : undefined
  );
  const debtYearEvidence = debtRuntimeRows.map((row) =>
    isScheduleRowEnvelope(row) ? row.year : undefined
  );

  const annualInvalidYearCount = annualYearEvidence.filter(
    (year) => year !== undefined && !isValidYearEvidence(year)
  ).length;
  const debtInvalidYearCount = debtYearEvidence.filter(
    (year) => year !== undefined && !isValidYearEvidence(year)
  ).length;
  const annualYears = annualYearEvidence.filter(isValidYearEvidence);
  const debtYears = debtYearEvidence.filter(isValidYearEvidence);
  const annualDuplicateCount = countDuplicates(annualYears);
  const debtDuplicateCount = countDuplicates(debtYears);
  const annualOrderValid =
    annualPopulationIsArray &&
    annualMalformedRowCount === 0 &&
    annualInvalidYearCount === 0 &&
    annualYears.length === annualPopulationLength &&
    isStrictlyIncreasing(annualYears);
  const debtOrderValid =
    debtPopulationIsArray &&
    debtMalformedRowCount === 0 &&
    debtInvalidYearCount === 0 &&
    debtYears.length === debtPopulationLength &&
    isStrictlyIncreasing(debtYears);

  const sameLength =
    annualPopulationIsArray &&
    debtPopulationIsArray &&
    annualPopulationLength > 0 &&
    annualPopulationLength === debtPopulationLength;
  const alignedCount = Math.min(annualPopulationLength, debtPopulationLength);
  const misalignedIndexes: number[] = [];

  for (let index = 0; index < alignedCount; index += 1) {
    const annualYear = annualYearEvidence[index];
    const debtYear = debtYearEvidence[index];
    if (
      isValidYearEvidence(annualYear) &&
      isValidYearEvidence(debtYear) &&
      annualYear !== debtYear
    ) {
      misalignedIndexes.push(index);
    }
  }

  const annualIdentityCheck: ModelCheckItem = {
    id: 'chk_audited_annual_population_identity',
    name: 'Audited Annual Schedule Population Identity',
    category: 'cash_flow',
    passed:
      annualPopulationIsArray &&
      annualPopulationLength > 0 &&
      annualMalformedRowCount === 0 &&
      annualInvalidYearCount === 0 &&
      annualDuplicateCount === 0 &&
      annualOrderValid,
    valueDescription:
      !annualPopulationIsArray
        ? 'Malformed audited annual operating population envelope'
        : annualPopulationLength === 0
          ? 'No audited annual operating rows available'
          : `${annualPopulationLength} periods | malformed rows: ${annualMalformedRowCount} | invalid years: ${annualInvalidYearCount} | duplicate years: ${annualDuplicateCount} | ordered: ${annualOrderValid ? 'yes' : 'no'}`,
    tolerance: 0,
    delta:
      !annualPopulationIsArray || annualPopulationLength === 0
        ? Number.POSITIVE_INFINITY
        : annualMalformedRowCount +
          annualInvalidYearCount +
          annualDuplicateCount +
          (annualOrderValid ? 0 : 1),
    details:
      'The audited annual operating population must be an explicit non-empty array, contain valid runtime row envelopes, use explicit finite integer year evidence, be uniquely identified by year and remain strictly ordered before row-by-row reconciliation or presentation relies on it. Missing or malformed populations, rows or periods are not inferred, coerced or repaired by this control.',
  };

  const debtIdentityCheck: ModelCheckItem = {
    id: 'chk_audited_debt_population_identity',
    name: 'Audited Senior Debt Schedule Population Identity',
    category: 'debt',
    passed:
      debtPopulationIsArray &&
      debtPopulationLength > 0 &&
      debtMalformedRowCount === 0 &&
      debtInvalidYearCount === 0 &&
      debtDuplicateCount === 0 &&
      debtOrderValid,
    valueDescription:
      !debtPopulationIsArray
        ? 'Malformed audited senior debt population envelope'
        : debtPopulationLength === 0
          ? 'No audited senior debt rows available'
          : `${debtPopulationLength} periods | malformed rows: ${debtMalformedRowCount} | invalid years: ${debtInvalidYearCount} | duplicate years: ${debtDuplicateCount} | ordered: ${debtOrderValid ? 'yes' : 'no'}`,
    tolerance: 0,
    delta:
      !debtPopulationIsArray || debtPopulationLength === 0
        ? Number.POSITIVE_INFINITY
        : debtMalformedRowCount +
          debtInvalidYearCount +
          debtDuplicateCount +
          (debtOrderValid ? 0 : 1),
    details:
      'The audited senior-debt population must be an explicit non-empty array, contain valid runtime row envelopes, use explicit finite integer year evidence, be uniquely identified by year and remain strictly ordered. This check does not infer debt tenor, repayment periods, missing rows or refinancing economics.',
  };

  const crossScheduleCountCheck: ModelCheckItem = {
    id: 'chk_audited_schedule_population_count_bridge',
    name: 'Audited Operating-to-Debt Population Count Bridge',
    category: 'debt',
    passed: sameLength,
    valueDescription:
      !annualPopulationIsArray || !debtPopulationIsArray
        ? `Malformed population envelope | operating array: ${annualPopulationIsArray ? 'yes' : 'no'} | debt array: ${debtPopulationIsArray ? 'yes' : 'no'}`
        : `Operating periods: ${annualPopulationLength} | Debt periods: ${debtPopulationLength}`,
    tolerance: 0,
    delta:
      !annualPopulationIsArray || !debtPopulationIsArray
        ? Number.POSITIVE_INFINITY
        : Math.abs(annualPopulationLength - debtPopulationLength),
    details:
      'Annual operating and senior-debt schedules must each be explicit arrays and expose the same non-zero number of explicit periods before positional debt-service and balance bridges are treated as fully reconciled. The control does not fabricate missing populations or rows.',
  };

  const crossScheduleYearCheck: ModelCheckItem = {
    id: 'chk_audited_schedule_population_year_bridge',
    name: 'Audited Operating-to-Debt Period Identity Bridge',
    category: 'debt',
    passed:
      sameLength &&
      annualMalformedRowCount === 0 &&
      debtMalformedRowCount === 0 &&
      annualInvalidYearCount === 0 &&
      debtInvalidYearCount === 0 &&
      misalignedIndexes.length === 0,
    valueDescription:
      !annualPopulationIsArray || !debtPopulationIsArray
        ? `Malformed population envelope | operating array: ${annualPopulationIsArray ? 'yes' : 'no'} | debt array: ${debtPopulationIsArray ? 'yes' : 'no'}`
        : annualMalformedRowCount > 0 || debtMalformedRowCount > 0
          ? `Malformed row evidence | operating: ${annualMalformedRowCount} | debt: ${debtMalformedRowCount}`
          : annualInvalidYearCount > 0 || debtInvalidYearCount > 0
            ? `Invalid year evidence | operating: ${annualInvalidYearCount} | debt: ${debtInvalidYearCount}`
            : misalignedIndexes.length === 0
              ? `${alignedCount} aligned period identities`
              : `${misalignedIndexes.length} misaligned period position(s)`,
    tolerance: 0,
    delta:
      !annualPopulationIsArray || !debtPopulationIsArray
        ? Number.POSITIVE_INFINITY
        : annualMalformedRowCount +
          debtMalformedRowCount +
          annualInvalidYearCount +
          debtInvalidYearCount +
          (sameLength
            ? misalignedIndexes.length
            : Math.abs(annualPopulationLength - debtPopulationLength) +
              misalignedIndexes.length),
    details:
      'Each audited operating and senior-debt population must first be an explicit array; each schedule entry must then be a valid runtime row envelope, carry valid finite integer year evidence and refer to the same explicit year at the corresponding schedule position. This is a source-population identity check, not an instruction to reorder, coerce or repair either schedule.',
  };

  return [
    annualIdentityCheck,
    debtIdentityCheck,
    crossScheduleCountCheck,
    crossScheduleYearCheck,
  ];
}
