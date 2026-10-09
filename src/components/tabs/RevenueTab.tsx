import React, { useState } from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  CurrencyDisplay,
  TariffComponents,
} from '../../types';
import {
  formatCurrencyValue,
  formatNumber,
} from '../../utils/formatters';
import {
  Zap,
  HelpCircle,
  ArrowUpRight,
  Sliders,
  Layers,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Info,
} from 'lucide-react';
import { TECHNOLOGY_REGISTRY } from '../../calculations/defaultAssumptions';

interface RevenueTabProps {
  assumptions: FullModelAssumptions;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
  onUpdateAssumptions?: (a: FullModelAssumptions) => void;
}

export const RevenueTab: React.FC<RevenueTabProps> = ({
  assumptions,
  annualRows,
  currencyDisplay,
  onOpenAuditTrace,
  onUpdateAssumptions,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const currentTech = assumptions.project.technology || 'hydro';
  const currentTechMeta = TECHNOLOGY_REGISTRY[currentTech] || TECHNOLOGY_REGISTRY.hydro;

  const tc: TariffComponents = assumptions.revenue.tariffComponents || {
    useComponents: false,
    componentA_CapitalRecoveryIdrPerKWh: 850,
    componentB_FixedOpexIdrPerKWh: 230,
    componentC_WaterLevyIdrPerKWh: 70,
    componentD_VariableOpexIdrPerKWh: 100,
    componentE_TaxAdjustmentIdrPerKWh: 0,
    componentAEscalationPct: 0,
    componentBEscalationPct: 2.5,
    componentCEscalationPct: 2.0,
    componentDEscalationPct: 2.0,
    componentEEscalationPct: 0,
    componentADegressionAfterLoan: true,
    componentADegressionPct: 50.0,
    componentEDegressionAfterLoan: false,
    componentEDegressionPct: 0,
    twoTierEnabled: false,
    tier1DurationYears: 12,
    tier1TariffIdrPerKWh: 1460,
    tier2TariffIdrPerKWh: 1020,
    levelizedDiscountRatePct: 6.0,
  };

  const [showComponentCols, setShowComponentCols] = useState<boolean>(tc.useComponents);

  const updateTariffComponents = (partial: Partial<TariffComponents>) => {
    if (!onUpdateAssumptions) return;
    const updatedTc: TariffComponents = {
      ...tc,
      ...partial,
    };
    const totalFromComponents =
      updatedTc.componentA_CapitalRecoveryIdrPerKWh +
      updatedTc.componentB_FixedOpexIdrPerKWh +
      updatedTc.componentC_WaterLevyIdrPerKWh +
      updatedTc.componentD_VariableOpexIdrPerKWh +
      (updatedTc.componentE_TaxAdjustmentIdrPerKWh || 0);

    onUpdateAssumptions({
      ...assumptions,
      revenue: {
        ...assumptions.revenue,
        baseTariffIdrPerKWh: updatedTc.useComponents
          ? totalFromComponents
          : assumptions.revenue.baseTariffIdrPerKWh,
        tariffComponents: updatedTc,
      },
    });
  };

  const toggleUseComponents = (enabled: boolean) => {
    setShowComponentCols(enabled);
    updateTariffComponents({ useComponents: enabled });
  };

  const totalBaseFromComponents =
    tc.componentA_CapitalRecoveryIdrPerKWh +
    tc.componentB_FixedOpexIdrPerKWh +
    tc.componentC_WaterLevyIdrPerKWh +
    tc.componentD_VariableOpexIdrPerKWh +
    (tc.componentE_TaxAdjustmentIdrPerKWh || 0);

  const activeBaseTariff = tc.useComponents
    ? totalBaseFromComponents
    : tc.twoTierEnabled
    ? (tc.tier1TariffIdrPerKWh ?? assumptions.revenue.baseTariffIdrPerKWh)
    : assumptions.revenue.baseTariffIdrPerKWh;

  const activeBaseCUsd = (activeBaseTariff / fx) * 100;

  const levelizedDiscountRate = (tc.levelizedDiscountRatePct ?? 6.0) / 100;
  let pvRevIdr = 0;
  let pvGenKwh = 0;
  for (const r of annualRows) {
    const df = Math.pow(1 + levelizedDiscountRate, r.year);
    pvRevIdr += (r.revenueIdrBillion * 1e9) / df;
    pvGenKwh += r.netGenerationKWh / df;
  }
  const levelizedTariffIdr = pvGenKwh > 0 ? pvRevIdr / pvGenKwh : 0;
  const levelizedTariffUsdCents = (levelizedTariffIdr / fx) * 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">
              Electricity Generation & Revenue Model
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hydrological energy dispatch, plant availability, auxiliary/transmission losses, and PPA tariff structure.
          </p>
        </div>

        <button
          data-audit-key="net_generation"
          onClick={() => onOpenAuditTrace('net_generation')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Audit Generation Formula</span>
        </button>
      </div>

      {/* Generation Formula Explainer */}
      <div className="bg-slate-900 text-white rounded-lg p-4 border border-slate-800 text-xs font-mono">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
          Hydropower Net Generation Calculation Architecture:
        </div>
        <div className="text-emerald-400 font-semibold mb-1">
          Gross Gen = Installed Capacity ({assumptions.project.installedCapacityMW} MW) × 8,760 hrs × CF ({assumptions.operating.capacityFactorPct}%) × Availability ({assumptions.operating.plantAvailabilityPct}%)
        </div>
        <div className="text-sky-300">
          Net Gen = Gross Gen × (1 - Aux Loss {assumptions.operating.auxiliaryConsumptionPct}%) × (1 - Trans Loss {assumptions.operating.transmissionLossPct}%) × (1 - Degradation)^(Year - 1)
        </div>
      </div>

      {/* PPA Multi-Component Tariff Framework (PLN PJBL Standard Architecture) */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-5 py-3 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">
                PPA Multi-Component Tariff Framework (PLN PJBL Hydro Benchmark)
              </h3>
              <p className="text-[11px] text-slate-300 font-normal">
                Standard Indonesian PPA splits tariff into Capital Recovery (A), Fixed O&M (B), Water Levy (C), and Variable O&M (D).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition">
              <input
                type="checkbox"
                checked={tc.useComponents}
                onChange={(e) => toggleUseComponents(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-white font-semibold">
                {tc.useComponents ? 'Component Mode (A, B, C, D) Active' : 'Enable Component Breakdown (A, B, C, D)'}
              </span>
            </label>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {tc.useComponents ? (
            <>
              {/* Component Summary Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                    <span className="text-slate-600">Comp A:</span>
                    <span className="font-bold text-slate-900">{tc.componentA_CapitalRecoveryIdrPerKWh.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({((tc.componentA_CapitalRecoveryIdrPerKWh / (totalBaseFromComponents || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                    <span className="text-slate-600">Comp B:</span>
                    <span className="font-bold text-slate-900">{tc.componentB_FixedOpexIdrPerKWh.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({((tc.componentB_FixedOpexIdrPerKWh / (totalBaseFromComponents || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-600 inline-block"></span>
                    <span className="text-slate-600">Comp C:</span>
                    <span className="font-bold text-slate-900">{tc.componentC_WaterLevyIdrPerKWh.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({((tc.componentC_WaterLevyIdrPerKWh / (totalBaseFromComponents || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-600 inline-block"></span>
                    <span className="text-slate-600">Comp D:</span>
                    <span className="font-bold text-slate-900">{tc.componentD_VariableOpexIdrPerKWh.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({((tc.componentD_VariableOpexIdrPerKWh / (totalBaseFromComponents || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span>
                    <span className="text-slate-600">Comp E:</span>
                    <span className="font-bold text-slate-900">{(tc.componentE_TaxAdjustmentIdrPerKWh ?? 0).toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">
                      ({(((tc.componentE_TaxAdjustmentIdrPerKWh ?? 0) / (totalBaseFromComponents || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div className="text-[11px] text-slate-500">
                    Total Base Tariff (Yr 1):
                  </div>
                  <div className="text-base font-black text-blue-700 font-mono">
                    Rp {totalBaseFromComponents.toFixed(1)} / kWh
                  </div>
                  <div className="text-xs font-bold text-slate-600 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {activeBaseCUsd.toFixed(2)} ¢USD/kWh
                  </div>
                </div>
              </div>

              {/* 5 Cards Grid for Components A, B, C, D, E */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
                {/* Component A Card */}
                <div className="bg-white border-2 border-blue-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px]">Comp A</span>
                      <span>Capital Recovery</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Capex debt service principal & interest + sponsor equity return (ROE).
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Base Rate (IDR / kWh)
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={tc.componentA_CapitalRecoveryIdrPerKWh}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentA_CapitalRecoveryIdrPerKWh: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-blue-50/50 border border-blue-300 font-mono font-bold text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Escalation Rate (% p.a.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tc.componentAEscalationPct ?? 0}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentAEscalationPct: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:outline-blue-500"
                        title="Typically 0% in standard PLN PJBL as capital recovery is non-escalating"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tc.componentADegressionAfterLoan ?? true}
                          onChange={(e) =>
                            updateTariffComponents({
                              componentADegressionAfterLoan: e.target.checked,
                            })
                          }
                          className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-medium text-slate-700">
                          Post-Debt Degression
                        </span>
                      </label>
                      {tc.componentADegressionAfterLoan && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Reduction:</span>
                          <input
                            type="number"
                            step="5"
                            min="0"
                            max="100"
                            value={tc.componentADegressionPct ?? 50}
                            onChange={(e) =>
                              updateTariffComponents({
                                componentADegressionPct: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 font-mono font-bold text-center text-xs"
                          />
                          <span className="text-[10px] font-bold text-slate-600">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Component B Card */}
                <div className="bg-white border-2 border-emerald-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px]">Comp B</span>
                      <span>Fixed O&M Charge</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Fixed operations, routine maintenance, head office overhead, staff & insurance.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Base Rate (IDR / kWh)
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={tc.componentB_FixedOpexIdrPerKWh}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentB_FixedOpexIdrPerKWh: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-emerald-50/50 border border-emerald-300 font-mono font-bold text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Inflation Escalation (% p.a.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tc.componentBEscalationPct ?? 2.5}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentBEscalationPct: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                      Linked to Indonesian CPI / US CPI basket escalation index.
                    </div>
                  </div>
                </div>

                {/* Component C Card */}
                <div className="bg-white border-2 border-cyan-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-cyan-900 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-cyan-600 text-white text-[11px]">Comp C</span>
                      <span>{currentTechMeta.componentCLabel.replace('Component C: ', '')}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {currentTech === 'hydro'
                      ? 'Statutory water resource management fee (Biaya Jasa Pengelolaan SDA).'
                      : currentTech === 'solar_pv'
                      ? 'Concession lease fee for water body surface anchoring and land plot rights.'
                      : currentTech === 'geothermal'
                      ? 'Steam field resource royalty / PNBP Panas Bumi under statutory concessions.'
                      : currentTech === 'waste_to_energy'
                      ? 'Bottom & fly ash disposal, flue gas consumable reagents, and environmental levy.'
                      : currentTech === 'thermal'
                      ? 'Calorific fuel cost pass-through adjustment and statutory carbon emissions tax.'
                      : 'Statutory natural resource fee / sovereign concession royalty charge.'}
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Base Rate (IDR / kWh)
                      </label>
                      <input
                        type="number"
                        step="5"
                        value={tc.componentC_WaterLevyIdrPerKWh}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentC_WaterLevyIdrPerKWh: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-cyan-50/50 border border-cyan-300 font-mono font-bold text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Escalation Rate (% p.a.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tc.componentCEscalationPct ?? 2.0}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentCEscalationPct: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                      Hydro-specific pass-through levy paid to River Basin Authority (BWS/PJT).
                    </div>
                  </div>
                </div>

                {/* Component D Card */}
                <div className="bg-white border-2 border-amber-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px]">Comp D</span>
                      <span>Variable O&M Charge</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Consumables, lubrication, wear parts, and generation dispatch costs.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Base Rate (IDR / kWh)
                      </label>
                      <input
                        type="number"
                        step="5"
                        value={tc.componentD_VariableOpexIdrPerKWh}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentD_VariableOpexIdrPerKWh: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-amber-50/50 border border-amber-300 font-mono font-bold text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Escalation Rate (% p.a.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tc.componentDEscalationPct ?? 2.0}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentDEscalationPct: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                      Variable charge invoiced directly based on net energy export (MWh).
                    </div>
                  </div>
                </div>

                {/* Component E Card */}
                <div className="bg-white border-2 border-purple-200 rounded-lg p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-[11px]">Comp E</span>
                      <span>Tax / Fiscal Adj</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Fiscal & corporate income tax adjustment or government levy pass-through.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Base Rate (IDR / kWh)
                      </label>
                      <input
                        type="number"
                        step="5"
                        value={tc.componentE_TaxAdjustmentIdrPerKWh ?? 0}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentE_TaxAdjustmentIdrPerKWh: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-purple-50/50 border border-purple-300 font-mono font-bold text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Escalation Rate (% p.a.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tc.componentEEscalationPct ?? 0}
                        onChange={(e) =>
                          updateTariffComponents({
                            componentEEscalationPct: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2.5 py-1 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 focus:outline-blue-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tc.componentEDegressionAfterLoan ?? false}
                          onChange={(e) =>
                            updateTariffComponents({
                              componentEDegressionAfterLoan: e.target.checked,
                            })
                          }
                          className="w-3.5 h-3.5 rounded text-purple-600 cursor-pointer"
                        />
                        <span className="text-[11px] font-medium text-slate-700">
                          Post-Debt Degression
                        </span>
                      </label>
                      {tc.componentEDegressionAfterLoan && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Reduction:</span>
                          <input
                            type="number"
                            step="5"
                            min="0"
                            max="100"
                            value={tc.componentEDegressionPct ?? 0}
                            onChange={(e) =>
                              updateTariffComponents({
                                componentEDegressionPct: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-16 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 font-mono font-bold text-center text-xs"
                          />
                          <span className="text-[10px] font-bold text-slate-600">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>Standard Monolithic Tariff Model Active</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                    Rp {assumptions.revenue.baseTariffIdrPerKWh.toLocaleString()} / kWh ({((assumptions.revenue.baseTariffIdrPerKWh / fx) * 100).toFixed(2)} ¢USD/kWh)
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  All revenues are escalated at uniform {assumptions.revenue.annualTariffEscalationPct}% p.a. Switch on Multi-Component Tariff to simulate the authentic PLN PPA (Components A, B, C, D) structure with independent escalations and post-debt degression.
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleUseComponents(true)}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Sliders className="w-4 h-4" />
                Activate Component Tariff (A, B, C, D)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Levelized Tariff & Two-Tier PPA Pricing Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dynamic Levelized Tariff Banner */}
        <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-lg p-5 shadow-xs border border-blue-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Institutional Levelized Tariff (NPV-Weighted)
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
              <span>Discount Rate:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={tc.levelizedDiscountRatePct ?? 6.0}
                onChange={(e) =>
                  updateTariffComponents({
                    levelizedDiscountRatePct: parseFloat(e.target.value) || 6.0,
                  })
                }
                className="w-14 px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-600 text-center font-bold text-emerald-300 text-xs"
              />
              <span>%</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between pt-1 border-t border-blue-800/60">
            <div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                Rp {levelizedTariffIdr.toFixed(1)}{' '}
                <span className="text-xs text-slate-300 font-normal">/ kWh</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                NPV of Lifecycle Revenues ÷ NPV of Lifetime Generation
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold text-sky-300 font-mono">
                {levelizedTariffUsdCents.toFixed(2)} ¢
                <span className="text-xs text-slate-400 font-normal"> USD/kWh</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                (${(levelizedTariffIdr / fx).toFixed(4)} / kWh)
              </div>
            </div>
          </div>
        </div>

        {/* Two-Tier Stepped Tariff Structure (Stage I / Stage II) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Two-Tier Stepped Tariff (Stage I / Stage II)
              </h3>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={tc.twoTierEnabled ?? false}
                onChange={(e) => updateTariffComponents({ twoTierEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <span className="text-slate-800 font-semibold text-[11px]">
                {tc.twoTierEnabled ? 'Stepped Active' : 'Enable Stepped PPA'}
              </span>
            </label>
          </div>

          <p className="text-[11px] text-slate-500">
            Two-stage tariff pricing: Higher tariff during loan life (Tier 1), stepping down after debt maturity (Tier 2).
          </p>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-2 rounded bg-slate-50 border border-slate-200">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Tier 1 Years
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max={assumptions.project.operatingPeriodYears}
                disabled={!tc.twoTierEnabled}
                value={tc.tier1DurationYears ?? 12}
                onChange={(e) =>
                  updateTariffComponents({ tier1DurationYears: parseInt(e.target.value) || 12 })
                }
                className="w-full px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-center font-bold text-xs disabled:opacity-50"
              />
            </div>
            <div className="p-2 rounded bg-blue-50/50 border border-blue-200">
              <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">
                Tier 1 Tariff (IDR)
              </label>
              <input
                type="number"
                step="25"
                disabled={!tc.twoTierEnabled}
                value={tc.tier1TariffIdrPerKWh ?? 1460}
                onChange={(e) =>
                  updateTariffComponents({ tier1TariffIdrPerKWh: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-2 py-0.5 rounded bg-white border border-blue-300 font-mono text-center font-bold text-xs text-blue-900 disabled:opacity-50"
              />
            </div>
            <div className="p-2 rounded bg-amber-50/50 border border-amber-200">
              <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">
                Tier 2 Tariff (IDR)
              </label>
              <input
                type="number"
                step="25"
                disabled={!tc.twoTierEnabled}
                value={tc.tier2TariffIdrPerKWh ?? 1020}
                onChange={(e) =>
                  updateTariffComponents({ tier2TariffIdrPerKWh: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-2 py-0.5 rounded bg-white border border-amber-300 font-mono text-center font-bold text-xs text-amber-900 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 30-Year Detailed Generation & Revenue Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap justify-between items-center gap-3 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span>Annual Electricity Generation & Commercial Revenue Schedule</span>
            <span className="text-[10px] text-slate-400 font-mono normal-case">
              (Concession: {assumptions.project.operatingPeriodYears} Years)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowComponentCols(!showComponentCols)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                showComponentCols
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {showComponentCols ? 'Hide Component Details' : 'Show Component A/B/C/D/E Columns'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-20 text-[11px]">
              <tr>
                <th className="text-center py-2.5 px-3 sticky left-0 bg-slate-100 z-30 finmod-sticky-col">Year</th>
                <th className="text-right py-2.5 px-3">Gross Gen (GWh)</th>
                <th className="text-right py-2.5 px-3">Net Gen (GWh)</th>
                {showComponentCols && (
                  <>
                    <th className="text-right py-2.5 px-2 text-blue-700">Comp A (IDR)</th>
                    <th className="text-right py-2.5 px-2 text-emerald-700">Comp B (IDR)</th>
                    <th className="text-right py-2.5 px-2 text-cyan-700">Comp C (IDR)</th>
                    <th className="text-right py-2.5 px-2 text-amber-700">Comp D (IDR)</th>
                    <th className="text-right py-2.5 px-2 text-purple-700">Comp E (IDR)</th>
                  </>
                )}
                <th className="text-right py-2.5 px-3">Total Tariff (IDR/kWh)</th>
                <th className="text-right py-2.5 px-3">Tariff (cUSD)</th>
                {currentTech === 'waste_to_energy' && (
                  <>
                    <th className="text-right py-2.5 px-3 text-emerald-700">Power Rev (IDR B)</th>
                    <th className="text-right py-2.5 px-3 text-teal-700">Tipping Fee (IDR B)</th>
                  </>
                )}
                <th className="text-right py-2.5 px-3">Revenue (IDR B)</th>
                <th className="text-right py-2.5 px-3">Revenue (USD M)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {annualRows.map((row) => (
                <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800 sticky left-0 bg-white z-10 finmod-sticky-col">
                    Yr {row.year}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">
                    {row.grossGenerationGWh.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                    {row.netGenerationGWh.toFixed(3)}
                  </td>
                  {showComponentCols && (
                    <>
                      <td className="py-2.5 px-2 text-right text-blue-800 font-semibold">
                        {row.tariffComponentAIdr !== undefined ? row.tariffComponentAIdr.toFixed(1) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-emerald-800 font-semibold">
                        {row.tariffComponentBIdr !== undefined ? row.tariffComponentBIdr.toFixed(1) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-cyan-800 font-semibold">
                        {row.tariffComponentCIdr !== undefined ? row.tariffComponentCIdr.toFixed(1) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-amber-800 font-semibold">
                        {row.tariffComponentDIdr !== undefined ? row.tariffComponentDIdr.toFixed(1) : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-purple-800 font-semibold">
                        {row.tariffComponentEIdr !== undefined ? row.tariffComponentEIdr.toFixed(1) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right text-slate-900 font-bold">
                    {row.tariffIdrPerKWh.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {(row.tariffUsdPerKWh * 100).toFixed(2)} ¢
                  </td>
                  {currentTech === 'waste_to_energy' && (
                    <>
                      <td className="py-2.5 px-3 text-right text-emerald-700">
                        {(row.electricityRevenueIdrBillion ?? row.revenueIdrBillion).toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-teal-700">
                        {(row.wteTippingFeeRevenueIdrBillion ?? 0).toFixed(3)}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-700 text-sm">
                    {row.revenueIdrBillion.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700">
                    ${row.revenueUsdMillion.toFixed(2)} M
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 font-mono text-xs">
              <tr>
                <td className="py-2.5 px-3 text-center sticky left-0 bg-slate-100 z-10 finmod-sticky-col">30-Yr Total</td>
                <td className="py-2.5 px-3 text-right">
                  {annualRows.reduce((s, r) => s + r.grossGenerationGWh, 0).toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right text-blue-700">
                  {annualRows.reduce((s, r) => s + r.netGenerationGWh, 0).toFixed(1)}
                </td>
                {showComponentCols && (
                  <td colSpan={5} className="py-2.5 px-2 text-center text-slate-500 font-sans text-[11px]">
                    {tc.useComponents ? 'Independent Component Escalation Architecture' : 'Proportional Component Weighting'}
                  </td>
                )}
                <td colSpan={2} className="py-2.5 px-3 text-center text-slate-500 font-sans text-[11px]">
                  Avg Tariff: {(annualRows.reduce((s, r) => s + r.tariffIdrPerKWh, 0) / (annualRows.length || 1)).toFixed(1)} IDR
                </td>
                {currentTech === 'waste_to_energy' && (
                  <>
                    <td className="py-2.5 px-3 text-right text-emerald-700">
                      {annualRows.reduce((s, r) => s + (r.electricityRevenueIdrBillion ?? r.revenueIdrBillion), 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-teal-700">
                      {annualRows.reduce((s, r) => s + (r.wteTippingFeeRevenueIdrBillion ?? 0), 0).toFixed(2)}
                    </td>
                  </>
                )}
                <td className="py-2.5 px-3 text-right text-emerald-700 text-sm">
                  {annualRows.reduce((s, r) => s + r.revenueIdrBillion, 0).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  ${annualRows.reduce((s, r) => s + r.revenueUsdMillion, 0).toFixed(2)} M
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

