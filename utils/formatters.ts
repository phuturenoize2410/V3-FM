import { CurrencyDisplay } from '../types';

export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
  fallback: string = '-'
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrencyValue(
  valueIdrBillion: number | null | undefined,
  currencyDisplay: CurrencyDisplay = 'IDR_B',
  fxIdrPerUsd: number = 17000,
  decimals: number = 2
): string {
  if (valueIdrBillion === null || valueIdrBillion === undefined || !Number.isFinite(valueIdrBillion)) {
    return '-';
  }

  if ((currencyDisplay === 'USD_M' || currencyDisplay === 'USD_K') && (!Number.isFinite(fxIdrPerUsd) || fxIdrPerUsd <= 0)) return 'Blocked';
  let val = valueIdrBillion;
  switch (currencyDisplay) {
    case 'IDR_B':
      return `${formatNumber(val, decimals)} B`;
    case 'IDR_M':
      val = val * 1000;
      return `${formatNumber(val, 0)} M`;
    case 'USD_M':
      val = (val * 1e9) / fxIdrPerUsd / 1e6;
      return `$${formatNumber(val, decimals)} M`;
    case 'USD_K':
      val = (val * 1e9) / fxIdrPerUsd / 1e3;
      return `$${formatNumber(val, 0)} k`;
  }
}

export function formatPercent(
  valuePct: number | null | undefined,
  decimals: number = 2,
  includeSign: boolean = false
): string {
  if (valuePct === null || valuePct === undefined || !Number.isFinite(valuePct)) {
    return '-';
  }
  const prefix = includeSign && valuePct > 0 ? '+' : '';
  return `${prefix}${formatNumber(valuePct, decimals)}%`;
}

export function formatMultiple(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return `${formatNumber(value, decimals)}x`;
}

export function getDscrBadgeClass(dscr: number | null | undefined): {
  badge: string;
  text: string;
  label: string;
} {
  if (dscr === null || dscr === undefined || !Number.isFinite(dscr)) {
    return { badge: 'bg-slate-100 text-slate-600', text: 'text-slate-500', label: 'N/A' };
  }
  if (dscr < 1.0) {
    return { badge: 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold', text: 'text-rose-600 font-bold', label: 'Critical' };
  }
  if (dscr < 1.2) {
    return { badge: 'bg-amber-100 text-amber-800 border border-amber-300 font-medium', text: 'text-amber-600 font-medium', label: 'Warning' };
  }
  return { badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium', text: 'text-emerald-700 font-semibold', label: 'Healthy' };
}

export interface FormulaAuditItem {
  metricName: string;
  formula: string;
  description: string;
  dependencies: string[];
}

export const FORMULA_AUDIT_MAP: Record<string, FormulaAuditItem> = {
  project_irr: {
    metricName: 'Unlevered Project IRR (XIRR)',
    formula: '0 = Σ [ FCFF_t / (1 + Project_IRR)^((d_t - d_0)/365) ]',
    description:
      'The internal rate of return of unlevered Free Cash Flow to Firm (FCFF). Evaluates pure operational and capital return of the hydropower asset, independent of debt gearing or financing structures.',
    dependencies: ['Total CAPEX S-Curve', 'Operating EBITDA', 'Income Tax Paid', 'Working Capital Δ'],
  },
  equity_irr: {
    metricName: 'Levered Equity IRR (XIRR)',
    formula: '0 = Σ [ FCFE_t / (1 + Equity_IRR)^((d_t - d_0)/365) ]',
    description:
      'The internal rate of return earned by equity sponsors on paid-in equity capital after servicing senior bank debt, funding DSRA reserves, and settling corporate income taxes.',
    dependencies: ['Equity Injections', 'Operating CF', 'Debt Principal Amortization', 'External Bank Interest', 'DSRA Reserve Movement'],
  },
  min_dscr: {
    metricName: 'Minimum Debt Service Coverage Ratio (Min DSCR)',
    formula: 'Min DSCR = min( CFADS_t / Debt Service_t ) for all t in [1, Tenor]',
    description:
      'The primary bankability metric demanded by senior lenders. CFADS is divided by senior principal repayment and bank interest expense. Must strictly remain above the 1.20x banking covenant line.',
    dependencies: ['EBITDA', 'Corporate Income Tax', 'DSRA Transfers', 'Senior Principal Paid', 'Bank Interest Expense'],
  },
  llcr: {
    metricName: 'Loan Life Coverage Ratio (LLCR)',
    formula: 'LLCR_t = [ NPV(CFADS from t to Tenor at Kd) + DSRA_t ] / Debt_Opening_t',
    description:
      'Measures the present value of future Cash Flow Available for Debt Service over the remaining tenor of the senior facility relative to outstanding debt principal.',
    dependencies: ['CFADS Schedule', 'Cost of Debt (Kd)', 'DSRA Balance', 'Outstanding Debt Principal'],
  },
  lcoe: {
    metricName: 'Levelized Cost of Electricity (LCOE)',
    formula: 'LCOE = [ CAPEX_0 + Σ (OPEX_t + Tax_t) / (1 + WACC)^t ] / [ Σ (Net Gen_t) / (1 + WACC)^t ]',
    description:
      'The discounted lifetime lifecycle expenditures per kilowatt-hour of net electrical power generated. Expressed in IDR/kWh and USD cents/kWh (¢/kWh).',
    dependencies: ['Initial Project CAPEX', 'Annual Fixed/Variable OPEX', 'Corporate Taxes', 'Net Generation GWh', 'Blended WACC Rate'],
  },
  wacc: {
    metricName: 'Weighted Average Cost of Capital (WACC)',
    formula: 'WACC = (E / V) × Ke + (D / V) × Kd × (1 - CIT)',
    description:
      'Blended cost of capital hurdle used for project valuation and discounting. Incorporates corporate interest tax shield on senior bank debt.',
    dependencies: ['Debt / Equity Gearing Ratio', 'Cost of Equity (Ke via CAPM)', 'Cost of Debt (Kd)', 'Corporate Income Tax Rate (22%)'],
  },
  net_generation: {
    metricName: 'Net Annual Power Generation (GWh)',
    formula: 'Net Gen = Capacity (MW) × 8,760 hrs × Capacity Factor (%) × Availability (%) × (1 - Losses)',
    description:
      'Net energy metered and delivered to PLN interconnection substation, accounting for auxiliary consumption (0.8%) and transmission line losses (0.5%).',
    dependencies: ['Installed Capacity (18 MW)', 'Hydrological Capacity Factor (64%)', 'Plant Availability (97%)', 'Auxiliary & Line Losses'],
  },
  ebitda: {
    metricName: 'Operating EBITDA',
    formula: 'EBITDA = Revenue - Fixed OPEX - Variable OPEX - Water Rights & Admin',
    description:
      'Earnings Before Interest, Taxes, Depreciation, and Amortization. Pure operational cash profitability of the hydropower plant.',
    dependencies: ['Annual Revenue from PPA', 'Operations & Maintenance (O&M)', 'Insurance', 'Land & Water Concession Fees'],
  },
  income_tax: {
    metricName: 'Corporate Income Tax (CIT) & Loss Carry-Forward',
    formula: 'CIT = max(0, Taxable EBT - Utilized Tax Losses) × 22%',
    description:
      'Under Indonesian tax law (UU HPP), fiscal tax losses generated during early accelerated depreciation years are carried forward for up to 5 consecutive tax years.',
    dependencies: ['Accounting EBT', 'Fiscal Depreciation Accelerated Schedule', 'Tax Loss Carry-Forward Balance', 'Statutory CIT Rate (22%)'],
  },
  sources_uses: {
    metricName: 'Sources and Uses of Funds Balance',
    formula: 'Total Sources (Debt + Equity) = Total Uses (EPC + Soft Costs + IDC + Financing Fees)',
    description:
      'Fundamental construction accounting equation ensuring all project development and financing costs are fully funded with zero unfinanced deficit.',
    dependencies: ['Hard EPC CAPEX', 'Contingency', 'Land & Development', 'Interest During Construction (IDC)', 'Financing Fees'],
  },
};
