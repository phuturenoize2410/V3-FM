import type { ControlledActualWorkflowBundle } from '../calculations/controlledActualWorkflowBundle';
import { buildControlledActualWorkflowIngressGovernanceBundle } from '../calculations/controlledActualWorkflowIngressGovernance';
import { buildPlanVsActualControlledReviewBundle, type PlanVsActualControlledReviewBundle } from '../calculations/planVsActualControlledReviewBundle';
import { buildPlanVsActualControlledMigrationHandoffBundle, type PlanVsActualControlledMigrationHandoffBundle } from '../calculations/planVsActualControlledMigrationHandoffBundle';
import type { PlanVsActualFieldSelector } from '../calculations/planVsActualFieldReconciliationDiagnostics';

export interface MonetaryReviewTarget {
  readonly fieldId: string;
  readonly displayLabel: string;
  readonly modelProjectName: string;
  readonly legacyDisplayAmount: number;
}
export interface ControlledActualFieldReview {
  readonly ready: boolean;
  readonly target: Readonly<MonetaryReviewTarget>;
  readonly workflowBundle: ControlledActualWorkflowBundle | null;
  readonly review: PlanVsActualControlledReviewBundle | null;
  readonly handoff: PlanVsActualControlledMigrationHandoffBundle | null;
  readonly projectBinding: Readonly<{ projectId: string; modelProjectName: string; sourceReference: string }> | null;
  readonly amountBasis: Readonly<{ currency: string; unit: string; scale: number; sourceReference: string }> | null;
  readonly fieldSelector: Readonly<PlanVsActualFieldSelector> | null;
  readonly blockingReasons: readonly string[];
}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exactText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v;

/** Application ingress, not an alternative release authority.
 * Parse source evidence only; never deserialize a ready bundle or generate its expected
 * Mapping Master snapshot. One selected legacy CAPEX field is already IDR billions.
 * Require the same explicitly declared basis on every source row: no conversion.
 * Governed identity/provenance strings must be exact: whitespace is not normalized
 * into apparently authoritative evidence. A caller's project binding is retained
 * evidence, not authenticated project ownership.
 */
export function evaluateControlledActualFieldReview(raw: string, target: MonetaryReviewTarget): ControlledActualFieldReview {
  const base = { target: Object.freeze({ ...target }), workflowBundle: null, review: null, handoff: null, projectBinding: null, amountBasis: null, fieldSelector: null };
  const blocked = (reason: string): ControlledActualFieldReview => Object.freeze({ ...base, ready: false, blockingReasons: Object.freeze([reason]) });
  try {
    const input: unknown = JSON.parse(raw);
    if (!object(input) || input.evidenceUse !== 'source_evidence') return blocked('Explicit source evidence is required; demo/manual packages cannot enter controlled review.');
    if (!exactText(target.fieldId) || !exactText(target.modelProjectName) || !Number.isFinite(target.legacyDisplayAmount)) return blocked('Select a finite monetary field in the current model.');
    const binding = input.projectBinding;
    const basis = input.amountBasis;
    const field = input.field;
    const workflow = input.workflow;
    if (!object(binding) || !exactText(binding.projectId) || !exactText(binding.sourceReference) || binding.modelProjectName !== target.modelProjectName) return blocked('An explicit source-referenced binding to the current model project is required.');
    if (!object(basis) || basis.currency !== 'IDR' || basis.unit !== 'major_currency' || basis.scale !== 1_000_000_000 || !exactText(basis.sourceReference)) return blocked('Source amounts must explicitly be IDR billions (major_currency, scale 1000000000). No conversion is performed.');
    if (!object(field) || field.fieldId !== target.fieldId || 'legacyDisplayAmount' in field || !object(field.selector)) return blocked('Exactly one selector must identify the selected live field; the comparison value comes only from the UI.');
    const selector = field.selector;
    if (selector.projectId !== binding.projectId || selector.currency !== basis.currency || selector.dataClass !== 'actual' || !exactText(selector.finmodLineItem)) return blocked('Selector must explicitly retain the bound project, IDR currency, Actual class and line item.');
    if (!object(workflow) || !Array.isArray(workflow.rows) || workflow.rows.length === 0 || !Array.isArray(workflow.mappingRules) || !object(workflow.metadata) || !object(workflow.mappingMasterSnapshot)) return blocked('Source rows, Mapping Master rules, metadata and an independently supplied expected snapshot are required.');
    if (!Array.isArray(workflow.mappingMasterSnapshot.ruleSignatures) || !workflow.mappingMasterSnapshot.ruleSignatures.every(exactText)) return blocked('Expected Mapping Master signatures must be supplied as exact non-blank strings.');
    if (!workflow.rows.every(row => object(row) && row.projectId === binding.projectId && row.currency === basis.currency && row.amountUnit === basis.unit && row.amountScale === basis.scale && row.dataClass === 'actual')) return blocked('Every source row must explicitly match the project, currency, unit/scale and Actual class. Rows are not inferred, converted or discarded.');

    const ingress = buildControlledActualWorkflowIngressGovernanceBundle(workflow);
    if (!ingress.ingressReady || !ingress.workflowBundle) {
      return blocked(
        ingress.blockingReasons[0] ??
          'Malformed Controlled Actual workflow evidence; no governed review was attached.'
      );
    }

    const bundle = ingress.workflowBundle;
    const typedSelector = selector as unknown as PlanVsActualFieldSelector;
    const review = buildPlanVsActualControlledReviewBundle(bundle, [{
      fieldId: target.fieldId, displayLabel: target.displayLabel,
      legacyDisplayAmount: target.legacyDisplayAmount,
      selector: typedSelector,
    }]);
    const handoff = buildPlanVsActualControlledMigrationHandoffBundle(review);
    return Object.freeze({
      target: base.target, workflowBundle: bundle, review, handoff,
      projectBinding: Object.freeze({ projectId: binding.projectId, modelProjectName: target.modelProjectName, sourceReference: binding.sourceReference }),
      amountBasis: Object.freeze({ currency: basis.currency, unit: basis.unit, scale: basis.scale, sourceReference: basis.sourceReference }),
      fieldSelector: Object.freeze({ ...typedSelector }),
      ready: handoff.handoffReady, blockingReasons: handoff.blockingReasons,
    });
  } catch {
    return blocked('Malformed or incomplete source evidence. Correct the source package; no governed review was attached.');
  }
}