import type { ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle } from './controlledActualLifecyclePirFinancialKpiReportingHandoffBundle';
import type { PirGovernancePresentation } from './pirGovernancePresentation';
import type {
  PirFinancialKpiMetric,
  PirFinancialKpiSourceSide,
} from './pirFinancialKpiSourceIdentityDiagnostics';

export type ControlledPirFinancialKpiReportingStatus = 'ready' | 'blocked';

export interface ControlledPirFinancialKpiSourceReportingEvidence {
  readonly metric: PirFinancialKpiMetric;
  readonly side: PirFinancialKpiSourceSide;
  readonly status: ControlledPirFinancialKpiReportingStatus;
  readonly sourceId: string;
  readonly populationId: string;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledActualWorkflowReportingEvidence {
  readonly sourceRowCount: number;
  readonly mappingRuleCount: number;
  readonly mappingRulePopulationReady: boolean;
  readonly mappingRulePopulationBlockingReasons: ReadonlyArray<string>;
  readonly cutoffDate: string;
  readonly cutoffValid: boolean;
  readonly cutoffEvaluated: boolean;
  readonly rejectedAfterCutoffRows: number;
  readonly mappingMasterVersion: string;
  readonly mappingMasterRuleSignatureCount: number;
  /** Generic controlled lifecycle release readiness retained from authoritative diagnostics. */
  readonly controlledReleaseReady: boolean;
  /** Stricter semantic gate required before a population may be presented as Actual-to-Date. */
  readonly actualOnlyReleaseReady: boolean;
  readonly releasedRowCount: number;
  readonly actualRowCount: number;
  readonly nonActualRowCount: number;
}

export interface ControlledPirFinancialKpiPeriodReportingPresentation {
  readonly year: number;
  readonly status: ControlledPirFinancialKpiReportingStatus;
  readonly expectedEvidenceKeys: ReadonlyArray<string>;
  readonly suppliedEvidenceKeys: ReadonlyArray<string>;
  readonly missingEvidenceKeys: ReadonlyArray<string>;
  readonly duplicateEvidenceKeys: ReadonlyArray<string>;
  readonly unexpectedEvidenceKeys: ReadonlyArray<string>;
  readonly sourceEvidence: ReadonlyArray<ControlledPirFinancialKpiSourceReportingEvidence>;
  readonly blockingReasons: ReadonlyArray<string>;
}

export interface ControlledActualLifecyclePirFinancialKpiReportingPresentation {
  readonly reportingReady: boolean;
  readonly status: ControlledPirFinancialKpiReportingStatus;
  readonly pir: PirGovernancePresentation;
  readonly lifecycleSelectedRowCount: number;
  readonly actualWorkflowEvidence: ControlledActualWorkflowReportingEvidence;
  readonly governedPeriodCount: number;
  readonly periods: ReadonlyArray<ControlledPirFinancialKpiPeriodReportingPresentation>;
  readonly blockingReasons: ReadonlyArray<string>;
}

/**
 * Calculation-free presentation adapter over the authoritative lifecycle + PIR +
 * OPEX/CFADS/DSCR reporting handoff.
 *
 * Controlled Actual release status and Mapping Master population-control evidence are
 * copied only from the exact authoritative controls retained by the handoff. The
 * adapter does not re-run Mapping Master structural validation, inspect released rows
 * to infer whether a population is Actual-only, or convert commitment/ETC/budget/
 * baseline classes into Actual semantics.
 */
export function buildControlledActualLifecyclePirFinancialKpiReportingPresentation(
  handoff: ControlledActualLifecyclePirFinancialKpiReportingHandoffBundle
): ControlledActualLifecyclePirFinancialKpiReportingPresentation {
  const periods = Object.freeze(
    handoff.financialKpiPeriodGovernance.map((period) =>
      Object.freeze({
        year: period.operatingPeriodControl.input.year,
        status: period.ready ? ('ready' as const) : ('blocked' as const),
        expectedEvidenceKeys: Object.freeze([...period.coverage.expectedEvidenceKeys]),
        suppliedEvidenceKeys: Object.freeze([...period.coverage.suppliedEvidenceKeys]),
        missingEvidenceKeys: Object.freeze([...period.coverage.missingEvidenceKeys]),
        duplicateEvidenceKeys: Object.freeze([...period.coverage.duplicateEvidenceKeys]),
        unexpectedEvidenceKeys: Object.freeze([...period.coverage.unexpectedEvidenceKeys]),
        sourceEvidence: Object.freeze(
          period.sourceGovernance.map((governance) =>
            Object.freeze({
              metric: governance.sourceIdentity.metric,
              side: governance.sourceIdentity.side,
              status: governance.ready ? ('ready' as const) : ('blocked' as const),
              sourceId: governance.sourceIdentity.sourceId,
              populationId: governance.sourceIdentity.populationId,
              blockingReasons: Object.freeze([...governance.blockingReasons]),
            })
          )
        ),
        blockingReasons: Object.freeze([...period.blockingReasons]),
      })
    )
  );

  const releaseDiagnostics = handoff.actualReleaseDiagnostics;
  const mappingRulePopulationControl = handoff.mappingRulePopulationControl;
  const actualWorkflowEvidence = Object.freeze({
    sourceRowCount: handoff.actualWorkflowInputEvidence.sourceRows.length,
    mappingRuleCount: mappingRulePopulationControl.suppliedRuleCount,
    mappingRulePopulationReady: mappingRulePopulationControl.passed,
    mappingRulePopulationBlockingReasons: Object.freeze([
      ...mappingRulePopulationControl.blockingReasons,
    ]),
    cutoffDate: handoff.actualWorkflowInputEvidence.cutoffDate,
    cutoffValid: handoff.actualCutoffControl.valid,
    cutoffEvaluated: handoff.actualCutoffControl.evaluated,
    rejectedAfterCutoffRows: handoff.actualCutoffControl.rejectedAfterCutoffRows,
    mappingMasterVersion:
      handoff.actualWorkflowInputEvidence.mappingMasterSnapshot.version,
    mappingMasterRuleSignatureCount:
      handoff.actualWorkflowInputEvidence.mappingMasterSnapshot.ruleSignatures.length,
    controlledReleaseReady: releaseDiagnostics.releaseReady,
    actualOnlyReleaseReady: releaseDiagnostics.actualOnlyReleaseReady,
    releasedRowCount: releaseDiagnostics.releasedRows,
    actualRowCount: releaseDiagnostics.actualRows,
    nonActualRowCount: releaseDiagnostics.nonActualRows,
  });

  return Object.freeze({
    reportingReady: handoff.reportingReady,
    status: handoff.reportingReady ? ('ready' as const) : ('blocked' as const),
    pir: handoff.pirPresentation,
    lifecycleSelectedRowCount: handoff.requestedRowIds.length,
    actualWorkflowEvidence,
    governedPeriodCount: handoff.financialKpiPeriodGovernance.length,
    periods,
    blockingReasons: Object.freeze([...handoff.blockingReasons]),
  });
}
