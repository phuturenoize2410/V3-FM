import type { ActualWorkflowResult } from './actualWorkflowEngine';

export type ActualDataPresentationStatus =
  | 'DEMO_UNVERIFIED'
  | 'MANUAL_UNVERIFIED'
  | 'IMPORT_BLOCKED'
  | 'VERIFIED_RELEASED';

export interface ActualDataPresentationState {
  readonly status: ActualDataPresentationStatus;
  readonly verified: boolean;
  readonly lifecycleEligible: boolean;
  readonly label: string;
  readonly description: string;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly sourceRows: number | null;
  readonly releasedRows: number;
  readonly cutoffDate: string | null;
}

function freezePresentationState(
  state: ActualDataPresentationState
): ActualDataPresentationState {
  return Object.freeze({
    ...state,
    blockingReasons: Object.freeze([...state.blockingReasons]),
  });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildMalformedWorkflowState(reason: string): ActualDataPresentationState {
  return freezePresentationState({
    status: 'IMPORT_BLOCKED',
    verified: false,
    lifecycleEligible: false,
    label: 'Import Evidence Invalid',
    description:
      'Controlled Actual mode received malformed workflow evidence. The presentation boundary fails closed and cannot present the population as verified Actual.',
    blockingReasons: [reason],
    sourceRows: null,
    releasedRows: 0,
    cutoffDate: null,
  });
}

/**
 * Asset-generic presentation control for any UI that labels data as "Actual".
 *
 * This deliberately separates display provenance from financial calculations:
 * - preset/model-generated values are DEMO_UNVERIFIED;
 * - user-entered values without a controlled source workflow are MANUAL_UNVERIFIED;
 * - an import that fails validation/mapping is IMPORT_BLOCKED;
 * - malformed/deserialized workflow evidence fails closed before nested access;
 * - a clean generic lifecycle release that contains any explicit non-Actual data
 *   class remains blocked from being presented as verified Actual;
 * - only a non-empty, clean runActualWorkflow population explicitly classified
 *   as Actual is VERIFIED_RELEASED.
 *
 * The helper does not transform, repair, map, approve or persist Actual data.
 * It exists so Plan vs Actual / PIR surfaces cannot imply audit-grade provenance
 * merely because a number is editable or happens to resemble a realized value.
 * Returned presentation evidence is runtime-immutable so downstream UI code cannot
 * mutate the evaluated provenance status or blocker population after this control runs.
 * The input envelope is read-only: this presentation boundary observes the supplied
 * workflow evidence and does not claim ownership of or mutate caller state.
 */
export function buildActualDataPresentationState(input: Readonly<{
  mode: 'demo' | 'manual' | 'workflow';
  workflow?: ActualWorkflowResult | null;
}>): ActualDataPresentationState {
  if (!isObjectRecord(input)) {
    return buildMalformedWorkflowState('Actual presentation input envelope is malformed.');
  }

  if (input.mode === 'demo') {
    return freezePresentationState({
      status: 'DEMO_UNVERIFIED',
      verified: false,
      lifecycleEligible: false,
      label: 'Demo / Unverified',
      description:
        'Illustrative model-generated realization scenario. Not sourced from a controlled Actual import and not eligible for lifecycle or PIR baseline release.',
      blockingReasons: [
        'No controlled Actual source population has been validated and released.',
      ],
      sourceRows: null,
      releasedRows: 0,
      cutoffDate: null,
    });
  }

  if (input.mode === 'manual') {
    return freezePresentationState({
      status: 'MANUAL_UNVERIFIED',
      verified: false,
      lifecycleEligible: false,
      label: 'Manual / Unverified',
      description:
        'Manually entered realization values without controlled source validation and Mapping Master release. Suitable for working analysis only.',
      blockingReasons: [
        'Manual values have not passed the controlled Actual import and Mapping Master workflow.',
      ],
      sourceRows: null,
      releasedRows: 0,
      cutoffDate: null,
    });
  }

  const workflow = input.workflow;

  if (!workflow) {
    return freezePresentationState({
      status: 'IMPORT_BLOCKED',
      verified: false,
      lifecycleEligible: false,
      label: 'Import Not Released',
      description:
        'Controlled Actual mode is selected, but no completed validation and mapping workflow is available.',
      blockingReasons: ['Actual workflow result is missing.'],
      sourceRows: null,
      releasedRows: 0,
      cutoffDate: null,
    });
  }

  if (!isObjectRecord(workflow)) {
    return buildMalformedWorkflowState('Actual workflow result envelope is malformed.');
  }

  const validation = workflow.validation;
  if (!isObjectRecord(validation) || !isObjectRecord(validation.control)) {
    return buildMalformedWorkflowState('Actual workflow validation control evidence is malformed.');
  }

  const acceptedRows = validation.control.acceptedRows;
  const rejectedRows = validation.control.rejectedRows;
  if (!Number.isFinite(acceptedRows) || !Number.isFinite(rejectedRows)) {
    return buildMalformedWorkflowState('Actual workflow validation row counts are malformed.');
  }

  if (!Array.isArray(workflow.releasedRows)) {
    return buildMalformedWorkflowState('Actual workflow released-row population is malformed.');
  }

  if (!Array.isArray(workflow.blockingReasons)) {
    return buildMalformedWorkflowState('Actual workflow blocker population is malformed.');
  }

  const sourceRows = Number(acceptedRows) + Number(rejectedRows);

  if (!workflow.releasableToLifecycle || workflow.releasedRows.length === 0) {
    const reasons = workflow.blockingReasons.filter(
      (reason): reason is string => typeof reason === 'string'
    );

    if (reasons.length !== workflow.blockingReasons.length) {
      reasons.push('Actual workflow blocker population contains malformed entries.');
    }

    if (workflow.releasableToLifecycle && workflow.releasedRows.length === 0) {
      reasons.push('Released Actual population is empty.');
    }

    return freezePresentationState({
      status: 'IMPORT_BLOCKED',
      verified: false,
      lifecycleEligible: false,
      label: 'Import Blocked',
      description:
        'Source data has not satisfied the complete validation and Mapping Master release gate. Blockers must be resolved before lifecycle or PIR use.',
      blockingReasons: reasons,
      sourceRows,
      releasedRows: workflow.releasedRows.length,
      cutoffDate: typeof workflow.cutoffDate === 'string' ? workflow.cutoffDate : null,
    });
  }

  if (workflow.blockingReasons.some((reason) => typeof reason !== 'string')) {
    return buildMalformedWorkflowState('Actual workflow blocker population contains malformed entries.');
  }

  if (workflow.releasedRows.some((row) => !isObjectRecord(row))) {
    return buildMalformedWorkflowState('Actual workflow released-row population contains malformed entries.');
  }

  const nonActualReleasedRows = workflow.releasedRows.filter(
    (row) => row.dataClass !== 'actual'
  );

  if (nonActualReleasedRows.length > 0) {
    const releasedDataClasses = Array.from(
      new Set(nonActualReleasedRows.map((row) => String(row.dataClass)))
    ).sort();

    return freezePresentationState({
      status: 'IMPORT_BLOCKED',
      verified: false,
      lifecycleEligible: false,
      label: 'Actual Presentation Blocked',
      description:
        'The controlled workflow is lifecycle-releasable, but the released population contains explicit non-Actual data classes and therefore cannot be presented as verified Actual.',
      blockingReasons: [
        `${nonActualReleasedRows.length} released row(s) are explicitly classified as non-Actual (${releasedDataClasses.join(', ')}). Actual presentation requires an Actual-only released population.`,
      ],
      sourceRows,
      releasedRows: workflow.releasedRows.length,
      cutoffDate: typeof workflow.cutoffDate === 'string' ? workflow.cutoffDate : null,
    });
  }

  return freezePresentationState({
    status: 'VERIFIED_RELEASED',
    verified: true,
    lifecycleEligible: true,
    label: 'Verified Actual',
    description:
      'Source population passed import validation and Mapping Master controls and the released population is explicitly Actual-only.',
    blockingReasons: [],
    sourceRows,
    releasedRows: workflow.releasedRows.length,
    cutoffDate: typeof workflow.cutoffDate === 'string' ? workflow.cutoffDate : null,
  });
}
