import { ScheduleSourceReviewPanel } from '../ScheduleSourceReviewPanel';
import React from 'react';
import type { FullModelAssumptions, AnnualOperatingRow, SourcesAndUses, CurrencyDisplay } from '../../types';
import { financialValue, dependentValue, displayFinancialValue } from '../../calculations/financialValueState';
interface DsraTabProps {
  assumptions: FullModelAssumptions; annualRows: AnnualOperatingRow[]; sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay; onOpenAuditTrace: (key: string) => void;
}
export const DsraTab: React.FC<DsraTabProps> = ({ assumptions, annualRows, sourcesAndUses }) => {
  const fields: Array<[keyof AnnualOperatingRow, string]> = [['requiredDsra', 'Required target'], ['openingDsra', 'Opening reserve'], ['dsraFunding', 'Funding'], ['dsraRelease', 'Release'], ['closingDsra', 'Closing reserve']];
  return <div className="space-y-4 text-xs">
    <ScheduleSourceReviewPanel kind="dsra" assumptions={assumptions} annualRows={annualRows} sourcesAndUses={sourcesAndUses} />
    <section className="p-4 rounded-lg border border-stone-200 bg-[#fffdfa]">
      <h2 className="font-bold text-base">Debt Service Reserve Account (DSRA) Roll-Forward</h2>
      <p className="mt-2 font-semibold text-amber-800">DSRA SCHEDULE = BLOCKED / TERM NOT GOVERNED</p>
      <p className="mt-2">Required source terms: project/facility identity, currency and scale, eligible debt service, reserve form, opening balance, target period, funding/draw/release mechanics, source, version and approval evidence. No financing terms are inferred from the model.</p>
      <dl className="grid grid-cols-2 gap-2 mt-3">{fields.map(([, label]) => <React.Fragment key={label}><dt>{label} · governed</dt><dd className="text-amber-800">Blocked</dd></React.Fragment>)}</dl>
    </section>
    <details className="rounded-lg border border-stone-200 bg-[#fffdfa] p-4" open>
      <summary className="cursor-pointer font-semibold">MODEL ASSUMPTION / LEGACY COMPATIBILITY · IDR billion</summary>
      <p className="my-3">Current model input: {assumptions.funding.dsraRequirementMonths} months of next annual principal plus interest, divided by 12. Cash top-up/release equals the difference from opening reserve. No LC, reserve draw, contractual covenant verification or automatic direct equity transfer is modeled. These numbers are not governed balances.</p>
      <div className="overflow-auto"><table className="w-full text-right"><thead className="bg-slate-900 text-white"><tr><th className="p-3 text-left">Compatibility field</th>{annualRows.map(r => <th key={r.year} className="p-3">Y{r.year}</th>)}</tr></thead><tbody>{fields.map(([key, label]) => <tr key={key} className="border-b border-stone-100"><th className="p-3 text-left font-medium">{label}</th>{annualRows.map(r => {
        const inputs = ['requiredDsra', 'openingDsra', 'dsraFunding', 'dsraRelease'] as const;
        const v = key === 'closingDsra' ? dependentValue(r[key], `annualRows[${r.year}].${key}`, inputs.map(k => financialValue(r[k], k))) : financialValue(r[key], `annualRows[${r.year}].${key}`);
        return <td key={r.year} data-source-field={key} data-value-state={v.state} title={v.source} className="p-3 font-mono tabular-nums">{displayFinancialValue(v)}</td>;
      })}</tr>)}</tbody></table></div>
    </details>
  </div>;
};
