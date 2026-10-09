import {
  AnnualOperatingRow,
  DebtScheduleRow,
  FullModelAssumptions,
  ModelCheckItem,
  SourcesAndUses,
} from '../types';

const TOL = 0.001;

/**
 * Independent debt-liquidity diagnostics.
 *
 * These controls do not change the operating model. They re-perform the
 * liquidity boundaries around DSRA and LLCR using the audited annual rows and
 * senior-debt schedule. No Shareholder Loan treatment or commercial reserve
 * convention is inferred here.
 */
export function buildDebtLiquidityDiagnostics(
  assumptions: FullModelAssumptions,
  sourcesAndUses: SourcesAndUses,
  debtSchedule: DebtScheduleRow[],
  annualRows: AnnualOperatingRow[]
): ModelCheckItem[] {
  const checks: ModelCheckItem[] = [];
  const rowCount = Math.min(debtSchedule.length, annualRows.length);
  const repaymentYears = Math.max(1, assumptions.funding.repaymentPeriodYears);
  const contractualLoanLife = Math.min(repaymentYears, rowCount);

  let maxOpeningContinuityError = 0;
  let maxTargetClosingError = 0;

  for (let i = 0; i < rowCount; i++) {
    const row = annualRows[i];
    const expectedOpening = i === 0
      ? sourcesAndUses.dsraPreFunding
      : annualRows[i - 1].closingDsra;
    const nextDebtService = debtSchedule[i + 1]?.totalDebtService ?? 0;
    const expectedClosing =
      (nextDebtService * assumptions.funding.dsraRequirementMonths) / 12;

    maxOpeningContinuityError = Math.max(
      maxOpeningContinuityError,
      Math.abs(row.openingDsra - expectedOpening)
    );
    maxTargetClosingError = Math.max(
      maxTargetClosingError,
      Math.abs(row.closingDsra - expectedClosing)
    );
  }

  const dsraContinuityError = Math.max(
    maxOpeningContinuityError,
    maxTargetClosingError
  );
  checks.push({
    id: 'chk_dsra_continuity_target',
    name: 'DSRA Continuity & Forward Target',
    category: 'debt',
    passed: rowCount > 0 && dsraContinuityError < TOL,
    valueDescription: `Opening continuity: ${maxOpeningContinuityError.toFixed(6)} IDR B | Closing target: ${maxTargetClosingError.toFixed(6)} IDR B`,
    tolerance: TOL,
    delta: dsraContinuityError,
    details: 'Opening DSRA must carry forward from the prior closing balance (with construction pre-funding at COD), and each closing DSRA must equal the model convention of the next-period senior debt-service requirement.',
  });

  if (contractualLoanLife > 0 && annualRows.length >= contractualLoanLife) {
    const maturityRow = annualRows[contractualLoanLife - 1];
    const maturityDebt = debtSchedule[contractualLoanLife - 1];
    const nextDebtService = debtSchedule[contractualLoanLife]?.totalDebtService ?? 0;
    const expectedRequiredDsra =
      (nextDebtService * assumptions.funding.dsraRequirementMonths) / 12;
    const maturityResidual = Math.max(
      Math.abs(maturityDebt?.closingBalance ?? 0),
      Math.abs(maturityRow.requiredDsra - expectedRequiredDsra),
      Math.abs(maturityRow.closingDsra - expectedRequiredDsra)
    );

    checks.push({
      id: 'chk_dsra_maturity_release',
      name: 'DSRA Release at Senior Debt Maturity',
      category: 'debt',
      passed: maturityResidual < TOL,
      valueDescription: `Closing debt: ${(maturityDebt?.closingBalance ?? 0).toFixed(6)} IDR B | Closing DSRA: ${maturityRow.closingDsra.toFixed(6)} IDR B`,
      tolerance: TOL,
      delta: maturityResidual,
      details: 'Under the current forward-looking DSRA convention, once contractual senior debt is fully repaid and no next-period senior debt service remains, required and closing DSRA should release to zero. This check does not infer any post-maturity reserve requirement.',
    });
  }

  let maxPostMaturityDebtActivity = 0;
  let postMaturityRows = 0;
  for (let i = contractualLoanLife; i < debtSchedule.length; i++) {
    const debt = debtSchedule[i];
    const activity = Math.max(
      Math.abs(debt.openingBalance),
      Math.abs(debt.drawdown),
      Math.abs(debt.capitalizedIdc),
      Math.abs(debt.principalRepayment),
      Math.abs(debt.interestExpense),
      Math.abs(debt.totalDebtService),
      Math.abs(debt.closingBalance)
    );
    maxPostMaturityDebtActivity = Math.max(maxPostMaturityDebtActivity, activity);
    postMaturityRows += 1;
  }

  checks.push({
    id: 'chk_no_post_maturity_senior_debt_activity',
    name: 'No Senior Debt Activity After Contractual Maturity',
    category: 'debt',
    passed: maxPostMaturityDebtActivity < TOL,
    valueDescription: postMaturityRows > 0
      ? `Post-maturity rows: ${postMaturityRows} | Max senior-debt activity: ${maxPostMaturityDebtActivity.toFixed(6)} IDR B`
      : 'No post-maturity schedule rows to test',
    tolerance: TOL,
    delta: maxPostMaturityDebtActivity,
    details: 'After the configured senior-debt repayment period, the operating schedule must not reintroduce opening/closing debt, drawdowns, capitalized IDC, principal, interest or debt service. This is a boundary control only; it does not introduce refinancing, balloon, extension or other post-maturity financing assumptions.',
  });

  let invalidPostDebtLlcr = 0;
  let missingDebtLifeLlcr = 0;
  for (let i = 0; i < rowCount; i++) {
    const openingDebt = debtSchedule[i].openingBalance;
    const shouldHaveLlcr = i < contractualLoanLife && openingDebt > 0.000001;
    const reportedLlcr = annualRows[i].llcr;

    if (shouldHaveLlcr && (reportedLlcr === null || !Number.isFinite(reportedLlcr))) {
      missingDebtLifeLlcr += 1;
    }
    if (!shouldHaveLlcr && reportedLlcr !== null) {
      invalidPostDebtLlcr += 1;
    }
  }

  const llcrBoundaryErrors = missingDebtLifeLlcr + invalidPostDebtLlcr;
  checks.push({
    id: 'chk_llcr_debt_life_boundary',
    name: 'LLCR Debt-Life Applicability Boundary',
    category: 'debt',
    passed: rowCount > 0 && llcrBoundaryErrors === 0,
    valueDescription: `Missing in debt life: ${missingDebtLifeLlcr} | Reported outside debt life: ${invalidPostDebtLlcr}`,
    tolerance: 0,
    delta: llcrBoundaryErrors,
    details: 'LLCR must be present only while senior debt is outstanding within contractual loan life and must not remain populated after the senior-debt denominator has ceased to exist.',
  });

  // Independently re-perform the live LLCR convention. This is deliberately a
  // reconciliation of existing model semantics, not a new lender assumption:
  // PV of audited CFADS through contractual senior-debt life, discounted at the
  // existing senior loan rate, plus opening DSRA, divided by opening senior debt.
  const loanRate = Math.max(0, assumptions.funding.bankInterestRatePct / 100);
  let maxLlcrReperformanceError = 0;
  let llcrReperformancePopulation = 0;

  for (let i = 0; i < rowCount; i++) {
    const openingDebt = debtSchedule[i].openingBalance;
    const reportedLlcr = annualRows[i].llcr;
    const shouldHaveLlcr = i < contractualLoanLife && openingDebt > 0.000001;

    if (!shouldHaveLlcr || reportedLlcr === null || !Number.isFinite(reportedLlcr)) {
      continue;
    }

    let pvCfads = 0;
    for (let k = i; k < contractualLoanLife; k++) {
      pvCfads += annualRows[k].cfadsIdrBillion / Math.pow(1 + loanRate, k - i + 1);
    }

    const expectedLlcr = (pvCfads + annualRows[i].openingDsra) / openingDebt;
    maxLlcrReperformanceError = Math.max(
      maxLlcrReperformanceError,
      Math.abs(reportedLlcr - expectedLlcr)
    );
    llcrReperformancePopulation += 1;
  }

  checks.push({
    id: 'chk_llcr_independent_reperformance',
    name: 'LLCR Independent Re-performance',
    category: 'debt',
    passed:
      rowCount > 0 &&
      llcrBoundaryErrors === 0 &&
      (llcrReperformancePopulation === 0 || maxLlcrReperformanceError < TOL),
    valueDescription: `Debt-life rows re-performed: ${llcrReperformancePopulation} | Max LLCR delta: ${maxLlcrReperformanceError.toFixed(6)}x`,
    tolerance: TOL,
    delta: maxLlcrReperformanceError,
    details: 'Reported LLCR is independently re-performed as PV of audited CFADS through contractual senior-debt life, discounted at the existing senior loan rate, plus opening DSRA, divided by opening senior debt. This verifies arithmetic consistency only and does not infer an alternative lender discount rate, reserve treatment or terminal value.',
  });

  return checks;
}
