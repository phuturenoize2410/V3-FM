import React from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  ModelMetrics,
  SourcesAndUses,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatNumber,
} from '../../utils/formatters';
import { Lightbulb, ArrowUpRight, Scale, CheckCircle2 } from 'lucide-react';

interface LcoeTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  metrics: ModelMetrics;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const LcoeTab: React.FC<LcoeTabProps> = ({
  assumptions,
  annualRows,
  metrics,
  sourcesAndUses,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const initialTariff = assumptions.revenue.baseTariffIdrPerKWh;
  const initialTariffCents = (initialTariff / fx) * 100;
  const tariffSpreadIdr = initialTariff - metrics.lcoeIdrPerKWh;
  const tariffSpreadCents = initialTariffCents - metrics.lcoeCentsPerKWh;

  // Dynamic LCOE PV Cost Breakdown
  const wacc = metrics.waccPct / 100;
  const pvCapex = sourcesAndUses.totalUses;
  const pvOpex = annualRows.reduce((sum, r) => sum + r.totalOpexIdrBillion / Math.pow(1 + wacc, r.year), 0);
  const pvTax = annualRows.reduce((sum, r) => sum + (r.corporateTax ?? r.incomeTaxIdrBillion ?? 0) / Math.pow(1 + wacc, r.year), 0);
  const pvTotal = pvCapex + pvOpex + pvTax;

  const capexPct = pvTotal > 0 ? (pvCapex / pvTotal) * 100 : 0;
  const opexPct = pvTotal > 0 ? (pvOpex / pvTotal) * 100 : 0;
  const taxPct = pvTotal > 0 ? (pvTax / pvTotal) * 100 : 0;

  const capexCentsPerKWh = (metrics.lcoeCentsPerKWh * capexPct) / 100;
  const opexCentsPerKWh = (metrics.lcoeCentsPerKWh * opexPct) / 100;
  const taxCentsPerKWh = (metrics.lcoeCentsPerKWh * taxPct) / 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with LCOE vs Tariff Comparison */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">
              Levelized Cost of Electricity (LCOE) Economics
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Discounted lifetime project expenditures divided by discounted lifetime net energy delivered.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">LCOE (¢/kWh)</span>
            <span className="text-amber-800 text-sm font-bold font-mono">
              {metrics.lcoeCentsPerKWh.toFixed(2)} ¢/kWh
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">LCOE (IDR/kWh)</span>
            <span className="text-slate-800 text-sm font-bold font-mono">
              {metrics.lcoeIdrPerKWh.toFixed(1)} IDR
            </span>
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">PPA Tariff (¢/kWh)</span>
            <span className="text-blue-800 text-sm font-bold font-mono">
              {initialTariffCents.toFixed(2)} ¢/kWh
            </span>
          </div>

          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-slate-500 block text-[10px] uppercase">Commercial Spread</span>
            <span className="text-emerald-800 text-sm font-bold font-mono">
              +{tariffSpreadCents.toFixed(2)} ¢/kWh
            </span>
          </div>

          <button
            data-audit-key="lcoe"
            onClick={() => onOpenAuditTrace('lcoe')}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Audit LCOE Trace</span>
          </button>
        </div>
      </div>

      {/* LCOE Structural Formula Explanation */}
      <div className="bg-slate-900 text-white rounded-lg p-4 border border-slate-800 text-xs font-mono">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
          International Renewable Energy Agency (IRENA) LCOE Formula:
        </div>
        <div className="text-amber-400 font-semibold mb-1">
          LCOE = [ CAPEX_0 + Σ (OPEX_t + Tax_t) / (1 + WACC)^t ] / [ Σ (Net Generation_t) / (1 + WACC)^t ]
        </div>
        <div className="text-slate-300">
          Discount Rate: WACC ({metrics.waccPct.toFixed(2)}%) • Concession Period: {assumptions.project.operatingPeriodYears} Years
        </div>
      </div>

      {/* Side-by-side Visual Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              LCOE Breakdown Components
            </h3>
            <Scale className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Initial Project CAPEX Component:</span>
              <span className="font-mono font-semibold text-slate-900">
                {capexCentsPerKWh.toFixed(2)} ¢/kWh ({capexPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Lifecycle Operations & Maintenance (O&M):</span>
              <span className="font-mono font-semibold text-slate-900">
                {opexCentsPerKWh.toFixed(2)} ¢/kWh ({opexPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Corporate Taxes & Levies:</span>
              <span className="font-mono font-semibold text-slate-900">
                {taxCentsPerKWh.toFixed(2)} ¢/kWh ({taxPct.toFixed(1)}%)
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900 text-sm">
              <span>Total Levelized Cost (LCOE):</span>
              <span className="text-amber-700 font-mono">{metrics.lcoeCentsPerKWh.toFixed(2)} ¢/kWh</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Commercial Viability & Profitability Margin
            </h3>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Offtake PPA Tariff (Year 1):</span>
              <span className="font-mono font-semibold text-blue-700">
                {initialTariffCents.toFixed(2)} ¢/kWh ({initialTariff.toLocaleString()} IDR)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Levelized Cost of Generation (LCOE):</span>
              <span className="font-mono font-semibold text-amber-700">
                {metrics.lcoeCentsPerKWh.toFixed(2)} ¢/kWh ({metrics.lcoeIdrPerKWh.toFixed(1)} IDR)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Levelized Economic Margin:</span>
              <span className="font-mono font-bold text-emerald-700">
                +{tariffSpreadCents.toFixed(2)} ¢/kWh (+{tariffSpreadIdr.toFixed(1)} IDR)
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
              <strong>Bankable Offtake Margin:</strong> The agreed PPA tariff exceeds the plant's LCOE by{' '}
              {((tariffSpreadCents / metrics.lcoeCentsPerKWh) * 100).toFixed(1)}%, providing substantial debt service buffer and equity returns.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
