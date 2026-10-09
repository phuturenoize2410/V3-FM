import type { ControlledActualWorkflowBundle } from './controlledActualWorkflowBundle';
import type {
  ActualDataClass,
  LifecyclePhase,
  MappingRule,
  MappedActualRow,
} from './investmentLifecycleEngine';

export interface PlanVsActualFieldSelector {
  readonly finmodLineItem: string;
  readonly finmodCategory?: string;
  readonly finmodSubcategory?: string;
  readonly projectId?: string;
  readonly phase?: LifecyclePhase;
  readonly dataClass?: ActualDataClass;
  readonly accountingTreatment?: MappingRule['accountingTreatment'];
  readonly currency?: string;
}

export interface PlanVsActualFieldReconciliationInput {
  readonly fieldId: string;
  readonly displayLabel: string;
  readonly legacyDisplayAmount: number;
  readonly selector: PlanVsActualFieldSelector;
  readonly tolerance?: number;
}

export interface PlanVsActualFieldReconciliationResult {
  readonly fieldId: string;
  readonly displayLabel: string;
  readonly legacyDisplayAmount: number;
  readonly governedActualAmount: number | null;
  readonly difference: number | null;
  readonly matchedRowCount: number;
  readonly matchedRowIds: ReadonlyArray<string>;
  readonly reconciles: boolean;
  readonly migrationEligible: boolean;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface PlanVsActualFieldReconciliationBundle {
  readonly controlledActualReady: boolean;
  readonly allFieldsReconcile: boolean;
  readonly migrationEligible: boolean;
  readonly fields: ReadonlyArray<PlanVsActualFieldReconciliationResult>;
  readonly blockingReasons: ReadonlyArray<string>;
}

const SELECTOR_STRING_FIELDS = [
  'finmodLineItem',
  'finmodCategory',
  'finmodSubcategory',
  'projectId',
  'currency',
] as const;

const LIFECYCLE_PHASES = new Set<LifecyclePhase>([
  'development',
  'financial_close',
  'construction',
  'cod',
  'operations',
  'ppa_expiry',
]);

const ACTUAL_DATA_CLASSES = new Set<ActualDataClass>([
  'actual',
  'commitment',
  'forecast_etc',
  'budget',
  'model_baseline',
]);

const ACCOUNTING_TREATMENTS = new Set<NonNullable<MappingRule['accountingTreatment']>>([
  'capitalized',
  'expensed',
  'working_capital',
  'financing',
  'other',
]);

function isRuntimeObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalize(value?: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesSelector(row: MappedActualRow, selector: PlanVsActualFieldSelector): boolean {
  if (normalize(row.finmodLineItem) !== normalize(selector.finmodLineItem)) return false;
  if (selector.finmodCategory && normalize(row.finmodCategory) !== normalize(selector.finmodCategory)) return false;
  if (selector.finmodSubcategory && normalize(row.finmodSubcategory) !== normalize(selector.finmodSubcategory)) return false;
  if (selector.projectId && normalize(row.projectId) !== normalize(selector.projectId)) return false;
  if (selector.phase && row.phase !== selector.phase) return false;
  if (selector.dataClass && row.dataClass !== selector.dataClass) return false;
  if (
    selector.accountingTreatment &&
    row.accountingTreatment !== selector.accountingTreatment
  ) {
    return false;
  }
  if (selector.currency && normalize(row.currency) !== normalize(selector.currency)) return false;
  return true;
}

function finiteNonNegativeTolerance(value?: unknown): number {
  if (value === undefined) return 0.000001;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0.000001;
  return value;
}

function releasedRowEvidenceIssue(row: MappedActualRow): string | null {
  const runtimeRow = row as unknown;
  if (!isRuntimeObject(runtimeRow)) {
    return 'Matched released Actual evidence contains a malformed row envelope.';
  }
  if (typeof runtimeRow.rowId !== 'string' || !runtimeRow.rowId.trim()) {
    return 'Matched released Actual evidence contains a blank or non-string rowId.';
  }
  if (typeof runtimeRow.amount !== 'number' || !Number.isFinite(runtimeRow.amount)) {
    return `Matched released Actual row ${runtimeRow.rowId} does not contain a finite numeric amount.`;
  }
  if (
    runtimeRow.currency !== undefined &&
    (typeof runtimeRow.currency !== 'string' || !runtimeRow.currency.trim())
  ) {
    return `Matched released Actual row ${runtimeRow.rowId} contains malformed currency evidence.`;
  }
  if (runtimeRow.dataClass !== 'actual') {
    return `Matched released row ${runtimeRow.rowId} is not classified as Actual and cannot support Plan vs Actual migration.`;
  }
  return null;
}

/**
 * Field-level reconciliation gate between the legacy Plan vs Actual display and
 * a governed controlled Actual release.
 *
 * This diagnostic deliberately does not copy, transform or repair values. The
 * caller must state the exact FinMod Mapping Master identity that is expected to
 * support each displayed legacy field. Only released rows from the same
 * Actual-to-Date-ready controlled workflow are eligible evidence.
 *
 * Migration discipline:
 * - no field is eligible unless the controlled workflow is explicitly
 *   Actual-to-Date evidence-ready; generic lifecycle readiness is insufficient
 *   because commitment / ETC / budget / model-baseline classes are valid
 *   controlled populations but must not be presented as governed Actual;
 * - selectors must identify an explicit FinMod line item; no fuzzy matching or
 *   inferred classification is allowed;
 * - runtime field/selector envelopes and textual selector evidence are validated
 *   independently of the TypeScript contract so retained/deserialized UI evidence
 *   fails closed rather than throwing during normalization or matching;
 * - supplied optional selector dimensions must remain non-blank governed evidence;
 *   explicit blanks are not treated as equivalent to omission because that could
 *   silently widen a selector population;
 * - lifecycle phase, data class and accounting treatment selector evidence must
 *   match the existing governed enums before matching is attempted;
 * - the released population must retain valid runtime row envelopes before any
 *   selector matching is attempted, so malformed retained/deserialized evidence
 *   cannot throw or disappear outside the governed reconciliation result;
 * - matched released rows are re-checked at the reconciliation boundary for a
 *   non-blank identity, finite numeric amount, valid optional currency evidence
 *   and explicit Actual semantic class before any governed sum is calculated;
 * - malformed selector or matched-row evidence is never coerced into a valid
 *   Mapping Master identity or arithmetic migration candidate;
 * - zero matching released rows is a blocker rather than an assumed zero Actual;
 * - mixed currencies are a blocker unless the caller explicitly selects one;
 * - a matched population that mixes explicit currency evidence with omitted
 *   currency evidence is also blocked because currency homogeneity is not proven;
 * - field identities must be unique and one governed released row may support at
 *   most one migration field in the same bundle; duplicate field IDs or overlap
 *   in matched row IDs are explicit ambiguity blockers rather than silent reuse;
 * - the legacy display amount must reconcile to the governed released-row sum
 *   within the caller-supplied tolerance;
 * - a successful reconciliation proves arithmetic identity only. It does not
 *   approve a baseline, select a PIR case, validate accounting completeness or
 *   create commercial/economic assumptions.
 */
export function reconcilePlanVsActualFieldsToControlledActual(
  bundle: ControlledActualWorkflowBundle,
  inputs: ReadonlyArray<PlanVsActualFieldReconciliationInput>
): PlanVsActualFieldReconciliationBundle {
  const controlledActualReady = bundle.actualToDateEvidenceReady === true;
  const bundleBlockers = controlledActualReady
    ? []
    : [
        'Controlled Actual bundle is not Actual-to-Date evidence-ready; legacy Plan vs Actual fields cannot be reconciled to governed Actual.',
        ...bundle.blockingReasons,
        ...(bundle.lifecycleEvidenceReady && !bundle.actualToDateEvidenceReady
          ? [
              'Generic lifecycle release readiness is insufficient for Plan vs Actual Actuals; the released population must pass the explicit Actual-only semantic gate.',
            ]
          : []),
      ];

  const initialFields = inputs.map((input, inputIndex): PlanVsActualFieldReconciliationResult => {
    const blockers: string[] = [];
    const runtimeInput = input as unknown;

    if (!isRuntimeObject(runtimeInput)) {
      const uniqueBlockers = Object.freeze([
        `Plan vs Actual reconciliation input ${inputIndex + 1} is not a valid field-reconciliation object.`,
        ...bundleBlockers,
      ]);

      return Object.freeze({
        fieldId: '',
        displayLabel: '',
        legacyDisplayAmount: Number.NaN,
        governedActualAmount: null,
        difference: null,
        matchedRowCount: 0,
        matchedRowIds: Object.freeze([]),
        reconciles: false,
        migrationEligible: false,
        blockingReasons: uniqueBlockers,
      });
    }

    const fieldId = typeof runtimeInput.fieldId === 'string' ? runtimeInput.fieldId : '';
    const displayLabel =
      typeof runtimeInput.displayLabel === 'string' ? runtimeInput.displayLabel : '';
    const legacyDisplayAmount = runtimeInput.legacyDisplayAmount;
    const runtimeSelector = isRuntimeObject(runtimeInput.selector)
      ? runtimeInput.selector
      : null;
    const lineItem = normalize(runtimeSelector?.finmodLineItem);
    const tolerance = finiteNonNegativeTolerance(runtimeInput.tolerance);

    if (!fieldId.trim()) {
      blockers.push('A non-blank string fieldId is required for Plan vs Actual reconciliation.');
    }

    if (runtimeInput.displayLabel !== undefined && typeof runtimeInput.displayLabel !== 'string') {
      blockers.push('Plan vs Actual display label must remain string evidence when supplied.');
    }

    if (!runtimeSelector) {
      blockers.push('An explicit selector object is required for Plan vs Actual reconciliation.');
    } else {
      SELECTOR_STRING_FIELDS.forEach((key) => {
        const value = runtimeSelector[key];
        if (value !== undefined && typeof value !== 'string') {
          blockers.push(
            `Plan vs Actual selector ${key} must remain string evidence when supplied.`
          );
        } else if (typeof value === 'string' && !value.trim()) {
          blockers.push(
            `Plan vs Actual selector ${key} must be non-blank when explicitly supplied.`
          );
        }
      });

      if (
        runtimeSelector.phase !== undefined &&
        (typeof runtimeSelector.phase !== 'string' ||
          !LIFECYCLE_PHASES.has(runtimeSelector.phase as LifecyclePhase))
      ) {
        blockers.push('Plan vs Actual selector phase is not a governed lifecycle phase.');
      }

      if (
        runtimeSelector.dataClass !== undefined &&
        (typeof runtimeSelector.dataClass !== 'string' ||
          !ACTUAL_DATA_CLASSES.has(runtimeSelector.dataClass as ActualDataClass))
      ) {
        blockers.push('Plan vs Actual selector dataClass is not a governed Actual data class.');
      }

      if (
        runtimeSelector.accountingTreatment !== undefined &&
        (typeof runtimeSelector.accountingTreatment !== 'string' ||
          !ACCOUNTING_TREATMENTS.has(
            runtimeSelector.accountingTreatment as NonNullable<MappingRule['accountingTreatment']>
          ))
      ) {
        blockers.push(
          'Plan vs Actual selector accountingTreatment is not a governed accounting treatment.'
        );
      }
    }

    if (!lineItem) {
      blockers.push('An explicit FinMod line-item selector is required for field reconciliation.');
    }

    if (typeof legacyDisplayAmount !== 'number' || !Number.isFinite(legacyDisplayAmount)) {
      blockers.push('Legacy display amount must be a finite number before reconciliation.');
    }

    if (
      runtimeInput.tolerance !== undefined &&
      (typeof runtimeInput.tolerance !== 'number' ||
        !Number.isFinite(runtimeInput.tolerance) ||
        runtimeInput.tolerance < 0)
    ) {
      blockers.push('Reconciliation tolerance must be a finite non-negative number when supplied.');
    }

    if (!controlledActualReady) {
      blockers.push(...bundleBlockers);
    }

    const malformedReleasedRowEnvelopeCount = bundle.workflow.releasedRows.reduce(
      (count, row) => count + (isRuntimeObject(row as unknown) ? 0 : 1),
      0
    );
    if (malformedReleasedRowEnvelopeCount > 0) {
      blockers.push(
        `Controlled released Actual population contains ${malformedReleasedRowEnvelopeCount} malformed row envelope(s); selector matching remains blocked.`
      );
    }

    const selector = runtimeSelector as unknown as PlanVsActualFieldSelector;
    const matchedRows =
      controlledActualReady && runtimeSelector !== null && lineItem && blockers.length === 0
        ? bundle.workflow.releasedRows.filter((row) => matchesSelector(row, selector))
        : [];

    if (
      controlledActualReady &&
      runtimeSelector !== null &&
      lineItem &&
      blockers.length === 0 &&
      matchedRows.length === 0
    ) {
      blockers.push(
        'No governed released Actual row matches the explicit field selector; zero must not be inferred.'
      );
    }

    const matchedRowEvidenceIssues = matchedRows
      .map(releasedRowEvidenceIssue)
      .filter((issue): issue is string => issue !== null);
    blockers.push(...matchedRowEvidenceIssues);

    const normalizedCurrencies = matchedRows.map((row) => normalize(row.currency));
    const currencies = Array.from(new Set(normalizedCurrencies.filter(Boolean)));
    const hasExplicitCurrencyEvidence = normalizedCurrencies.some(Boolean);
    const hasMissingCurrencyEvidence = normalizedCurrencies.some((currency) => !currency);

    if (!selector?.currency && currencies.length > 1) {
      blockers.push(
        'Matched governed Actual rows contain multiple currencies; select an explicit currency or reconcile after a governed FX translation layer.'
      );
    }

    if (
      !selector?.currency &&
      hasExplicitCurrencyEvidence &&
      hasMissingCurrencyEvidence
    ) {
      blockers.push(
        'Matched governed Actual rows mix explicit currency evidence with omitted currency evidence; currency homogeneity is not proven and migration remains blocked.'
      );
    }

    const matchedRowEvidenceReady = matchedRows.length > 0 && matchedRowEvidenceIssues.length === 0;
    const governedActualAmount = matchedRowEvidenceReady
      ? matchedRows.reduce((sum, row) => sum + row.amount, 0)
      : null;
    const difference =
      governedActualAmount !== null &&
      typeof legacyDisplayAmount === 'number' &&
      Number.isFinite(legacyDisplayAmount)
        ? legacyDisplayAmount - governedActualAmount
        : null;
    const reconciles =
      difference !== null && Math.abs(difference) <= tolerance && blockers.length === 0;

    if (difference !== null && Math.abs(difference) > tolerance) {
      blockers.push(
        `Legacy display amount differs from governed released Actual by ${difference}; migration remains blocked.`
      );
    }

    const uniqueBlockers = Object.freeze(Array.from(new Set(blockers)));
    const matchedRowIds = Object.freeze(
      matchedRows
        .map((row) => ((row as unknown as Record<string, unknown>).rowId))
        .filter((rowId): rowId is string => typeof rowId === 'string')
    );

    return Object.freeze({
      fieldId,
      displayLabel,
      legacyDisplayAmount:
        typeof legacyDisplayAmount === 'number' ? legacyDisplayAmount : Number.NaN,
      governedActualAmount,
      difference,
      matchedRowCount: matchedRows.length,
      matchedRowIds,
      reconciles,
      migrationEligible: reconciles && uniqueBlockers.length === 0,
      blockingReasons: uniqueBlockers,
    });
  });

  const fieldIdOwners = new Map<string, number[]>();
  const rowIdOwners = new Map<string, number[]>();

  initialFields.forEach((field, fieldIndex) => {
    const fieldId = field.fieldId.trim();
    if (fieldId) {
      const owners = fieldIdOwners.get(fieldId) ?? [];
      owners.push(fieldIndex);
      fieldIdOwners.set(fieldId, owners);
    }

    field.matchedRowIds.forEach((rowId) => {
      const owners = rowIdOwners.get(rowId) ?? [];
      owners.push(fieldIndex);
      rowIdOwners.set(rowId, owners);
    });
  });

  const duplicateFieldIds = new Set(
    Array.from(fieldIdOwners.entries())
      .filter(([, owners]) => owners.length > 1)
      .map(([fieldId]) => fieldId)
  );
  const overlappingRowIds = new Set(
    Array.from(rowIdOwners.entries())
      .filter(([, owners]) => new Set(owners).size > 1)
      .map(([rowId]) => rowId)
  );

  const fields = initialFields.map((field): PlanVsActualFieldReconciliationResult => {
    const crossFieldBlockers: string[] = [];
    const fieldId = field.fieldId.trim();

    if (fieldId && duplicateFieldIds.has(fieldId)) {
      crossFieldBlockers.push(
        `Plan vs Actual fieldId ${fieldId} is duplicated within the reconciliation bundle; migration identity is ambiguous.`
      );
    }

    const overlappingIds = field.matchedRowIds.filter((rowId) => overlappingRowIds.has(rowId));
    if (overlappingIds.length > 0) {
      crossFieldBlockers.push(
        `Governed released Actual row(s) ${Array.from(new Set(overlappingIds)).join(', ')} match more than one Plan vs Actual migration field; overlapping source-row evidence must be resolved explicitly.`
      );
    }

    if (crossFieldBlockers.length === 0) return field;

    return Object.freeze({
      ...field,
      reconciles: false,
      migrationEligible: false,
      blockingReasons: Object.freeze(
        Array.from(new Set([...field.blockingReasons, ...crossFieldBlockers]))
      ),
    });
  });

  const allFieldsReconcile =
    fields.length > 0 && fields.every((field) => field.reconciles);
  const blockingReasons = Object.freeze(
    Array.from(
      new Set([
        ...bundleBlockers,
        ...fields.flatMap((field) => field.blockingReasons),
        ...(inputs.length === 0
          ? ['At least one explicit legacy field reconciliation input is required.']
          : []),
      ])
    )
  );

  return Object.freeze({
    controlledActualReady,
    allFieldsReconcile,
    migrationEligible:
      controlledActualReady && allFieldsReconcile && blockingReasons.length === 0,
    fields: Object.freeze(fields),
    blockingReasons,
  });
}

