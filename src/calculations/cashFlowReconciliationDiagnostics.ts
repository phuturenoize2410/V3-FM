import {
  AnnualOperatingRow,
  DebtScheduleRow,
  FullModelAssumptions,
  ModelCheckItem,
} from '../types';

const TOL_IDR_B = 0.001;

interface ReperformedTaxLossVintage {
  originYear: number;
  expiryYear: number;
  balance: number;
}

/**
 * Independent cross-layer reconciliations for the audited operating pipeline.
 *
 * These controls do not change model economics. They verify that the debt
 * schedule used for DSCR/sculpting is the same debt service carried into the
 * annual operating/cash-waterfall rows, that the current fiscal taxable-income
 * and tax-loss-vintage bridge is consistent with the audited tax inputs, that
 * the cash waterfall arithmetic is internally consistent, and that the current
 * live equity cash-flow fields remain aligned with the explicit dividend
 * convention.
 *
 * Shareholder Loan classification, coupon, repayment and sponsor-return
 * treatment remain outside these checks and are deliberately not inferred.
 */
export function buildCashFlowReconciliationChecks(
  assumptions: FullModelAssumptions,
  debtSchedule: DebtScheduleRow[],
  annualRows: AnnualOperatingRow[]
): ModelCheckItem[] {
  let maxDebtScheduleBridgeError = 0;

  for (let i = 0; i < annualRows.length; i++) {
    const row = annualRows[i];
    const debt = debtSchedule[i];
    if (!debt) {
      maxDebtScheduleBridgeError = Number.POSITIVE_INFINITY;
      break;
    }

    maxDebtScheduleBridgeError = Math.max(
      maxDebtScheduleBridgeError,
      Math.abs(row.principalRepayment - debt.principalRepayment),
      Math.abs(row.interestPayment - debt.interestExpense),
      Math.abs(row.debtServiceIdrBillion - debt.totalDebtService),
      Math.abs(row.debtOpeningBalance - debt.openingBalance),
      Math.abs(row.closingDebt - debt.closingBalance)
    );
  }

  if (debtSchedule.length !== annualRows.length) {
    maxDebtScheduleBridgeError = Number.POSITIVE_INFINITY;
  }

  const debtScheduleBridgeCheck: ModelCheckItem = {
    id: 'chk_debt_schedule_operating_bridge',
    name: 'Debt Schedule → Operating Cash Flow Bridge',
    category: 'debt',
    passed:
      Number.isFinite(maxDebtScheduleBridgeError) &&
      maxDebtScheduleBridgeError < TOL_IDR_B,
    valueDescription: Number.isFinite(maxDebtScheduleBridgeError)
      ? `Max bridge error: ${maxDebtScheduleBridgeError.toFixed(6)} IDR B`
      : `Schedule rows: ${debtSchedule.length} | Operating rows: ${annualRows.length}`,
    tolerance: TOL_IDR_B,
    delta: maxDebtScheduleBridgeError,
    details:
      'Annual principal, interest, debt service and opening/closing senior debt must reconcile exactly to the audited debt schedule used by sculpting and DSCR. This prevents downstream cash waterfall and return metrics from using a different debt-service population.',
  };

  // Re-perform the audited tax-loss bridge independently from annual operating
  // outputs. The calculation deliberately reconstructs loss vintages, expiry and
  // oldest-loss-first utilization rather than trusting aggregate opening/closing
  // tax-loss balances produced by the tax engine.
  const carryForwardYears = Math.max(
    0,
    Math.floor(assumptions.tax.taxLossCarryForwardYears || 0)
  );
  const reperformedVintages: ReperformedTaxLossVintage[] = [];
  let maxFiscalTaxableIncomeBridgeError = 0;
  let maxTaxLossGenerationError = 0;
  let maxTaxLossOpeningError = 0;
  let maxTaxLossExpiryError = 0;
  let maxTaxLossUtilizationError = 0;
  let maxTaxLossClosingError = 0;

  for (const row of annualRows) {
    const expectedOpeningTaxLosses = reperformedVintages.reduce(
      (sum, vintage) => sum + vintage.balance,
      0
    );

    let expectedLossExpired = 0;
    for (const vintage of reperformedVintages) {
      if (vintage.balance > 0 && row.year > vintage.expiryYear) {
        expectedLossExpired += vintage.balance;
        vintage.balance = 0;
      }
    }

    const fiscalIncomeBeforeLosses =
      row.ebtIdrBillion + row.accountingDepreciation - row.fiscalDepreciation;
    const expectedLossGenerated = Math.max(0, -fiscalIncomeBeforeLosses);
    let expectedLossUtilized = 0;
    let expectedTaxableIncome = Math.max(0, fiscalIncomeBeforeLosses);

    if (expectedLossGenerated > 0) {
      reperformedVintages.push({
        originYear: row.year,
        expiryYear: row.year + carryForwardYears,
        balance: expectedLossGenerated,
      });
      expectedTaxableIncome = 0;
    } else {
      for (const vintage of reperformedVintages) {
        if (expectedTaxableIncome <= 0) break;
        if (vintage.balance <= 0) continue;
        const utilization = Math.min(vintage.balance, expectedTaxableIncome);
        vintage.balance -= utilization;
        expectedTaxableIncome -= utilization;
        expectedLossUtilized += utilization;
      }
    }

    const expectedClosingTaxLosses = reperformedVintages.reduce(
      (sum, vintage) => sum + vintage.balance,
      0
    );
    const impliedLossExpired =
      row.taxLossOpening +
      row.taxLossGenerated -
      row.taxLossUtilized -
      row.taxLossClosing;

    maxFiscalTaxableIncomeBridgeError = Math.max(
      maxFiscalTaxableIncomeBridgeError,
      Math.abs(row.taxableIncome - expectedTaxableIncome)
    );
    maxTaxLossGenerationError = Math.max(
      maxTaxLossGenerationError,
      Math.abs(row.taxLossGenerated - expectedLossGenerated)
    );
    maxTaxLossOpeningError = Math.max(
      maxTaxLossOpeningError,
      Math.abs(row.taxLossOpening - expectedOpeningTaxLosses)
    );
    maxTaxLossExpiryError = Math.max(
      maxTaxLossExpiryError,
      Math.abs(impliedLossExpired - expectedLossExpired),
      Math.max(0, -impliedLossExpired)
    );
    maxTaxLossUtilizationError = Math.max(
      maxTaxLossUtilizationError,
      Math.abs(row.taxLossUtilized - expectedLossUtilized)
    );
    maxTaxLossClosingError = Math.max(
      maxTaxLossClosingError,
      Math.abs(row.taxLossClosing - expectedClosingTaxLosses)
    );
  }

  const fiscalTaxableIncomeBridgeError = Math.max(
    maxFiscalTaxableIncomeBridgeError,
    maxTaxLossGenerationError,
    maxTaxLossOpeningError,
    maxTaxLossExpiryError,
    maxTaxLossUtilizationError,
    maxTaxLossClosingError
  );

  const fiscalTaxableIncomeBridgeCheck: ModelCheckItem = {
    id: 'chk_fiscal_taxable_income_bridge',
    name: 'Fiscal Taxable Income & Tax-Loss Vintage Bridge',
    category: 'tax',
    passed: fiscalTaxableIncomeBridgeError < TOL_IDR_B,
    valueDescription: `Max fiscal bridge error: ${fiscalTaxableIncomeBridgeError.toFixed(6)} IDR B`,
    tolerance: TOL_IDR_B,
    delta: fiscalTaxableIncomeBridgeError,
    details:
      'Independently re-performs the current audited fiscal bridge: accounting PBT + accounting depreciation - fiscal depreciation, then reconstructs tax-loss vintages, configured expiry, oldest-loss-first utilization, taxable income and aggregate opening/closing losses. Expired losses are independently reconstructed and reconciled to the expiry implied by opening + generation - utilization - closing, so expiry cannot disappear silently from the aggregate roll-forward. The live audited pipeline currently passes no other permanent or temporary tax adjustments; if such adjustments are introduced, they must be made explicit in the operating output and this control rather than inferred.',
  };

  // Re-perform the live cash-tax and CFADS source formulas independently from the
  // tax engine and operating-row CFADS fields. This proves that the CFADS used by
  // sculpting and downstream cash-waterfall diagnostics is actually sourced from
  // EBITDA less cash tax less the explicit working-capital movement, rather than
  // only checking agreement between duplicate CFADS presentation fields.
  const corporateTaxRate = assumptions.tax.corporateIncomeTaxRatePct / 100;
  let maxCashTaxBridgeError = 0;
  let maxCfadsSourceBridgeError = 0;

  for (const row of annualRows) {
    const expectedCashTax = Math.max(0, row.taxableIncome) * corporateTaxRate;
    const expectedCfads =
      row.ebitdaIdrBillion - expectedCashTax - row.workingCapitalChange;

    maxCashTaxBridgeError = Math.max(
      maxCashTaxBridgeError,
      Math.abs(row.corporateTax - expectedCashTax),
      Math.abs(row.incomeTaxIdrBillion - expectedCashTax)
    );
    maxCfadsSourceBridgeError = Math.max(
      maxCfadsSourceBridgeError,
      Math.abs(row.cfadsIdrBillion - expectedCfads),
      Math.abs(row.cfads - expectedCfads),
      Math.abs(row.projectFreeCashFlow - expectedCfads),
      Math.abs(row.operatingCashFlow - expectedCfads),
      Math.abs(row.fcffIdrBillion - expectedCfads)
    );
  }

  const cashTaxCfadsSourceBridgeError = Math.max(
    maxCashTaxBridgeError,
    maxCfadsSourceBridgeError
  );

  const cashTaxCfadsSourceBridgeCheck: ModelCheckItem = {
    id: 'chk_cash_tax_cfads_source_bridge',
    name: 'Cash Tax & CFADS Source Bridge',
    category: 'cash_flow',
    passed: cashTaxCfadsSourceBridgeError < TOL_IDR_B,
    valueDescription: `Max source bridge error: ${cashTaxCfadsSourceBridgeError.toFixed(6)} IDR B`,
    tolerance: TOL_IDR_B,
    delta: cashTaxCfadsSourceBridgeError,
    details:
      'Independently re-performs cash tax as taxable income multiplied by the central corporate-income-tax assumption, then re-performs live CFADS as EBITDA - cash tax - working-capital change. This validates the source formula used by debt sculpting and the cash waterfall; it does not add sustaining CAPEX, alter the existing working-capital convention, or infer any new fiscal adjustment.',
  };

  let maxCashWaterfallError = 0;
  for (const row of annualRows) {
    const expectedCashBeforeDistribution =
      row.cashBeginningBalance +
      row.cfadsIdrBillion -
      row.debtServiceIdrBillion -
      row.dsraFunding +
      row.dsraRelease;
    const expectedCashEndingBalance = row.cashBeforeDistribution - row.dividendsPaid;
    const expectedNetChangeInCash = row.cashEndingBalance - row.cashBeginningBalance;
    const expectedDsraMovement = row.dsraFunding - row.dsraRelease;

    maxCashWaterfallError = Math.max(
      maxCashWaterfallError,
      Math.abs(row.cashBeforeDistribution - expectedCashBeforeDistribution),
      Math.abs(row.cashEndingBalance - expectedCashEndingBalance),
      Math.abs(row.closingCashBuffer - row.cashEndingBalance),
      Math.abs(row.netChangeInCash - expectedNetChangeInCash),
      Math.abs(row.dsraMovement - expectedDsraMovement),
      Math.abs(row.projectFreeCashFlow - row.cfadsIdrBillion),
      Math.abs(row.operatingCashFlow - row.cfadsIdrBillion),
      Math.abs(row.fcffIdrBillion - row.cfadsIdrBillion),
      Math.abs(row.cfads - row.cfadsIdrBillion)
    );
  }

  const cashWaterfallCheck: ModelCheckItem = {
    id: 'chk_cash_waterfall_arithmetic',
    name: 'CFADS → Debt Service → DSRA → Cash Waterfall',
    category: 'cash_flow',
    passed: maxCashWaterfallError < TOL_IDR_B,
    valueDescription: `Max waterfall error: ${maxCashWaterfallError.toFixed(6)} IDR B`,
    tolerance: TOL_IDR_B,
    delta: maxCashWaterfallError,
    details:
      'Independently re-performs the annual cash waterfall from opening cash + audited CFADS - senior debt service - DSRA funding + DSRA release, then reconciles distributions, closing cash, net cash movement and the duplicated CFADS/FCFF presentation fields. This is arithmetic validation only and does not introduce sustaining-capex, working-capital or Shareholder Loan assumptions.',
  };

  const cashBuffer = assumptions.funding.minimumCashBufferBillion;
  let maxCashBufferShortfall = 0;
  let minimumEndingCash = Number.POSITIVE_INFINITY;

  for (const row of annualRows) {
    maxCashBufferShortfall = Math.max(
      maxCashBufferShortfall,
      Math.max(0, cashBuffer - row.cashEndingBalance)
    );
    minimumEndingCash = Math.min(minimumEndingCash, row.cashEndingBalance);
  }

  const cashLiquidityAdequacyCheck: ModelCheckItem = {
    id: 'chk_cash_buffer_adequacy',
    name: 'Unrestricted Cash & Minimum Buffer Adequacy',
    category: 'cash_flow',
    passed: annualRows.length > 0 && maxCashBufferShortfall < TOL_IDR_B,
    valueDescription: annualRows.length > 0
      ? `Minimum ending cash: ${minimumEndingCash.toFixed(6)} IDR B | Max buffer shortfall: ${maxCashBufferShortfall.toFixed(6)} IDR B`
      : 'No operating cash-flow rows available',
    tolerance: TOL_IDR_B,
    delta: annualRows.length > 0 ? maxCashBufferShortfall : Number.POSITIVE_INFINITY,
    details:
      'After audited CFADS, senior debt service and DSRA movements, unrestricted ending cash must retain the explicit minimum cash-buffer assumption. A failure identifies an unresolved liquidity/funding shortfall; this diagnostic does not invent cure equity, additional debt, DSRA draw mechanics, cash sweep, covenant cure or any other financing remedy.',
  };

  let maxEquityCashFlowBridgeError = 0;

  for (const row of annualRows) {
    const expectedDividend = Math.max(0, row.cashBeforeDistribution - cashBuffer);
    maxEquityCashFlowBridgeError = Math.max(
      maxEquityCashFlowBridgeError,
      Math.abs(row.dividendsPaid - expectedDividend),
      Math.abs(row.equityCashFlow - row.dividendsPaid),
      Math.abs(row.fcfeIdrBillion - row.dividendsPaid),
      Math.abs(row.dividendsDistributed - row.dividendsPaid)
    );
  }

  const equityCashFlowBridgeCheck: ModelCheckItem = {
    id: 'chk_equity_cash_flow_bridge',
    name: 'Equity Cash Flow & Distribution Bridge',
    category: 'cash_flow',
    passed: maxEquityCashFlowBridgeError < TOL_IDR_B,
    valueDescription: `Max bridge error: ${maxEquityCashFlowBridgeError.toFixed(6)} IDR B`,
    tolerance: TOL_IDR_B,
    delta: maxEquityCashFlowBridgeError,
    details:
      'Under the current live convention, dividends equal cash available above the explicit minimum cash buffer, and equityCashFlow / FCFE / dividendsDistributed must equal dividendsPaid. This is an internal consistency check only; it does not resolve Shareholder Loan debt/equity classification, repayment or sponsor-return treatment.',
  };

  return [
    debtScheduleBridgeCheck,
    fiscalTaxableIncomeBridgeCheck,
    cashTaxCfadsSourceBridgeCheck,
    cashWaterfallCheck,
    cashLiquidityAdequacyCheck,
    equityCashFlowBridgeCheck,
  ];
}
