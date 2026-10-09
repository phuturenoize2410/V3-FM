import type { PirOperatingPeriodControlledRow } from './pirOperatingPeriodControlBundle';
import {
  assessPirFinancialKpiSourceIdentity,
  type PirFinancialKpiSourceEvidence,
  type PirFinancialKpiSourceIdentityDiagnostics,
} from './pirFinancialKpiSourceIdentityDiagnostics';

export interface ControlledPirFinancialKpiSourceGovernance {
  readonly ready: boolean;
  readonly operatingPeriodControl: PirOperatingPeriodControlledRow;
  readonly sourceEvidence: PirFinancialKpiSourceEvidence;
  readonly sourceIdentity: PirFinancialKpiSourceIdentityDiagnostics;
  readonly blockingReasons: ReadonlyArray<string>;
}

function isRuntimeEvidenceObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Asset-generic source-governance boundary for one PIR financial KPI evidence item.
 *
 * The caller supplies explicit OPEX, CFADS or DSCR source evidence and one exact
 * already-controlled PIR operating-period row. Source identity is assessed against
 * the exact retained period input rather than against a reconstructed year/value
 * summary. Structurally valid source evidence is snapshotted into an immutable shallow
 * value object before assessment so later mutation of a caller-owned object cannot
 * make retained audit evidence diverge from the diagnostics that were derived from
 * it. Malformed/deserialized top-level evidence is deliberately not spread into a new
 * object: its original runtime shape is retained and passed to the identity diagnostic
 * so envelope validation can fail closed instead of accidentally normalizing primitive,
 * null or array evidence into an apparently ordinary object. The controlled row itself
 * remains the exact in-memory object used by downstream continuity checks.
 *
 * Retained/deserialized operating-period-control evidence is also treated as a runtime
 * boundary rather than trusted solely because of its TypeScript declaration. A
 * null/array/primitive control, a malformed period-input envelope, or a malformed issue
 * population/item must fail closed without being dereferenced, repaired or replaced
 * with a synthetic controlled row. The exact caller-supplied control value is retained
 * for audit continuity even when it is structurally invalid.
 *
 * This boundary deliberately does not decide where OPEX/CFADS/DSCR should come from,
 * authenticate the external source system, infer lifecycle-cost or accounting
 * classification, calculate or repair a KPI, select/approve a baseline, or persist
 * evidence. It also introduces no electricity, tariff, PPA or EBL assumptions.
 */
export function buildControlledPirFinancialKpiSourceGovernance(input: {
  operatingPeriodControl: PirOperatingPeriodControlledRow;
  sourceEvidence: PirFinancialKpiSourceEvidence;
}): ControlledPirFinancialKpiSourceGovernance {
  const rawSourceEvidence = input?.sourceEvidence as unknown;
  const sourceEvidence = (
    isRuntimeEvidenceObject(rawSourceEvidence)
      ? Object.freeze({ ...rawSourceEvidence })
      : rawSourceEvidence
  ) as PirFinancialKpiSourceEvidence;

  const rawOperatingPeriodControl = input?.operatingPeriodControl as unknown;
  const operatingPeriodEnvelope = isRuntimeEvidenceObject(rawOperatingPeriodControl)
    ? rawOperatingPeriodControl
    : null;
  const rawPeriodInput = operatingPeriodEnvelope?.input;
  const periodInputEnvelope = isRuntimeEvidenceObject(rawPeriodInput) ? rawPeriodInput : null;
  const rawControlIssues = operatingPeriodEnvelope?.issues;
  const controlIssues = Array.isArray(rawControlIssues) ? rawControlIssues : [];

  const sourceIdentity = assessPirFinancialKpiSourceIdentity({
    evidence: sourceEvidence,
    pirPeriodInput: rawPeriodInput as PirOperatingPeriodControlledRow['input'],
  });

  const blockingReasons: string[] = [];
  let controlIssuePopulationStructurallyValid = Array.isArray(rawControlIssues);

  if (!operatingPeriodEnvelope) {
    blockingReasons.push(
      'PIR financial KPI governance requires an explicit controlled operating-period object; malformed retained control evidence is not normalized or repaired.'
    );
  }

  if (!periodInputEnvelope) {
    blockingReasons.push(
      'PIR financial KPI governance requires the exact retained operating-period input object; malformed period evidence cannot establish source continuity.'
    );
  }

  if (!Array.isArray(rawControlIssues)) {
    blockingReasons.push(
      'PIR financial KPI governance requires an inspectable controlled-period issue population; malformed retained issue evidence fails closed.'
    );
  } else {
    controlIssues.forEach((issue, index) => {
      if (
        !isRuntimeEvidenceObject(issue) ||
        (issue.severity !== 'error' && issue.severity !== 'warning') ||
        typeof issue.message !== 'string'
      ) {
        controlIssuePopulationStructurallyValid = false;
        blockingReasons.push(
          `PIR financial KPI governance contains malformed controlled-period issue evidence at index ${index}; retained issue evidence is not discarded or repaired.`
        );
        return;
      }

      if (issue.severity === 'error') {
        blockingReasons.push(issue.message);
      }
    });
  }

  blockingReasons.push(
    ...sourceIdentity.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message),
  );

  const controlledYear = operatingPeriodEnvelope?.year;
  if (sourceIdentity.year !== controlledYear) {
    blockingReasons.push(
      'PIR financial KPI source identity does not match the exact controlled operating-period year.'
    );
  }

  const uniqueBlockingReasons = Object.freeze([...new Set(blockingReasons)]);
  const controlPassed = operatingPeriodEnvelope?.passed === true;

  return Object.freeze({
    ready:
      controlPassed &&
      periodInputEnvelope !== null &&
      controlIssuePopulationStructurallyValid &&
      sourceIdentity.passed &&
      sourceIdentity.blockingIssueCount === 0 &&
      sourceIdentity.year === controlledYear &&
      uniqueBlockingReasons.length === 0,
    operatingPeriodControl: rawOperatingPeriodControl as PirOperatingPeriodControlledRow,
    sourceEvidence,
    sourceIdentity,
    blockingReasons: uniqueBlockingReasons,
  });
}
