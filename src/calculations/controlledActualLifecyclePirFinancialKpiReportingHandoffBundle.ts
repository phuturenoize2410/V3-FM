import {
  buildPirGovernancePresentation,
  type PirGovernancePresentation,
} from './pirGovernancePresentation';
import type { ControlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle } from './controlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle';
import type { ControlledActualWorkflowInputEvidence } from './controlledActualWorkflowBundle';
import type {
  ActualCutoffControl,
  MappingRulePopulationControl,
} from './actualWorkflowEngine';
import type { ActualReleaseDiagnostics } from './actualReleaseDiagnostics';
import type { ControlledPirFinancialKpiPeriodGovernanceBundle } from './controlledPirFinancialKpiPeriodGovernanceBundle';
import type { PirLifeToDateGovernanceBundle } from './pirLifeToDateGovernanceBundle';

export interface ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle {
  /**
   * Mirrors the exact authoritative lifecycle + PIR + financial-KPI governance gate.
   * Reporting readiness is evidence readiness only; it is not investment approval.
   */
  readonly reportingReady: boolean;
  readonly governance: ControlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle;
  readonly pirPresentation: PirGovernancePresentation;
  /** Exact retained life-to-date governance object shared by both provenance chains. */
  readonly lifeToDateGovernance: PirLifeToDateGovernanceBundle;
  /** Exact retained per-period OPEX/CFADS/DSCR source-governance population. */
  readonly financialKpiPeriodGovernance: ReadonlyArray<ControlledPirFinancialKpiPeriodGovernanceBundle>;
  /** Immutable snapshot of caller-selected lifecycle row IDs retained by the authoritative chain. */
  readonly requestedRowIds: ReadonlyArray<string>;
  /**
   * Exact immutable Controlled Actual workflow input evidence retained by the
   * lifecycle chain. Reporting consumers can reference the governed source-row
   * population, Mapping Master population/snapshot and cutoff without rebuilding
   * them from loose identifiers or independently fetched data.
   *
   * This remains caller-supplied structural provenance; it is not source-system,
   * preparer, Mapping Master authority or audit authentication.
   */
  readonly actualWorkflowInputEvidence: ControlledActualWorkflowInputEvidence;
  /**
   * Exact cutoff-control evidence from the same Controlled Actual workflow run.
   * This is retained directly so reporting consumers do not have to infer cutoff
   * evaluation or post-cutoff rejection counts from released populations.
   */
  readonly actualCutoffControl: Readonly<ActualCutoffControl>;
  /**
   * Exact Mapping Master structural-population control from the same Controlled
   * Actual workflow run. Reporting consumers can surface rule-count/readiness and
   * blocking evidence without reconstructing structural validity from the aggregate
   * workflow blocking-reason list.
   */
  readonly mappingRulePopulationControl: Readonly<MappingRulePopulationControl>;
  /**
   * Exact release diagnostics already produced by the same Controlled Actual
   * workflow bundle. Keeping this object intact preserves the distinction between
   * generic controlled lifecycle release and the stricter Actual-only semantic gate
   * without asking reporting/UI code to inspect or relabel released rows.
   */
  readonly actualReleaseDiagnostics: Readonly<ActualReleaseDiagnostics>;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Single-source, calculation-free reporting handoff for the governed investment
 * lifecycle -> approved Actual baseline -> explicit PIR selection -> reconciled
 * life-to-date -> OPEX/CFADS/DSCR source-provenance chain.
 *
 * The handoff accepts only the already-composed authoritative governance bundle.
 * It does not accept a second PIR, life-to-date, lifecycle-row, Actual workflow or
 * KPI-period input, which prevents a reporting surface from pairing status from
 * one controlled run with evidence from another merely because identifiers or
 * scalar values match.
 *
 * `pirPresentation` is built from the exact PIR governance object retained by the
 * shared life-to-date governance bundle. Controlled Actual workflow input evidence,
 * cutoff-control evidence, Mapping Master population control and release diagnostics
 * are retained from the exact workflow already proven by the lifecycle chain. The
 * lifecycle row-ID population is snapshotted at this reporting boundary so a
 * mutable nested array cannot drift after the handoff is created. All other evidence
 * references are reused directly from the supplied governance bundle; no population
 * is reconstructed.
 *
 * Boundary: this wrapper does not import/map Actuals, classify lifecycle rows,
 * calculate/repair OPEX, CFADS or DSCR, aggregate portfolio KPIs, approve/persist/
 * supersede/select baselines, authenticate source systems or authorities, or infer
 * Energy Sales, tariff tiers, escalation, PPA, EBL or other commercial terms.
 * Electricity-specific revenue/energy provenance remains module-owned and is not
 * introduced as a requirement of the asset-generic finance core.
 */
export function buildControlledActualLifecyclePirFinancialKpiReportingHandoffBundle(
  governance: ControlledActualLifecyclePirFinancialKpiLifeToDateGovernanceBundle
): ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle {
  const lifeToDateGovernance =
    governance.financialKpiLifeToDateGovernance.lifeToDateGovernance;
  const pirPresentation = buildPirGovernancePresentation(
    lifeToDateGovernance.governance
  );
  const controlledActualWorkflow =
    governance.lifecycleLifeToDateGovernance.lifecyclePirGovernance.lifecyclePirHandoff
      .lifecycleApproval.lifecycleBaseline.lifecycleEvidence.workflow;
  const actualWorkflowInputEvidence = controlledActualWorkflow.inputEvidence;
  const actualCutoffControl = controlledActualWorkflow.workflow.cutoffControl;
  const mappingRulePopulationControl =
    controlledActualWorkflow.workflow.mappingRulePopulationControl;
  const actualReleaseDiagnostics = controlledActualWorkflow.diagnostics;
  const requestedRowIds = Object.freeze([...governance.requestedRowIds]);

  return Object.freeze({
    reportingReady: governance.ready,
    governance,
    pirPresentation,
    lifeToDateGovernance,
    financialKpiPeriodGovernance:
      governance.financialKpiLifeToDateGovernance.periodGovernance,
    requestedRowIds,
    actualWorkflowInputEvidence,
    actualCutoffControl,
    mappingRulePopulationControl,
    actualReleaseDiagnostics,
    blockingReasons: governance.blockingReasons,
  });
}
