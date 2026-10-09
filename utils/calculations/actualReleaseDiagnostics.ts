import type { ActualWorkflowResult } from './actualWorkflowEngine';
import type { ActualImportIssueCode } from './actualImportControls';
import type { ActualDataClass } from './investmentLifecycleEngine';
import { isValidDateEvidence } from './dateEvidenceControls';

export type ActualReleaseCheckSeverity = 'error' | 'warning' | 'info';

export interface ActualReleaseCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly severity: ActualReleaseCheckSeverity;
  readonly label: string;
  readonly detail: string;
}

export interface ActualIssueCodeCount {
  readonly code: ActualImportIssueCode;
  readonly count: number;
}

export interface ActualReleasedDataClassCount {
  readonly dataClass: ActualDataClass;
  readonly count: number;
}

export interface ActualReleaseDiagnostics {
  readonly cutoffDate: string;
  readonly sourceRows: number;
  readonly acceptedRows: number;
  readonly rejectedRows: number;
  readonly mappedRows: number;
  readonly unmappedRows: number;
  readonly releasedRows: number;
  readonly actualRows: number;
  readonly nonActualRows: number;
  readonly sourceAmount: number;
  readonly acceptedAmount: number;
  readonly rejectedAmount: number;
  readonly mappedAmount: number;
  readonly unmappedAmount: number;
  readonly releasedAmount: number;
  readonly releasedDataClassCounts: ReadonlyArray<ActualReleasedDataClassCount>;
  readonly issueCounts: ReadonlyArray<ActualIssueCodeCount>;
  readonly checks: ReadonlyArray<ActualReleaseCheck>;
  readonly releaseReady: boolean;
  readonly actualOnlyReleaseReady: boolean;
}

const AMOUNT_TOLERANCE = 1e-9;

/**
 * Presentation-ready audit diagnostics for the controlled Actual workflow.
 *
 * This helper deliberately performs no mapping, data repair, approval, persistence,
 * or financial calculation. It only re-expresses the existing validation/mapping
 * evidence and independently checks the population bridges that a Plan vs Actual
 * or PIR surface should disclose before calling a dataset "verified Actual".
 *
 * `releaseReady` remains the generic controlled lifecycle release state so the
 * workflow can continue carrying explicit commitment / ETC / budget / baseline
 * data classes where a downstream use case deliberately governs them.
 * `actualOnlyReleaseReady` is the stricter semantic gate for consumers that claim
 * the released population itself is Actual-to-Date. No data class is inferred,
 * converted or discarded here.
 *
 * Cutoff evidence is also reconciled explicitly: diagnostics require the retained
 * workflow cutoff to independently satisfy the shared governed date control, be
 * valid/evaluated by the workflow cutoff control, and have that control's
 * rejected-row count match the underlying `after_cutoff` import issues. This makes
 * the time boundary auditable without inventing a second cutoff decision here.
 *
 * Mapping Master structural population control is surfaced as its own error check
 * rather than being visible only through the aggregate workflow release gate. This
 * preserves the workflow as the decision owner while giving retained release evidence
 * a named, calculation-free audit trail for malformed or identity-ambiguous rules.
 *
 * Returned diagnostics are runtime-immutable so downstream migration, baseline,
 * PIR and reporting consumers cannot alter the evaluated release decision or its
 * reconciliation evidence after this control has run. Caller-owned workflow rows
 * are not copied, mutated or deep-frozen by this diagnostic.
 */
export function buildActualReleaseDiagnostics(
  workflow: ActualWorkflowResult
): ActualReleaseDiagnostics {
  const validation = workflow.validation.control;
  const mapping = workflow.mappingGate;

  const sourceRows = validation.inputRows;
  const acceptedRows = validation.acceptedRows;
  const rejectedRows = validation.rejectedRows;
  const mappedRows = mapping.mappedRows;
  const unmappedRows = mapping.unmappedRows;
  const releasedRows = workflow.releasedRows.length;
  const releasedAmount = workflow.releasedRows.reduce((sum, row) => sum + row.amount, 0);
  const releasedDataClassMap = new Map<ActualDataClass, number>();

  workflow.releasedRows.forEach((row) => {
    releasedDataClassMap.set(
      row.dataClass,
      (releasedDataClassMap.get(row.dataClass) ?? 0) + 1
    );
  });

  const releasedDataClassCounts: ReadonlyArray<ActualReleasedDataClassCount> = Object.freeze(
    Array.from(releasedDataClassMap.entries())
      .map(([dataClass, count]) => Object.freeze({ dataClass, count }))
      .sort((a, b) => a.dataClass.localeCompare(b.dataClass))
  );
  const actualRows = releasedDataClassMap.get('actual') ?? 0;
  const nonActualRows = releasedRows - actualRows;

  const sourceToValidationRowsReconciles =
    sourceRows === acceptedRows + rejectedRows;
  const acceptedToMappingRowsReconciles =
    acceptedRows === mappedRows + unmappedRows;
  const releasePopulationReconciles = workflow.releasableToLifecycle
    ? releasedRows === mappedRows && unmappedRows === 0 && rejectedRows === 0
    : releasedRows === 0;

  const acceptedToMappingAmountReconciles =
    Math.abs(validation.acceptedAmount - mapping.mappedAmount - mapping.unmappedAmount) <=
    AMOUNT_TOLERANCE;
  const releaseAmountReconciles = workflow.releasableToLifecycle
    ? Math.abs(releasedAmount - mapping.mappedAmount) <= AMOUNT_TOLERANCE &&
      Math.abs(mapping.unmappedAmount) <= AMOUNT_TOLERANCE &&
      Math.abs(validation.rejectedAmount) <= AMOUNT_TOLERANCE
    : Math.abs(releasedAmount) <= AMOUNT_TOLERANCE;

  const issueCountMap = new Map<ActualImportIssueCode, number>();
  workflow.validation.issues.forEach((issue) => {
    issueCountMap.set(issue.code, (issueCountMap.get(issue.code) ?? 0) + 1);
  });

  const issueCounts: ReadonlyArray<ActualIssueCodeCount> = Object.freeze(
    Array.from(issueCountMap.entries())
      .map(([code, count]) => Object.freeze({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code))
  );
  const afterCutoffIssues = issueCountMap.get('after_cutoff') ?? 0;
  const cutoffDateValid = isValidDateEvidence(workflow.cutoffDate);
  const cutoffControlReconciles =
    workflow.cutoffControl.suppliedCutoffDate === workflow.cutoffDate &&
    workflow.cutoffControl.rejectedAfterCutoffRows === afterCutoffIssues;

  const checks: ActualReleaseCheck[] = [
    {
      id: 'actual-cutoff-control',
      passed:
        cutoffDateValid &&
        workflow.cutoffControl.valid &&
        workflow.cutoffControl.evaluated &&
        cutoffControlReconciles,
      severity: 'error',
      label: 'Controlled Actual cutoff evidence',
      detail: !cutoffDateValid
        ? `Cutoff ${workflow.cutoffDate || '(blank)'} is not valid governed date evidence.`
        : cutoffControlReconciles
          ? `Cutoff ${workflow.cutoffDate} is retained; ${afterCutoffIssues} after-cutoff rejection(s) reconcile to workflow cutoff evidence.`
          : `Cutoff evidence does not reconcile: workflow retains ${workflow.cutoffDate} with ${workflow.cutoffControl.rejectedAfterCutoffRows} cutoff rejection(s), while import validation reports ${afterCutoffIssues}.`,
    },
    {
      id: 'actual-source-validation-row-bridge',
      passed: sourceToValidationRowsReconciles,
      severity: 'error',
      label: 'Source population → validation row bridge',
      detail: `${sourceRows} source row(s) = ${acceptedRows} accepted + ${rejectedRows} rejected.`,
    },
    {
      id: 'actual-source-validation-amount-bridge',
      passed: validation.amountReconciles,
      severity: 'error',
      label: 'Source population → validation amount bridge',
      detail: `Source ${validation.inputAmount} = accepted ${validation.acceptedAmount} + rejected ${validation.rejectedAmount}.`,
    },
    {
      id: 'actual-mapping-master-rule-population',
      passed: workflow.mappingRulePopulationControl.passed,
      severity: 'error',
      label: 'Mapping Master structural rule population',
      detail: workflow.mappingRulePopulationControl.passed
        ? `${workflow.mappingRulePopulationControl.suppliedRuleCount} supplied Mapping Master rule(s) passed structural identity, priority and effective-date controls.`
        : workflow.mappingRulePopulationControl.blockingReasons.join(' ') ||
          'Mapping Master structural rule population is not release-ready.',
    },
    {
      id: 'actual-accepted-mapping-row-bridge',
      passed: acceptedToMappingRowsReconciles,
      severity: 'error',
      label: 'Accepted population → Mapping Master row bridge',
      detail: `${acceptedRows} accepted row(s) = ${mappedRows} mapped + ${unmappedRows} unmapped.`,
    },
    {
      id: 'actual-accepted-mapping-amount-bridge',
      passed: acceptedToMappingAmountReconciles,
      severity: 'error',
      label: 'Accepted population → Mapping Master amount bridge',
      detail: `Accepted ${validation.acceptedAmount} = mapped ${mapping.mappedAmount} + unmapped ${mapping.unmappedAmount}.`,
    },
    {
      id: 'actual-release-population-bridge',
      passed: releasePopulationReconciles,
      severity: 'error',
      label: 'Mapping Master → released controlled population',
      detail: workflow.releasableToLifecycle
        ? `${releasedRows} released row(s) reconcile to the clean mapped population.`
        : `Release is blocked; released population must remain empty and is ${releasedRows}.`,
    },
    {
      id: 'actual-release-amount-bridge',
      passed: releaseAmountReconciles,
      severity: 'error',
      label: 'Mapping Master → released controlled amount bridge',
      detail: workflow.releasableToLifecycle
        ? `Released amount ${releasedAmount} reconciles to mapped amount ${mapping.mappedAmount}; rejected and unmapped amounts must be zero.`
        : `Release is blocked; released amount must remain zero and is ${releasedAmount}.`,
    },
    {
      id: 'actual-released-data-class-composition',
      passed: nonActualRows === 0 && actualRows === releasedRows,
      severity: nonActualRows === 0 ? 'info' : 'warning',
      label: 'Released population data-class composition',
      detail: releasedRows === 0
        ? 'No controlled rows are released.'
        : nonActualRows === 0
          ? `${actualRows} released row(s) are explicitly classified as actual.`
          : `${actualRows} released row(s) are actual and ${nonActualRows} row(s) are explicit non-Actual classes; Actual-to-Date consumers must fail closed rather than relabel them.`,
    },
    {
      id: 'actual-workflow-release-gate',
      passed: workflow.releasableToLifecycle,
      severity: workflow.releasableToLifecycle ? 'info' : 'warning',
      label: 'Controlled lifecycle release gate',
      detail: workflow.releasableToLifecycle
        ? 'Validation and Mapping Master controls permit controlled lifecycle release.'
        : workflow.blockingReasons.join(' ') || 'Controlled population is not releasable.',
    },
  ];

  const releaseReady =
    workflow.releasableToLifecycle &&
    releasedRows > 0 &&
    checks.filter((check) => check.severity === 'error').every((check) => check.passed);
  const actualOnlyReleaseReady =
    releaseReady &&
    actualRows === releasedRows &&
    nonActualRows === 0;
  const frozenChecks: ReadonlyArray<ActualReleaseCheck> = Object.freeze(
    checks.map((check) => Object.freeze({ ...check }))
  );

  return Object.freeze({
    cutoffDate: workflow.cutoffDate,
    sourceRows,
    acceptedRows,
    rejectedRows,
    mappedRows,
    unmappedRows,
    releasedRows,
    actualRows,
    nonActualRows,
    sourceAmount: validation.inputAmount,
    acceptedAmount: validation.acceptedAmount,
    rejectedAmount: validation.rejectedAmount,
    mappedAmount: mapping.mappedAmount,
    unmappedAmount: mapping.unmappedAmount,
    releasedAmount,
    releasedDataClassCounts,
    issueCounts,
    checks: frozenChecks,
    releaseReady,
    actualOnlyReleaseReady,
  });
}
