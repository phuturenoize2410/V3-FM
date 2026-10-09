import React from 'react';
import { FullModelAssumptions, TechnologyType } from '../../types';
import { TECHNOLOGY_REGISTRY } from '../../calculations/defaultAssumptions';
import {
  Sliders,
  HelpCircle,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface AssumptionsTabProps {
  assumptions: FullModelAssumptions;
  onUpdateAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onChangeAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onResetBase?: () => void;
  onResetDefaults?: () => void;
  onOpenAuditTrace?: (key: string) => void;
}

export const AssumptionsTab: React.FC<AssumptionsTabProps> = ({
  assumptions,
  onUpdateAssumptions,
  onChangeAssumptions,
  onResetBase,
  onResetDefaults,
  onOpenAuditTrace,
}) => {
  const safeUpdate = (newAssumptions: FullModelAssumptions) => {
    if (typeof onUpdateAssumptions === 'function') {
      onUpdateAssumptions(newAssumptions);
    } else if (typeof onChangeAssumptions === 'function') {
      onChangeAssumptions(newAssumptions);
    }
  };

  const handleReset = () => {
    if (typeof onResetBase === 'function') {
      onResetBase();
    } else if (typeof onResetDefaults === 'function') {
      onResetDefaults();
    }
  };

  const updateProject = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      project: { ...assumptions.project, [field]: val },
    });
  };

  const updateOperating = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      operating: { ...assumptions.operating, [field]: val },
    });
  };

  const updateRevenue = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      revenue: { ...assumptions.revenue, [field]: val },
    });
  };

  const updateFunding = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      funding: { ...assumptions.funding, [field]: val },
    });
  };

  const updateTax = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      tax: { ...assumptions.tax, [field]: val },
    });
  };

  const updateValuation = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      valuation: { ...assumptions.valuation, [field]: val },
    });
  };

  const updateOpex = (field: string, val: any) => {
    safeUpdate({
      ...assumptions,
      opex: { ...assumptions.opex, [field]: val },
    });
  };

  const totalCapexBase = assumptions.capexItems.reduce((s, i) => s + i.amountIdrBillion, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with Model Assumption Guidance */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Project Finance Assumptions Matrix</h2>
            <p className="text-xs text-slate-500">
              Yellow highlighted inputs are editable. All formulas recalculate dynamically without circular references.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
            Input Cell
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block" />
            Calculated Cell
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Initial Case
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Category 1: PROJECT & CONSORTIUM */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>1. Project & Asset Class</span>
            <span className="text-[10px] text-sky-400 font-mono font-normal">
              {TECHNOLOGY_REGISTRY[assumptions.project.technology || 'hydro']?.icon}{' '}
              {TECHNOLOGY_REGISTRY[assumptions.project.technology || 'hydro']?.label.split(' ')[0]}
            </span>
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Energy Asset Class</label>
              <select
                value={assumptions.project.technology || 'hydro'}
                onChange={(e) => updateProject('technology', e.target.value as TechnologyType)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-bold focus:outline-blue-500 focus:bg-white cursor-pointer"
              >
                {(Object.keys(TECHNOLOGY_REGISTRY) as TechnologyType[]).map((t) => (
                  <option key={t} value={t}>
                    {TECHNOLOGY_REGISTRY[t].icon} {TECHNOLOGY_REGISTRY[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Project Name</label>
              <input
                type="text"
                value={assumptions.project.projectName}
                onChange={(e) => updateProject('projectName', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Capacity (MW)</label>
                <input
                  type="number"
                  step="0.5"
                  value={assumptions.project.installedCapacityMW}
                  onChange={(e) => updateProject('installedCapacityMW', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Turbine Units</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.project.numberOfUnits}
                  onChange={(e) => updateProject('numberOfUnits', parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Construction Start</label>
                <input
                  type="date"
                  value={assumptions.project.constructionStartDate}
                  onChange={(e) => updateProject('constructionStartDate', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Commercial COD</label>
                <input
                  type="date"
                  value={assumptions.project.codDate}
                  onChange={(e) => updateProject('codDate', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Construction (Mo)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.project.constructionPeriodMonths}
                  onChange={(e) => updateProject('constructionPeriodMonths', parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Concession (Yrs)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.project.operatingPeriodYears}
                  onChange={(e) => updateProject('operatingPeriodYears', parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Consortium share */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Consortium Shareholding
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">EPN Share (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={assumptions.project.epnParticipationPct}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      safeUpdate({
                        ...assumptions,
                        project: {
                          ...assumptions.project,
                          epnParticipationPct: val,
                          otherSponsorParticipationPct: Math.max(0, 100 - val),
                        },
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Other Partners (%)</label>
                  <input
                    type="number"
                    disabled
                    value={assumptions.project.otherSponsorParticipationPct}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Major Overhaul / Sustaining CAPEX */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Major Overhaul / Capex
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-blue-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={assumptions.project.majorOverhaul?.enabled ?? false}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const existing = assumptions.project.majorOverhaul || {
                        enabled: false,
                        year: 15,
                        amountIdrBillion: 5.0,
                        depreciationYears: 10,
                      };
                      updateProject('majorOverhaul', { ...existing, enabled });
                    }}
                    className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                  />
                  <span>Enable Overhaul</span>
                </label>
              </div>

              {assumptions.project.majorOverhaul?.enabled && (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-medium mb-1">Overhaul Yr</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max={assumptions.project.operatingPeriodYears}
                      value={assumptions.project.majorOverhaul.year}
                      onChange={(e) =>
                        updateProject('majorOverhaul', {
                          ...assumptions.project.majorOverhaul,
                          year: parseInt(e.target.value) || 15,
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-medium mb-1">Amount (IDR B)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={assumptions.project.majorOverhaul.amountIdrBillion}
                      onChange={(e) =>
                        updateProject('majorOverhaul', {
                          ...assumptions.project.majorOverhaul,
                          amountIdrBillion: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-medium mb-1">Depr (Yrs)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={assumptions.project.majorOverhaul.depreciationYears}
                      onChange={(e) =>
                        updateProject('majorOverhaul', {
                          ...assumptions.project.majorOverhaul,
                          depreciationYears: parseInt(e.target.value) || 10,
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category 2: OPERATING & GENERATION */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>2. Generation & Technical</span>
            <span className="text-[10px] text-sky-400 font-mono font-normal">
              {TECHNOLOGY_REGISTRY[assumptions.project.technology || 'hydro']?.generationBasis}
            </span>
          </div>
          <div className="p-4 space-y-3 text-xs">
            {/* Technology-Specific Parameters */}
            {assumptions.project.technology === 'solar_pv' && (
              <div className="bg-sky-50/60 p-2.5 rounded border border-sky-200 space-y-2">
                <div className="font-bold text-sky-900 text-[11px]">Solar Resource Parameters</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-medium text-[10px] mb-1">Peak Sun Hours (PSH)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={assumptions.operating.solarPeakSunHoursPerDay ?? 4.5}
                      onChange={(e) => updateOperating('solarPeakSunHoursPerDay', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded bg-white border border-sky-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium text-[10px] mb-1">Specific Yield (kWh/kWp)</label>
                    <input
                      type="number"
                      step="10"
                      value={assumptions.operating.solarSpecificYieldKWhPerKWp ?? 1550}
                      onChange={(e) => updateOperating('solarSpecificYieldKWhPerKWp', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded bg-white border border-sky-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {assumptions.project.technology === 'waste_to_energy' && (
              <div className="bg-emerald-50/60 p-2.5 rounded border border-emerald-200 space-y-2">
                <div className="font-bold text-emerald-900 text-[11px]">Waste Feedstock & Tipping Fee</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-medium text-[10px] mb-1">Throughput (Tons/day)</label>
                    <input
                      type="number"
                      step="50"
                      value={assumptions.operating.wteWasteThroughputTonsPerDay ?? 1000}
                      onChange={(e) => updateOperating('wteWasteThroughputTonsPerDay', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded bg-white border border-emerald-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium text-[10px] mb-1">Yield (kWh / Ton)</label>
                    <input
                      type="number"
                      step="10"
                      value={assumptions.operating.wteKWhPerTonWaste ?? 380}
                      onChange={(e) => updateOperating('wteKWhPerTonWaste', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded bg-white border border-emerald-300 text-slate-900 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-600 font-medium">Capacity Factor (%)</label>
                <span className="text-[11px] text-blue-600 font-medium">Base Dispatch</span>
              </div>
              <input
                type="number"
                step="0.5"
                value={assumptions.operating.capacityFactorPct}
                onChange={(e) => updateOperating('capacityFactorPct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Plant Availability (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.operating.plantAvailabilityPct}
                  onChange={(e) => updateOperating('plantAvailabilityPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Transmission Loss (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.operating.transmissionLossPct}
                  onChange={(e) => updateOperating('transmissionLossPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Auxiliary Power (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.operating.auxiliaryConsumptionPct}
                  onChange={(e) => updateOperating('auxiliaryConsumptionPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Annual Degradation (%)</label>
                <input
                  type="number"
                  step="0.05"
                  value={assumptions.operating.annualDegradationPct}
                  onChange={(e) => updateOperating('annualDegradationPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Annual OPEX Escalation (%)</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.operating.annualOpexEscalationPct}
                onChange={(e) => updateOperating('annualOpexEscalationPct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Category 3: REVENUE & TARIFF */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex justify-between items-center">
            <span>3. Tariff & Commercial</span>
            {assumptions.revenue.tariffComponents?.useComponents && (
              <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded font-normal text-white">
                Comp A/B/C/D Active
              </span>
            )}
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-600 font-medium">Base Tariff (IDR / kWh)</label>
                {assumptions.revenue.tariffComponents?.useComponents && (
                  <span className="text-[10px] text-blue-600 font-medium">
                    Calculated from A+B+C+D
                  </span>
                )}
              </div>
              <input
                type="number"
                step="10"
                value={assumptions.revenue.baseTariffIdrPerKWh}
                onChange={(e) => updateRevenue('baseTariffIdrPerKWh', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">FX Rate (IDR / USD)</label>
                <input
                  type="number"
                  step="100"
                  value={assumptions.revenue.fxIdrPerUsd}
                  onChange={(e) => updateRevenue('fxIdrPerUsd', parseFloat(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Equivalent (cUSD/kWh)</label>
                <input
                  type="text"
                  disabled
                  value={((assumptions.revenue.baseTariffIdrPerKWh / assumptions.revenue.fxIdrPerUsd) * 100).toFixed(2) + ' ¢/kWh'}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Annual Tariff Escalation (%)</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.revenue.annualTariffEscalationPct}
                onChange={(e) => updateRevenue('annualTariffEscalationPct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>

            {/* Levelized Discount Rate */}
            <div>
              <label className="block text-slate-600 font-medium mb-1">Levelized Discount Rate (% p.a.)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={assumptions.revenue.tariffComponents?.levelizedDiscountRatePct ?? 6.0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 6.0;
                  const existing = assumptions.revenue.tariffComponents || {
                    useComponents: false,
                    componentA_CapitalRecoveryIdrPerKWh: 850,
                    componentB_FixedOpexIdrPerKWh: 230,
                    componentC_WaterLevyIdrPerKWh: 70,
                    componentD_VariableOpexIdrPerKWh: 100,
                    componentAEscalationPct: 0,
                    componentBEscalationPct: 2.5,
                    componentCEscalationPct: 2.0,
                    componentDEscalationPct: 2.0,
                  };
                  updateRevenue('tariffComponents', { ...existing, levelizedDiscountRatePct: val });
                }}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>

            {/* Two-Tier Stepped Tariff Settings */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Two-Tier Stepped Tariff
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-blue-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={assumptions.revenue.tariffComponents?.twoTierEnabled ?? false}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const existing = assumptions.revenue.tariffComponents || {
                        useComponents: false,
                        componentA_CapitalRecoveryIdrPerKWh: 850,
                        componentB_FixedOpexIdrPerKWh: 230,
                        componentC_WaterLevyIdrPerKWh: 70,
                        componentD_VariableOpexIdrPerKWh: 100,
                        componentAEscalationPct: 0,
                        componentBEscalationPct: 2.5,
                        componentCEscalationPct: 2.0,
                        componentDEscalationPct: 2.0,
                      };
                      updateRevenue('tariffComponents', {
                        ...existing,
                        twoTierEnabled: enabled,
                        tier1DurationYears: existing.tier1DurationYears ?? 12,
                        tier1TariffIdrPerKWh: existing.tier1TariffIdrPerKWh ?? assumptions.revenue.baseTariffIdrPerKWh,
                        tier2TariffIdrPerKWh: existing.tier2TariffIdrPerKWh ?? assumptions.revenue.baseTariffIdrPerKWh * 0.7,
                      });
                    }}
                    className="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer"
                  />
                  <span>Enable Stepped PPA</span>
                </label>
              </div>

              {assumptions.revenue.tariffComponents?.twoTierEnabled && (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-medium mb-1">Tier 1 Yrs</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max={assumptions.project.operatingPeriodYears}
                      value={assumptions.revenue.tariffComponents.tier1DurationYears ?? 12}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 12;
                        updateRevenue('tariffComponents', {
                          ...assumptions.revenue.tariffComponents,
                          tier1DurationYears: val,
                        });
                      }}
                      className="w-full px-1.5 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-mono text-xs font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-medium mb-1">Tier 1 Tariff</label>
                    <input
                      type="number"
                      step="25"
                      value={assumptions.revenue.tariffComponents.tier1TariffIdrPerKWh ?? 1460}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateRevenue('tariffComponents', {
                          ...assumptions.revenue.tariffComponents,
                          tier1TariffIdrPerKWh: val,
                        });
                      }}
                      className="w-full px-1.5 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-mono text-xs font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-medium mb-1">Tier 2 Tariff</label>
                    <input
                      type="number"
                      step="25"
                      value={assumptions.revenue.tariffComponents.tier2TariffIdrPerKWh ?? 1020}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateRevenue('tariffComponents', {
                          ...assumptions.revenue.tariffComponents,
                          tier2TariffIdrPerKWh: val,
                        });
                      }}
                      className="w-full px-1.5 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-mono text-xs font-bold text-center"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PPA Multi-Component Tariff Section */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  PPA Tariff Components (A, B, C, D, E)
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-blue-700 font-semibold">
                  <input
                    type="checkbox"
                    checked={assumptions.revenue.tariffComponents?.useComponents ?? false}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      const existingTc = assumptions.revenue.tariffComponents || {
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
                      };
                      const updatedTc = { ...existingTc, useComponents: enabled };
                      const sumComp =
                        updatedTc.componentA_CapitalRecoveryIdrPerKWh +
                        updatedTc.componentB_FixedOpexIdrPerKWh +
                        updatedTc.componentC_WaterLevyIdrPerKWh +
                        updatedTc.componentD_VariableOpexIdrPerKWh +
                        (updatedTc.componentE_TaxAdjustmentIdrPerKWh || 0);
                      safeUpdate({
                        ...assumptions,
                        revenue: {
                          ...assumptions.revenue,
                          baseTariffIdrPerKWh: enabled ? sumComp : assumptions.revenue.baseTariffIdrPerKWh,
                          tariffComponents: updatedTc,
                        },
                      });
                    }}
                    className="w-3.5 h-3.5 rounded text-blue-600"
                  />
                  <span>Enable Component A-E Breakdown</span>
                </label>
              </div>

              {assumptions.revenue.tariffComponents?.useComponents && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium">Comp A (Capital Recovery):</span>
                    <div className="font-mono font-bold text-blue-700">
                      Rp {assumptions.revenue.tariffComponents.componentA_CapitalRecoveryIdrPerKWh} / kWh
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Comp B (Fixed O&M):</span>
                    <div className="font-mono font-bold text-emerald-700">
                      Rp {assumptions.revenue.tariffComponents.componentB_FixedOpexIdrPerKWh} / kWh
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Comp C (Water Levy):</span>
                    <div className="font-mono font-bold text-cyan-700">
                      Rp {assumptions.revenue.tariffComponents.componentC_WaterLevyIdrPerKWh} / kWh
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Comp D (Variable O&M):</span>
                    <div className="font-mono font-bold text-amber-700">
                      Rp {assumptions.revenue.tariffComponents.componentD_VariableOpexIdrPerKWh} / kWh
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 font-medium">Comp E (Tax / Fiscal Adjustment):</span>
                    <div className="font-mono font-bold text-purple-700">
                      Rp {assumptions.revenue.tariffComponents.componentE_TaxAdjustmentIdrPerKWh ?? 0} / kWh
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200/60 text-[11px] text-blue-900">
              Under PLN PPA standard structure, tariffs may be indexed or escalated according to minister decree.
            </div>
          </div>
        </div>

        {/* Category 4: FUNDING & FINANCING */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
            4. Debt Financing & Structure
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Bank Loan (%)</label>
                <input
                  type="number"
                  step="5"
                  value={assumptions.funding.bankDebtPct}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    safeUpdate({
                      ...assumptions,
                      funding: {
                        ...assumptions.funding,
                        bankDebtPct: val,
                        equityPct: Math.max(0, 100 - val - assumptions.funding.shareholderLoanPct),
                      },
                    });
                  }}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Equity (%)</label>
                <input
                  type="number"
                  disabled
                  value={assumptions.funding.equityPct}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Bank Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.funding.bankInterestRatePct}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    safeUpdate({
                      ...assumptions,
                      funding: { ...assumptions.funding, bankInterestRatePct: val },
                      valuation: { ...assumptions.valuation, costOfDebtPreTaxPct: val },
                    });
                  }}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Repayment Tenor (Yrs)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.funding.repaymentPeriodYears}
                  onChange={(e) => updateFunding('repaymentPeriodYears', parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Upfront Fee (%)</label>
                <input
                  type="number"
                  step="0.25"
                  value={assumptions.funding.upfrontFeePct}
                  onChange={(e) => updateFunding('upfrontFeePct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Commitment Fee (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.funding.commitmentFeePct}
                  onChange={(e) => updateFunding('commitmentFeePct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Amortization Type</label>
                <select
                  value={assumptions.funding.amortizationType}
                  onChange={(e) => updateFunding('amortizationType', e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white"
                >
                  <option value="annuity">Annuity (Monthly PMT)</option>
                  <option value="equal_principal">Equal Principal (Linear)</option>
                  <option value="sculpted">Sculpted Amortization</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">IDC Treatment</label>
                <select
                  value={assumptions.funding.idcMode}
                  onChange={(e) => updateFunding('idcMode', e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white font-bold text-blue-700"
                >
                  <option value="capitalized">Capitalized IDC</option>
                  <option value="paid">Paid IDC</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">DSRA Sizing Mode</label>
                <select
                  value={assumptions.funding.dsraMode ?? 'months'}
                  onChange={(e) => updateFunding('dsraMode', e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white"
                >
                  <option value="months">Forward Months</option>
                  <option value="fixed">Fixed Reserve (IDR B)</option>
                </select>
              </div>
              <div>
                {assumptions.funding.dsraMode === 'fixed' ? (
                  <>
                    <label className="block text-slate-600 font-medium mb-1">Fixed DSRA (IDR B)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={assumptions.funding.dsraFixedAmountIdrBillion ?? 2.756}
                      onChange={(e) => updateFunding('dsraFixedAmountIdrBillion', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-slate-600 font-medium mb-1">DSRA Forward Tenor</label>
                    <select
                      value={assumptions.funding.dsraRequirementMonths}
                      onChange={(e) => updateFunding('dsraRequirementMonths', parseInt(e.target.value) || 6)}
                      className="w-full px-2 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-medium focus:outline-blue-500 focus:bg-white"
                    >
                      <option value={3}>3 Months Debt Service</option>
                      <option value={6}>6 Months Debt Service</option>
                      <option value={12}>12 Months Debt Service</option>
                    </select>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Category 5: TAX (CENTRAL ASSUMPTION) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
            5. Tax & Fiscal Parameters
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-900">
              <strong>Single Central Assumption:</strong> Corporate Tax Rate feeds all statements and checks without hardcoding.
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">
                Corporate Income Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={assumptions.tax.corporateIncomeTaxRatePct}
                onChange={(e) => updateTax('corporateIncomeTaxRatePct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-bold text-sm text-emerald-700 focus:outline-blue-500 focus:bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">VAT Rate (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={assumptions.tax.vatRatePct}
                  onChange={(e) => updateTax('vatRatePct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">TLCF Period (Yrs)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.tax.taxLossCarryForwardYears}
                  onChange={(e) => updateTax('taxLossCarryForwardYears', parseInt(e.target.value) || 1)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Withholding Dividends (%)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.tax.withholdingTaxDividendsPct}
                  onChange={(e) => updateTax('withholdingTaxDividendsPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Fiscal Depr Buildings (%)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.tax.fiscalDepreciationRateBuildingsPct}
                  onChange={(e) => updateTax('fiscalDepreciationRateBuildingsPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Category 6: VALUATION & HURDLES */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
            6. Valuation & Cost of Capital
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Cost of Equity (Ke %)</label>
              <input
                type="number"
                step="0.25"
                value={assumptions.valuation.costOfEquityPct}
                onChange={(e) => updateValuation('costOfEquityPct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Risk-Free Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.valuation.riskFreeRatePct}
                  onChange={(e) => updateValuation('riskFreeRatePct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Equity Risk Premium (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assumptions.valuation.equityRiskPremiumPct}
                  onChange={(e) => updateValuation('equityRiskPremiumPct', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Pre-Tax Cost of Debt (%)</label>
              <input
                type="number"
                step="0.1"
                value={assumptions.valuation.costOfDebtPreTaxPct}
                onChange={(e) => updateValuation('costOfDebtPreTaxPct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Category 7: OPERATING EXPENDITURE (OPEX) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
            <span>7. Operating Expenditure (OPEX)</span>
            <span className="text-[10px] text-emerald-400 font-mono font-normal">
              Built-in & Custom Drivers
            </span>
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Fixed O&M (IDR B/yr)</label>
                <input
                  type="number"
                  step="0.25"
                  value={assumptions.opex.fixedOpexIdrBillion}
                  onChange={(e) => updateOpex('fixedOpexIdrBillion', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Variable O&M (IDR/kWh)</label>
                <input
                  type="number"
                  step="1"
                  value={assumptions.opex.variableOpexIdrPerKWh}
                  onChange={(e) => updateOpex('variableOpexIdrPerKWh', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Insurance (% of CAPEX)</label>
                <input
                  type="number"
                  step="0.05"
                  value={assumptions.opex.insurancePctOfCapex}
                  onChange={(e) => updateOpex('insurancePctOfCapex', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Levies / Land (IDR B/yr)</label>
                <input
                  type="number"
                  step="0.2"
                  value={assumptions.opex.landWaterChargesIdrBillion}
                  onChange={(e) => updateOpex('landWaterChargesIdrBillion', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Admin & Staff (IDR B/yr)</label>
                <input
                  type="number"
                  step="0.25"
                  value={assumptions.opex.adminEmployeesIdrBillion}
                  onChange={(e) => updateOpex('adminEmployeesIdrBillion', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Maint. Reserve (IDR B/yr)</label>
                <input
                  type="number"
                  step="0.25"
                  value={assumptions.opex.maintenanceReserveIdrBillion}
                  onChange={(e) => updateOpex('maintenanceReserveIdrBillion', parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Annual OPEX Escalation (% p.a.)</label>
              <input
                type="number"
                step="0.25"
                value={assumptions.operating.annualOpexEscalationPct}
                onChange={(e) => updateOperating('annualOpexEscalationPct', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded bg-amber-50/70 border border-amber-200 text-slate-900 font-mono font-medium focus:outline-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
