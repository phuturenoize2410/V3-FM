import type { AnnualOperatingRow, ModelCheckItem } from '../types';

const TOL_IDR_B = 0.001;

interface AliasFamily {
  id: string;
  name: string;
  category: ModelCheckItem['category'];
  values: (row: AnnualOperatingRow) => number[];
  description: string;
}

const ALIAS_FAMILIES: AliasFamily[] = [
  {
    id: 'chk_schedule_alias_cfads',
    name: 'Audited Schedule CFADS Alias Identity',
    category: 'cash_flow',
    values: (row) => [
      row.cfadsIdrBillion,
      row.cfads,
      row.projectFreeCashFlow,
      row.operatingCashFlow,
      row.fcffIdrBillion,
    ],
    description:
      'All audited schedule fields that currently represent the same CFADS / project free-cash-flow amount must remain numerically identical. This is an identity control only and does not define new CFADS economics.',
  },
  {
    id: 'chk_schedule_alias_principal',
    name: 'Audited Schedule Principal Alias Identity',
    category: 'debt',
    values: (row) => [row.principalRepayment, row.debtPrincipalRepayment],
    description:
      'Annual senior-debt principal aliases must remain identical so downstream schedules cannot diverge by field name.',
  },
  {
    id: 'chk_schedule_alias_interest',
    name: 'Audited Schedule Interest Alias Identity',
    category: 'debt',
    values: (row) => [row.interestExpense, row.interestPayment, row.debtInterestExpense],
    description:
      'Annual senior-debt cash-interest aliases must remain identical. This control does not infer fees, default interest, refinancing or Shareholder Loan treatment.',
  },
  {
    id: 'chk_schedule_alias_debt_service',
    name: 'Audited Schedule Debt Service Alias Identity',
    category: 'debt',
    values: (row) => [row.debtServiceIdrBillion, row.totalDebtService],
    description:
      'Annual senior-debt-service aliases must remain identical before downstream DSCR or cash-waterfall presentation relies on them.',
  },
  {
    id: 'chk_schedule_alias_opening_debt',
    name: 'Audited Schedule Opening Debt Alias Identity',
    category: 'debt',
    values: (row) => [row.debtOpeningBalance, row.openingDebt],
    description:
      'Annual opening senior-debt aliases must remain identical.',
  },
  {
    id: 'chk_schedule_alias_closing_debt',
    name: 'Audited Schedule Closing Debt Alias Identity',
    category: 'debt',
    values: (row) => [row.closingDebt, row.closingDebtBalance, row.bsDebt],
    description:
      'Annual closing senior-debt and balance-sheet debt aliases must remain identical.',
  },
  {
    id: 'chk_schedule_alias_cash_tax',
    name: 'Audited Schedule Cash Tax Alias Identity',
    category: 'tax',
    values: (row) => [row.corporateTax, row.incomeTaxIdrBillion],
    description:
      'Audited cash-tax aliases must remain identical; this check does not alter taxable-income or tax-loss mechanics.',
  },
  {
    id: 'chk_schedule_alias_cash',
    name: 'Audited Schedule Cash Alias Identity',
    category: 'cash_flow',
    values: (row) => [row.bsCash, row.bsCashAndCashEquivalents, row.cashEndingBalance],
    description:
      'Ending cash and balance-sheet cash aliases must remain identical across audited schedules.',
  },
  {
    id: 'chk_schedule_alias_dsra',
    name: 'Audited Schedule DSRA Alias Identity',
    category: 'debt',
    values: (row) => [row.bsDsra, row.bsDsraBalance, row.closingDsra],
    description:
      'Closing DSRA and balance-sheet DSRA aliases must remain identical.',
  },
  {
    id: 'chk_schedule_alias_working_capital',
    name: 'Audited Schedule Working Capital Alias Identity',
    category: 'cash_flow',
    values: (row) => [
      row.bsWorkingCapital,
      row.bsWorkingCapitalReceivables,
      row.workingCapitalClosing,
    ],
    description:
      'Closing working-capital aliases must remain identical. This control does not define accounting classification beyond the current explicit engine fields.',
  },
  {
    id: 'chk_schedule_alias_total_assets',
    name: 'Audited Schedule Total Assets Alias Identity',
    category: 'balance_sheet',
    values: (row) => [row.bsTotalAssets, row.totalAssets],
    description:
      'Total-assets aliases must remain identical across audited schedule consumers.',
  },
  {
    id: 'chk_schedule_alias_distributions',
    name: 'Audited Schedule Distribution Alias Identity',
    category: 'cash_flow',
    values: (row) => [
      row.dividendsPaid,
      row.dividendsDistributed,
      row.equityCashFlow,
      row.fcfeIdrBillion,
    ],
    description:
      'Current audited distribution / equity-cash-flow aliases must remain identical. This is a source-identity control and does not introduce Shareholder Loan repayment or other unresolved sponsor cash flows.',
  },
  {
    id: 'chk_schedule_alias_bs_difference',
    name: 'Audited Schedule Balance-Sheet Difference Alias Identity',
    category: 'balance_sheet',
    values: (row) => [row.bsDifference, row.balanceSheetDifference],
    description:
      'Balance-sheet residual aliases must remain identical so reconciliation status cannot differ between downstream views.',
  },
];

function maxFamilySpread(
  rows: AnnualOperatingRow[],
  family: AliasFamily
): { spread: number; finite: boolean } {
  let spread = 0;
  let finite = true;

  for (const row of rows) {
    const values = family.values(row);
    if (values.length < 2 || values.some((value) => !Number.isFinite(value))) {
      finite = false;
      continue;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    spread = Math.max(spread, Math.abs(max - min));
  }

  return { spread, finite };
}

/**
 * Independently verifies source identity across compatibility aliases carried by
 * the audited annual operating schedule.
 *
 * The live model intentionally exposes several synonymous fields because legacy
 * tabs and newer institutional schedules do not all consume the same property
 * names yet. Those aliases are a migration risk: a future refactor could update
 * one field while leaving another stale, causing two views to report different
 * values from the same audited engine result.
 *
 * Boundary: these diagnostics are read-only. They do not calculate or repair
 * economics, choose which alias is authoritative, infer accounting/commercial
 * semantics, introduce electricity assumptions, or mutate schedule rows.
 */
export function buildAuditedScheduleAliasDiagnostics(
  annualRows: AnnualOperatingRow[]
): ModelCheckItem[] {
  return ALIAS_FAMILIES.map((family) => {
    const { spread, finite } = maxFamilySpread(annualRows, family);
    const hasRows = annualRows.length > 0;
    const passed = hasRows && finite && spread < TOL_IDR_B;

    return {
      id: family.id,
      name: family.name,
      category: family.category,
      passed,
      valueDescription: !hasRows
        ? 'No audited annual schedule rows available'
        : !finite
          ? 'Non-finite alias value detected'
          : `Max alias spread: ${spread.toFixed(6)} IDR B`,
      tolerance: TOL_IDR_B,
      delta: hasRows && finite ? spread : Number.POSITIVE_INFINITY,
      details: family.description,
    };
  });
}
