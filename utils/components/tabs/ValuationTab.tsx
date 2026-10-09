import React, { useState } from 'react';
import {
  FullModelAssumptions,
  ModelMetrics,
  SourcesAndUses,
  CurrencyDisplay,
} from '../../types';
import { Target, Calculator, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ValuationTabProps {
  assumptions: FullModelAssumptions;
  metrics: ModelMetrics;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const ValuationTab: React.FC<ValuationTabProps> = ({
  assumptions,
  metrics,
}) => {
  const { valuation, funding, tax } = assumptions;
  const [showWaccAudit, setShowWaccAudit] = useState(false);

  const debtWeight = funding.bankDebtPct / 100;
  const equityWeight = funding.equityPct / 100;
  const shareholderLoanWeight = funding.shareholderLoanPct / 100;
  const sponsorCapitalWeight = equityWeight + shareholderLoanWeight;
  const preTaxCostOfDebt = valuation.costOfDebtPreTaxPct;
  const corporateTaxRate = tax.corporateIncomeTaxRatePct / 100;
  const afterTaxCostOfDebt = preTaxCostOfDebt * (1 - corporateTaxRate);
  const costOfEquity = valuation.costOfEquityPct;

  // Re-perform the live model's current WACC convention independently in the UI.
  // The finance engine currently prices Shareholder Loan within sponsor capital at Ke.
  // This is mechanically reconcilable, but it is not sponsor-final when SHL is non-zero
  // because SHL coupon, repayment, subordination and debt/equity classification remain unresolved.
  const debtContributionPct = debtWeight * afterTaxCostOfDebt;
  const sponsorCapitalContributionPct = sponsorCapitalWeight * costOfEquity;
  const reperformedWaccPct = debtContributionPct + sponsorCapitalContributionPct;
  const waccDifferenceBps = (metrics.waccPct - reperformedWaccPct) * 100;
  const waccReconciles = Math.abs(waccDifferenceBps) <= 0.1;
  const hasShareholderLoan = funding.shareholderLoanPct > 0.000001;
  const totalFundingWeightPct =
    funding.bankDebtPct + funding.equityPct + funding.shareholderLoanPct;
  const fundingWeightsReconcile = Math.abs(totalFundingWeightPct - 100) <= 0.001;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="rounded-lg border border-slate-200 bg-[#fbfaf7] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold tracking-tight text-slate-950">
              Valuation & Weighted Average Cost of Capital
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Discount-rate derivation, tax shield, capital-weight reconciliation and valuation scope.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowWaccAudit((current) => !current)}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-expanded={showWaccAudit}
        >
          <Calculator className="w-4 h-4" />
          <span>Audit WACC Formula</span>
          {showWaccAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showWaccAudit && (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Independent UI Re-performance
              </div>
              <div className="mt-0.5 text-sm font-semibold">WACC Formula Audit</div>
            </div>
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              waccReconciles && fundingWeightsReconcile
                ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300'
                : 'border-rose-700 bg-rose-950/50 text-rose-300'
            }`}>
              {waccReconciles && fundingWeightsReconcile ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {waccReconciles && fundingWeightsReconcile ? 'Reconciled' : 'Review Required'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-slate-200 md:grid-cols-4">
            <AuditMetric label="Senior Debt Weight" value={`${funding.bankDebtPct.toFixed(2)}%`} />
            <AuditMetric label="Sponsor Equity Weight" value={`${funding.equityPct.toFixed(2)}%`} />
            <AuditMetric label="Shareholder Loan Weight" value={`${funding.shareholderLoanPct.toFixed(2)}%`} />
            <AuditMetric label="Total Funding Weight" value={`${totalFundingWeightPct.toFixed(2)}%`} />
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs leading-6 text-slate-800">
                WACC = Wd × Kd × (1 − t) + (We + Wshl) × Ke
              </div>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <AuditRow
                  label="Debt contribution"
                  formula={`${funding.bankDebtPct.toFixed(2)}% × ${preTaxCostOfDebt.toFixed(2)}% × (1 − ${(corporateTaxRate * 100).toFixed(2)}%)`}
                  value={`${debtContributionPct.toFixed(4)}%`}
                />
                <AuditRow
                  label="Sponsor capital contribution"
                  formula={`(${funding.equityPct.toFixed(2)}% + ${funding.shareholderLoanPct.toFixed(2)}%) × ${costOfEquity.toFixed(2)}%`}
                  value={`${sponsorCapitalContributionPct.toFixed(4)}%`}
                />
                <AuditRow
                  label="Re-performed WACC"
                  formula="Debt contribution + Sponsor capital contribution"
                  value={`${reperformedWaccPct.toFixed(4)}%`}
                  emphasized
                />
                <AuditRow
                  label="Model WACC"
                  formula="Live ModelMetrics output"
                  value={`${metrics.waccPct.toFixed(4)}%`}
                  emphasized
                />
                <AuditRow
                  label="Difference"
                  formula="Model WACC − Re-performed WACC"
                  value={`${waccDifferenceBps >= 0 ? '+' : ''}${waccDifferenceBps.toFixed(2)} bps`}
                />
              </div>
            </div>

            <div className="space-y-3">
              {!fundingWeightsReconcile && (
                <ScopeNote tone="error" title="Funding weights do not reconcile">
                  Senior Debt + Sponsor Equity + Shareholder Loan equals {totalFundingWeightPct.toFixed(2)}%, not 100.00%.
                  WACC should not be relied upon until the funding mix is corrected.
                </ScopeNote>
              )}
              {hasShareholderLoan && (
                <ScopeNote tone="warning" title="Provisional SHL treatment">
                  The live model currently prices Shareholder Loan within sponsor capital at the Cost of Equity.
                  This is a transparent mechanical convention only. Sponsor-final WACC requires explicit SHL coupon,
                  repayment, subordination and debt/equity classification.
                </ScopeNote>
              )}
              {!hasShareholderLoan && fundingWeightsReconcile && waccReconciles && (
                <ScopeNote tone="success" title="Current scope reconciles">
                  With no Shareholder Loan in the funding mix, the displayed WACC independently reconciles to the
                  live model output within 0.1 basis point.
                </ScopeNote>
              )}
              {!waccReconciles && (
                <ScopeNote tone="error" title="Formula mismatch">
                  The displayed re-performance differs from the live model by {Math.abs(waccDifferenceBps).toFixed(2)} bps.
                  Treat WACC-dependent valuation outputs as unresolved until the source calculation is reconciled.
                </ScopeNote>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Cost of Equity
            </h3>
            <span className="font-mono font-semibold tabular-nums text-slate-950">{costOfEquity.toFixed(2)}%</span>
          </div>
          <div className="space-y-2 text-xs">
            <MetricRow label="Risk-Free Rate" value={`${valuation.riskFreeRatePct.toFixed(2)}%`} />
            <MetricRow label="Equity Risk Premium" value={`${valuation.equityRiskPremiumPct.toFixed(2)}%`} />
            <MetricRow label="Beta" value={valuation.beta.toFixed(2)} />
            <MetricRow label="Sponsor Equity Weight" value={`${(equityWeight * 100).toFixed(2)}%`} strong />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Cost of Debt & Tax Shield
            </h3>
            <span className="font-mono font-semibold tabular-nums text-slate-950">{afterTaxCostOfDebt.toFixed(2)}%</span>
          </div>
          <div className="space-y-2 text-xs">
            <MetricRow label="Pre-Tax Cost of Debt" value={`${preTaxCostOfDebt.toFixed(2)}%`} />
            <MetricRow label="Corporate Income Tax Rate" value={`${(corporateTaxRate * 100).toFixed(2)}%`} />
            <MetricRow label="Tax Shield Factor" value={(1 - corporateTaxRate).toFixed(4)} />
            <MetricRow label="Senior Debt Weight" value={`${(debtWeight * 100).toFixed(2)}%`} strong />
          </div>
        </div>

        <div className="rounded-lg border border-slate-300 bg-[#fbfaf7] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
              Blended Project WACC
            </h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              hasShareholderLoan
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-white text-slate-600'
            }`}>
              {hasShareholderLoan ? 'Provisional Scope' : 'Live Model'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <MetricRow label="Debt Contribution" value={`${debtContributionPct.toFixed(4)}%`} />
            <MetricRow label="Sponsor Capital Contribution" value={`${sponsorCapitalContributionPct.toFixed(4)}%`} />
            <div className="flex items-end justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-900">WACC</span>
              <span className="font-mono text-lg font-semibold tabular-nums text-slate-950">
                {metrics.waccPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-[#fbfaf7] p-4 text-xs leading-5 text-slate-600">
        <strong className="text-slate-800">Terminal / Exit Value Scope:</strong> No transfer value, exit value,
        residual value or concession-expiry proceeds are inferred on this screen. Any such value must be explicitly
        modelled in the relevant investment case before it is included in returns or valuation.
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong = false }) => (
  <div className={`flex items-center justify-between gap-3 ${strong ? 'border-t border-slate-100 pt-2 font-semibold' : ''}`}>
    <span className="text-slate-500">{label}</span>
    <span className="font-mono tabular-nums text-slate-900">{value}</span>
  </div>
);

const AuditMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-white px-4 py-3">
    <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</div>
  </div>
);

const AuditRow: React.FC<{ label: string; formula: string; value: string; emphasized?: boolean }> = ({
  label,
  formula,
  value,
  emphasized = false,
}) => (
  <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-xs ${emphasized ? 'bg-[#fbfaf7]' : 'bg-white'}`}>
    <div className="min-w-0">
      <div className={`text-slate-800 ${emphasized ? 'font-semibold' : 'font-medium'}`}>{label}</div>
      <div className="mt-0.5 font-mono text-[10px] leading-4 text-slate-500">{formula}</div>
    </div>
    <div className={`self-center font-mono tabular-nums text-slate-950 ${emphasized ? 'font-semibold' : 'font-medium'}`}>
      {value}
    </div>
  </div>
);

const ScopeNote: React.FC<{ tone: 'success' | 'warning' | 'error'; title: string; children: React.ReactNode }> = ({
  tone,
  title,
  children,
}) => {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-rose-200 bg-rose-50 text-rose-950';

  return (
    <div className={`rounded-md border p-3 text-[11px] leading-4 ${toneClass}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-1 opacity-90">{children}</div>
    </div>
  );
};
