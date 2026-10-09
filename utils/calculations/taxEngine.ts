import { FullModelAssumptions } from '../types';

/**
 * Audited fiscal tax layer.
 *
 * Key principles:
 * - Cash tax is based on fiscal taxable income, not accounting EBT.
 * - Accounting depreciation is added back and fiscal depreciation is deducted.
 * - Tax losses are tracked by vintage and expire after the configured carry-forward period.
 * - The corporate income tax rate comes from one central assumption only.
 */

export interface TaxYearInput {
  year: number;
  accountingPbt: number;
  accountingDepreciation: number;
  fiscalDepreciation: number;
  otherPermanentAdjustments?: number;
  otherTemporaryAdjustments?: number;
}

export interface TaxLossVintage {
  originYear: number;
  expiryYear: number;
  openingBalance: number;
  utilized: number;
  expired: number;
  closingBalance: number;
}

export interface TaxYearResult {
  year: number;
  accountingPbt: number;
  accountingDepreciation: number;
  fiscalDepreciation: number;
  permanentAdjustments: number;
  temporaryAdjustments: number;
  fiscalIncomeBeforeLosses: number;
  openingTaxLosses: number;
  taxLossGenerated: number;
  taxLossUtilized: number;
  taxLossExpired: number;
  closingTaxLosses: number;
  taxableIncome: number;
  corporateIncomeTaxRatePct: number;
  cashTax: number;
  effectiveCashTaxRatePct: number;
  deferredTaxTemporaryDifferenceMovement: number;
  deferredTaxExpenseBenefit: number;
  taxLossVintages: TaxLossVintage[];
}

interface InternalVintage {
  originYear: number;
  expiryYear: number;
  balance: number;
}

interface VintageActivity {
  openingBalance: number;
  utilized: number;
  expired: number;
}

export function calculateAuditedTaxSchedule(
  assumptions: FullModelAssumptions,
  inputs: TaxYearInput[]
): TaxYearResult[] {
  const taxRate = assumptions.tax.corporateIncomeTaxRatePct / 100;
  const carryForwardYears = Math.max(0, Math.floor(assumptions.tax.taxLossCarryForwardYears || 0));
  const vintages: InternalVintage[] = [];
  const results: TaxYearResult[] = [];

  for (const input of inputs) {
    const permanentAdjustments = input.otherPermanentAdjustments ?? 0;
    const temporaryAdjustments = input.otherTemporaryAdjustments ?? 0;

    // Accounting PBT already includes accounting depreciation. Add it back and
    // deduct fiscal depreciation to derive fiscal income before losses.
    const fiscalIncomeBeforeLosses =
      input.accountingPbt +
      input.accountingDepreciation -
      input.fiscalDepreciation +
      permanentAdjustments +
      temporaryAdjustments;

    // Capture each vintage before any current-year expiry/utilization so the
    // detailed roll-forward can be reconciled to the aggregate tax-loss bridge.
    const activity = new Map<number, VintageActivity>();
    for (const vintage of vintages) {
      activity.set(vintage.originYear, {
        openingBalance: vintage.balance,
        utilized: 0,
        expired: 0,
      });
    }

    const openingTaxLosses = vintages.reduce((sum, vintage) => sum + vintage.balance, 0);

    let taxLossExpired = 0;
    for (const vintage of vintages) {
      if (vintage.balance > 0 && input.year > vintage.expiryYear) {
        const expired = vintage.balance;
        taxLossExpired += expired;
        vintage.balance = 0;
        const row = activity.get(vintage.originYear);
        if (row) row.expired += expired;
      }
    }

    let taxLossGenerated = 0;
    let taxLossUtilized = 0;
    let taxableIncome = 0;

    if (fiscalIncomeBeforeLosses < 0) {
      taxLossGenerated = Math.abs(fiscalIncomeBeforeLosses);
      vintages.push({
        originYear: input.year,
        expiryYear: input.year + carryForwardYears,
        balance: taxLossGenerated,
      });
      // A loss generated this year has no opening balance; generation is already
      // disclosed separately in TaxYearResult and flows directly to closing balance.
      activity.set(input.year, {
        openingBalance: 0,
        utilized: 0,
        expired: 0,
      });
    } else {
      taxableIncome = fiscalIncomeBeforeLosses;

      // Oldest unexpired losses are utilized first.
      for (const vintage of vintages) {
        if (taxableIncome <= 0) break;
        if (vintage.balance <= 0) continue;
        const use = Math.min(vintage.balance, taxableIncome);
        vintage.balance -= use;
        taxableIncome -= use;
        taxLossUtilized += use;
        const row = activity.get(vintage.originYear);
        if (row) row.utilized += use;
      }
    }

    const closingTaxLosses = vintages.reduce((sum, vintage) => sum + vintage.balance, 0);
    const cashTax = Math.max(0, taxableIncome) * taxRate;
    const effectiveCashTaxRatePct = input.accountingPbt > 0 ? (cashTax / input.accountingPbt) * 100 : 0;

    // Temporary difference movement from accounting vs fiscal depreciation plus
    // explicitly supplied temporary adjustments. Positive means accounting NBV
    // exceeds tax base and therefore tends to create a DTL.
    const deferredTaxTemporaryDifferenceMovement =
      input.fiscalDepreciation - input.accountingDepreciation - temporaryAdjustments;
    const deferredTaxExpenseBenefit = deferredTaxTemporaryDifferenceMovement * taxRate;

    const snapshot: TaxLossVintage[] = vintages.map((vintage) => {
      const row = activity.get(vintage.originYear) ?? {
        openingBalance: 0,
        utilized: 0,
        expired: 0,
      };
      return {
        originYear: vintage.originYear,
        expiryYear: vintage.expiryYear,
        openingBalance: row.openingBalance,
        utilized: row.utilized,
        expired: row.expired,
        closingBalance: vintage.balance,
      };
    });

    results.push({
      year: input.year,
      accountingPbt: input.accountingPbt,
      accountingDepreciation: input.accountingDepreciation,
      fiscalDepreciation: input.fiscalDepreciation,
      permanentAdjustments,
      temporaryAdjustments,
      fiscalIncomeBeforeLosses,
      openingTaxLosses,
      taxLossGenerated,
      taxLossUtilized,
      taxLossExpired,
      closingTaxLosses,
      taxableIncome: Math.max(0, taxableIncome),
      corporateIncomeTaxRatePct: assumptions.tax.corporateIncomeTaxRatePct,
      cashTax,
      effectiveCashTaxRatePct,
      deferredTaxTemporaryDifferenceMovement,
      deferredTaxExpenseBenefit,
      taxLossVintages: snapshot,
    });
  }

  return results;
}
