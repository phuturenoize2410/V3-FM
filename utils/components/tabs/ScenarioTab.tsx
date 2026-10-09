import React, { useMemo } from 'react';
import {
  FullModelAssumptions,
  ScenarioType,
  CurrencyDisplay,
} from '../../types';
import {
  calculateAuditedMonthlyCapex,
  calculateAuditedSourcesAndUses,
} from '../../calculations/constructionFundingEngine';
import { calculateAuditedDebtAndOperations } from '../../calculations/auditedOperatingEngine';
import { calculateModelMetrics } from '../../calculations/financialEngine';
import {
  formatPercent,
  formatMultiple,
  formatCurrencyValue,
} from '../../utils/formatters';
import { Layers, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface ScenarioTabProps {
  currentAssumptions: FullModelAssumptions;
  currentScenario: ScenarioType;
  currencyDisplay: CurrencyDisplay;
  onApplyScenario: (scenario: ScenarioType, modifiedAssumptions: FullModelAssumptions) => void;
}

export const ScenarioTab: React.FC<ScenarioTabProps> = ({
  currentAssumptions,
  currentScenario,
  currencyDisplay,
  onApplyScenario,
}) => {
  const fx = currentAssumptions.revenue.fxIdrPerUsd;

  // Build the 5 canonical scenarios
  const scenariosConfig = useMemo(() => {
    // 1. Base Case (P50)
    const baseAssumptions: FullModelAssumptions = JSON.parse(JSON.stringify(currentAssumptions));
    baseAssumptions.operating.capacityFactorPct = 64.0;
    baseAssumptions.funding.bankInterestRatePct = 9.3;

    // 2. Downside Hydrology (P75)
    const p75Assumptions: FullModelAssumptions = JSON.parse(JSON.stringify(baseAssumptions));
    p75Assumptions.operating.capacityFactorPct = 58.0;

    // 3. Severe Downside Hydrology (P90)
    const p90Assumptions: FullModelAssumptions = JSON.parse(JSON.stringify(baseAssumptions));
    p90Assumptions.operating.capacityFactorPct = 52.0;

    // 4. Capex Overrun (+10%)
    const capexOverrunAssumptions: FullModelAssumptions = JSON.parse(JSON.stringify(baseAssumptions));
    capexOverrunAssumptions.capexItems = capexOverrunAssumptions.capexItems.map((item) => ({
      ...item,
      amountIdrBillion: item.amountIdrBillion * 1.1,
    }));

    // 5. Refinancing Case (-1.5% interest rate)
    const refiAssumptions: FullModelAssumptions = JSON.parse(JSON.stringify(baseAssumptions));
    refiAssumptions.funding.bankInterestRatePct = 7.8;
    refiAssumptions.valuation.costOfDebtPreTaxPct = 7.8;

    const compute = (assump: FullModelAssumptions) => {
      const capexSched = calculateAuditedMonthlyCapex(assump);
      const su = calculateAuditedSourcesAndUses(assump, capexSched);
      const op = calculateAuditedDebtAndOperations(assump, su);
      const met = calculateModelMetrics(assump, capexSched, op.annualRows, su);
      return { assumptions: assump, su, met };
    };

    return [
      {
        id: 'base' as ScenarioType,
        title: 'Base Case (P50 Hydrology)',
        description: 'P50 river flow (64% CF), base CAPEX, 9.3% debt interest, standard 30-yr concession.',
        data: compute(baseAssumptions),
      },
      {
        id: 'p75' as ScenarioType,
        title: 'Downside Hydrology (P75)',
        description: 'Dry cycle rainfall decline, capacity factor drops to 58.0%.',
        data: compute(p75Assumptions),
      },
      {
        id: 'p90' as ScenarioType,
        title: 'Severe Hydrology (P90)',
        description: 'Severe multi-year drought, capacity factor drops to 52.0%.',
        data: compute(p90Assumptions),
      },
      {
        id: 'capex_overrun' as ScenarioType,
        title: 'CAPEX Overrun (+10%)',
        description: 'Geological tunnel anomalies causing 10% hard cost overrun.',
        data: compute(capexOverrunAssumptions),
      },
      {
        id: 'refinancing' as ScenarioType,
        title: 'Refinancing Optimization',
        description: 'Post-COD derisking allowing senior debt refinancing at 7.80% (-150 bps).',
        data: compute(refiAssumptions),
      },
    ];
  }, [currentAssumptions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Scenario Analysis & Management Alternatives
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare key project finance returns across P50/P75/P90 hydrology and stress cases.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Currently Active Scenario:</span>
          <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-bold uppercase">
            {currentScenario.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Comparative Scenario Matrix</span>
          <span>Click "Apply Scenario" to load assumptions into live model</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-3 min-w-[180px]">Key Financial Metric</th>
                {scenariosConfig.map((sc) => (
                  <th
                    key={sc.id}
                    className={`text-center py-3 px-3 min-w-[160px] ${
                      currentScenario === sc.id ? 'bg-blue-50/80 text-blue-900 font-bold' : ''
                    }`}
                  >
                    <div className="font-bold">{sc.title}</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5 max-w-[150px] mx-auto truncate">
                      {sc.description}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {/* Project IRR */}
              <tr>
                <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">Project IRR (Unlevered)</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center font-bold text-slate-800">
                    {formatPercent(sc.data.met.projectIrrPct, 2)}
                  </td>
                ))}
              </tr>

              {/* Equity IRR */}
              <tr className="bg-emerald-50/40">
                <td className="py-2.5 px-3 font-sans font-bold text-slate-900">Equity IRR (Levered)</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center font-bold text-emerald-800 text-sm">
                    {formatPercent(sc.data.met.equityIrrPct, 2)}
                  </td>
                ))}
              </tr>

              {/* Project NPV */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">Project NPV (WACC)</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-slate-800">
                    {formatCurrencyValue(sc.data.met.projectNpvIdrBillion, currencyDisplay, fx, 1)}
                  </td>
                ))}
              </tr>

              {/* Equity NPV */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">Equity NPV</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-slate-800">
                    {formatCurrencyValue(sc.data.met.equityNpvIdrBillion, currencyDisplay, fx, 1)}
                  </td>
                ))}
              </tr>

              {/* Minimum DSCR */}
              <tr className="bg-slate-50">
                <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">Minimum DSCR</td>
                {scenariosConfig.map((sc) => {
                  const pass = sc.data.met.minDscr >= 1.2;
                  return (
                    <td key={sc.id} className="py-2.5 px-3 text-center font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          pass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {formatMultiple(sc.data.met.minDscr, 2)}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Average DSCR */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">Average DSCR</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-slate-800">
                    {formatMultiple(sc.data.met.avgDscr, 2)}
                  </td>
                ))}
              </tr>

              {/* Equity Payback */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">Equity Payback Period</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-slate-800">
                    {sc.data.met.equityPaybackPeriodYears.toFixed(1)} Yrs
                  </td>
                ))}
              </tr>

              {/* LCOE */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">LCOE (¢/kWh)</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-amber-700 font-bold">
                    {sc.data.met.lcoeCentsPerKWh.toFixed(2)} ¢
                  </td>
                ))}
              </tr>

              {/* Levelized Tariff (IDR / kWh) */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">Levelized Tariff (IDR/kWh)</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                    Rp {(sc.data.met.levelizedTariffIdrPerKWh ?? sc.data.assumptions.revenue.baseTariffIdrPerKWh).toFixed(1)}
                  </td>
                ))}
              </tr>

              {/* Levelized Tariff (¢USD / kWh) */}
              <tr>
                <td className="py-2.5 px-3 font-sans text-slate-700">Levelized Tariff (¢USD/kWh)</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-2.5 px-3 text-center text-sky-700 font-bold">
                    {((sc.data.met.levelizedTariffUsdPerKWh ?? (sc.data.assumptions.revenue.baseTariffIdrPerKWh / fx)) * 100).toFixed(2)} ¢
                  </td>
                ))}
              </tr>

              {/* Action Buttons */}
              <tr className="bg-slate-100 font-sans">
                <td className="py-3 px-3 font-bold text-slate-700">Activate Scenario</td>
                {scenariosConfig.map((sc) => (
                  <td key={sc.id} className="py-3 px-3 text-center">
                    {currentScenario === sc.id ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                        <CheckCircle2 className="w-4 h-4" /> Active Now
                      </span>
                    ) : (
                      <button
                        onClick={() => onApplyScenario(sc.id, sc.data.assumptions)}
                        className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition"
                      >
                        Apply Scenario
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
