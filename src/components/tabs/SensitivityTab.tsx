import React, { useMemo, useState } from 'react';
import { FullModelAssumptions, ModelMetrics, CurrencyDisplay } from '../../types';
import {
  SENSITIVITY_DRIVERS,
  SENSITIVITY_METRICS,
  SensitivityDriverId,
  SensitivityMetricId,
  generateDynamicSensitivityMatrix,
  generateOneWaySensitivity,
} from '../../calculations/sensitivityEngine';
import { formatPercent, formatMultiple } from '../../utils/formatters';
import { Grid, Sliders } from 'lucide-react';

interface SensitivityTabProps {
  assumptions: FullModelAssumptions;
  baseMetrics: ModelMetrics;
  currencyDisplay: CurrencyDisplay;
}

export const SensitivityTab: React.FC<SensitivityTabProps> = ({ assumptions, baseMetrics }) => {
  const [rowDriver, setRowDriver] = useState<SensitivityDriverId>('capacityFactor');
  const [colDriver, setColDriver] = useState<SensitivityDriverId>('capex');
  const [metricTarget, setMetricTarget] = useState<SensitivityMetricId>('equityIrr');
  const [oneWayDriver, setOneWayDriver] = useState<SensitivityDriverId>('capacityFactor');

  const activeMatrix = useMemo(
    () => generateDynamicSensitivityMatrix(assumptions, rowDriver, colDriver, metricTarget),
    [assumptions, rowDriver, colDriver, metricTarget]
  );

  const oneWay = useMemo(
    () => generateOneWaySensitivity(assumptions, oneWayDriver),
    [assumptions, oneWayDriver]
  );

  const metricMeta = SENSITIVITY_METRICS.find((m) => m.id === metricTarget)!;

  const formatValue = (value: number, metric: SensitivityMetricId) => {
    const meta = SENSITIVITY_METRICS.find((m) => m.id === metric)!;
    if (meta.format === 'multiple') return formatMultiple(value, 2);
    if (meta.format === 'pct') return formatPercent(value, 2);
    if (meta.format === 'lcoe') return `${value.toFixed(1)} IDR/kWh`;
    return `${value.toFixed(2)} B`;
  };

  const getCellColor = (value: number) => {
    if (metricTarget === 'minDscr') {
      const covenant = assumptions.funding.covenantDscrBenchmark ?? 1.2;
      if (value >= covenant + 0.2) return 'bg-emerald-100 text-emerald-900';
      if (value >= covenant) return 'bg-amber-50 text-amber-900';
      return 'bg-rose-100 text-rose-900';
    }
    return 'bg-slate-50 text-slate-900';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <Grid className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Dynamic Driver Sensitivity</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Every case starts from the active Master Driver case. Sensitivity shocks are temporary overlays and never overwrite the base assumptions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-slate-600">
            Row Driver
            <select value={rowDriver} onChange={(e) => setRowDriver(e.target.value as SensitivityDriverId)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900">
              {SENSITIVITY_DRIVERS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Column Driver
            <select value={colDriver} onChange={(e) => setColDriver(e.target.value as SensitivityDriverId)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900">
              {SENSITIVITY_DRIVERS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Output Metric
            <select value={metricTarget} onChange={(e) => setMetricTarget(e.target.value as SensitivityMetricId)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900">
              {SENSITIVITY_METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 overflow-x-auto">
        <h3 className="text-sm font-bold text-slate-900 mb-1">
          {activeMatrix.rowDriver.label} vs {activeMatrix.colDriver.label} — {metricMeta.label}
        </h3>
        <p className="text-xs text-slate-500 mb-4">Base case is the intersection of the two Base cells.</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-3 bg-slate-900 text-white text-left border border-slate-800">{activeMatrix.rowDriver.label} \\ {activeMatrix.colDriver.label}</th>
              {activeMatrix.colLabels.map((label) => <th key={label} className="p-3 bg-slate-900 text-white text-center border border-slate-800 font-mono">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {activeMatrix.matrix.map((row, r) => (
              <tr key={`${rowDriver}-${r}`}>
                <td className="p-3 bg-slate-100 font-bold border border-slate-200">{activeMatrix.rowLabels[r]}</td>
                {row.map((value, c) => {
                  const isBase = activeMatrix.rowLabels[r] === 'Base' && activeMatrix.colLabels[c] === 'Base';
                  return <td key={c} className={`p-3 text-center font-mono border border-slate-200 ${getCellColor(value)} ${isBase ? 'ring-2 ring-blue-600 ring-inset font-black' : ''}`}>{formatValue(value, metricTarget)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2"><Sliders className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-bold text-slate-900">One-Way Multi-Output Sensitivity</h3></div>
            <p className="text-xs text-slate-500">One driver moves; all core finance outputs recalculate together.</p>
          </div>
          <select value={oneWayDriver} onChange={(e) => setOneWayDriver(e.target.value as SensitivityDriverId)} className="px-3 py-2 border border-slate-300 rounded bg-white text-xs font-semibold">
            {SENSITIVITY_DRIVERS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead><tr>{['Shock','Project IRR','Equity IRR','Min DSCR','Avg DSCR','Min LLCR','Project NPV','Equity NPV','LCOE'].map((h) => <th key={h} className="p-2 bg-slate-900 text-white border border-slate-800 text-right first:text-left">{h}</th>)}</tr></thead>
          <tbody>{oneWay.map((r) => <tr key={r.label} className={r.shock === 0 ? 'font-bold bg-blue-50' : ''}>
            <td className="p-2 border border-slate-200">{r.label}</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{formatPercent(r.projectIrr,2)}</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{formatPercent(r.equityIrr,2)}</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{formatMultiple(r.minDscr,2)}</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{formatMultiple(r.avgDscr,2)}</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{formatMultiple(r.minLlcr,2)}</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{r.projectNpv.toFixed(2)} B</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{r.equityNpv.toFixed(2)} B</td>
            <td className="p-2 border border-slate-200 text-right font-mono">{r.lcoe.toFixed(1)}</td>
          </tr>)}</tbody>
        </table>
        <div className="mt-3 text-[11px] text-slate-500">Current model reference: Equity IRR {baseMetrics.equityIrrPct.toFixed(2)}% • Min DSCR {baseMetrics.minDscr.toFixed(2)}x</div>
      </div>
    </div>
  );
};
