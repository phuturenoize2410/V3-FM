import React from 'react';
import type { FullModelAssumptions, AnnualOperatingRow, CurrencyDisplay } from '../../types';
import { financialValue, dependentValue, displayFinancialValue } from '../../calculations/financialValueState';
interface CfadsTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}
/** Read the exact audited operating population; do not reconstruct equity economics in JSX. */
export const CfadsTab: React.FC<CfadsTabProps> = ({ annualRows, onOpenAuditTrace }) => {
  const fields: Array<[keyof AnnualOperatingRow, string, number]> = [
    ['revenueIdrBillion', 'Revenue', 1], ['totalOpexIdrBillion', '(−) OPEX', -1],
    ['ebitdaIdrBillion', '(=) EBITDA', 1], ['corporateTax', '(−) Cash tax', -1],
    ['workingCapitalChange', '(−/+) Working Capital Delta', -1], ['cfadsIdrBillion', '(=) CFADS', 1],
    ['debtServiceIdrBillion', '(−) Senior Debt Service', -1], ['dsraFunding', '(−) DSRA Funding', -1],
    ['dsraRelease', '(+) DSRA Release', 1], ['cashBeginningBalance', '(+) Opening cash', 1],
    ['cashBeforeDistribution', '(=) Cash before distribution', 1], ['closingCashBuffer', '(−) Retained closing cash', -1],
    ['equityCashFlow', '(=) Equity cash flow / dividends', 1],
  ];
  const prerequisites: Partial<Record<keyof AnnualOperatingRow, Array<keyof AnnualOperatingRow>>> = {
    ebitdaIdrBillion: ['revenueIdrBillion', 'totalOpexIdrBillion'],
    cfadsIdrBillion: ['ebitdaIdrBillion', 'corporateTax', 'workingCapitalChange'],
    cashBeforeDistribution: ['cfadsIdrBillion', 'debtServiceIdrBillion', 'dsraFunding', 'dsraRelease', 'cashBeginningBalance'],
    equityCashFlow: ['cashBeforeDistribution', 'closingCashBuffer'],
  };
  const read = (row: AnnualOperatingRow, key: keyof AnnualOperatingRow) => dependentValue(row[key], `annualRows[${row.year}].${key}`, (prerequisites[key] ?? []).map(k => read(row, k)));
  return <div className="space-y-4 text-xs">
    <section className="rounded-lg border border-stone-200 bg-[#fffdfa] p-4">
      <h2 className="font-bold text-base text-slate-950">CFADS & Equity Cash Flow Waterfall</h2>
      <p className="mt-2 text-slate-600">Current audited model run · IDR billion · Model assumptions / working inputs, not governed Actual or an approved baseline.</p>
      <p className="mt-2">CFADS = EBITDA − cash tax − working capital change. Reserve funding/release is below CFADS. Equity cash flow is the engine's dividends after retaining the cash buffer; opening cash is included explicitly.</p>
      <p className="mt-2 text-amber-800">Working capital: year one uses an explicit engine zero; subsequent years use 5% of revenue change. This compatibility policy is not source-governed. DSRA financing terms and PPE capitalization evidence remain separate readiness blockers.</p>
      <button data-audit-key="cfads" onClick={() => onOpenAuditTrace('cfads')} className="mt-3 border rounded px-3 py-1.5">Audit CFADS Calculation</button>
    </section>
    <div className="overflow-auto rounded-lg border border-stone-200 bg-[#fffdfa]">
      <table className="w-full text-xs text-right"><thead className="bg-slate-900 text-white"><tr><th className="p-3 text-left">Audited schedule field · IDR billion</th>{annualRows.map(r => <th className="p-3" key={r.year}>Y{r.year}</th>)}</tr></thead>
      <tbody>{fields.map(([key, label, sign]) => <tr key={key} className="border-b border-stone-100"><th className="p-3 text-left font-medium whitespace-nowrap">{label}</th>{annualRows.map(r => { const v = read(r, key); return <td key={r.year} data-source-field={key} data-value-state={v.state} title={v.source + ('reason' in v ? `: ${v.reason}` : '')} className="p-3 font-mono tabular-nums">{displayFinancialValue(v, sign)}</td>; })}</tr>)}</tbody></table>
    </div>
  </div>;
};
