import { WorkingInputEditor } from '../WorkingInputEditor';
import { formatNumber, formatCurrencyValue } from '../../utils/formatters';
import React, { useState } from 'react';
import {
  FullModelAssumptions,
  AnnualOperatingRow,
  CurrencyDisplay,
  CustomOpexItem,
} from '../../types';
import {
  Briefcase,
  ArrowUpRight,
  Plus,
  Edit3,
  Copy,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { CustomOpexModal } from '../opex/CustomOpexModal';
import { TECHNOLOGY_REGISTRY } from '../../calculations/defaultAssumptions';

interface OpexTabProps {
  assumptions: FullModelAssumptions;
  onUpdateAssumptions: (a: FullModelAssumptions) => void;
  annualRows: AnnualOperatingRow[];
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (key: string) => void;
}

export const OpexTab: React.FC<OpexTabProps> = ({
  assumptions,
  onUpdateAssumptions,
  annualRows,
  currencyDisplay,
  onOpenAuditTrace,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomOpexItem | null>(null);

  const fx = assumptions.revenue.fxIdrPerUsd;
  const mult =
    currencyDisplay === 'IDR_B'
      ? 1
      : currencyDisplay === 'IDR_M'
      ? 1000
      : currencyDisplay === 'USD_M'
      ? 1 / (fx / 1000)
      : (1000 / fx) * 1000;

  const unitLabel =
    currencyDisplay === 'IDR_B'
      ? 'IDR Billion'
      : currencyDisplay === 'IDR_M'
      ? 'IDR Million'
      : currencyDisplay === 'USD_M'
      ? 'USD Million'
      : 'USD Thousand';

  const customItems = assumptions.opex.customOpexItems || [];
  const activeCustomItems = customItems.filter((i) => i.active);
  const totalCustomBaseIdrB = activeCustomItems.reduce((s, i) => s + i.amountIdrBillion, 0);
  const total30YrCustomOpex = annualRows.reduce((s, r) => s + (r.customOpex || 0), 0);
  const hasCustomItems = customItems.length > 0;

  // CRUD Handlers for Custom OPEX Items
  const handleSaveCustomItem = (savedItem: CustomOpexItem) => {
    let updated: CustomOpexItem[];
    const exists = customItems.some((i) => i.id === savedItem.id);
    if (exists) {
      updated = customItems.map((i) => (i.id === savedItem.id ? savedItem : i));
    } else {
      updated = [...customItems, savedItem];
    }
    onUpdateAssumptions({
      ...assumptions,
      opex: {
        ...assumptions.opex,
        customOpexItems: updated,
      },
    });
  };

  const handleToggleActive = (id: string) => {
    const updated = customItems.map((i) =>
      i.id === id ? { ...i, active: !i.active } : i
    );
    onUpdateAssumptions({
      ...assumptions,
      opex: {
        ...assumptions.opex,
        customOpexItems: updated,
      },
    });
  };

  const handleDuplicateItem = (item: CustomOpexItem) => {
    const duplicated: CustomOpexItem = {
      ...item,
      id: `opex_custom_${Date.now()}`,
      name: `${item.name} (Copy)`,
    };
    onUpdateAssumptions({
      ...assumptions,
      opex: {
        ...assumptions.opex,
        customOpexItems: [...customItems, duplicated],
      },
    });
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm(`Delete OPEX item "${name}" from model?`)) {
      const updated = customItems.filter((i) => i.id !== id);
      onUpdateAssumptions({
        ...assumptions,
        opex: {
          ...assumptions.opex,
          customOpexItems: updated,
        },
      });
    }
  };

  const updateOpex = (key: keyof FullModelAssumptions['opex'], value: number) => {
    onUpdateAssumptions({
      ...assumptions,
      opex: {
        ...assumptions.opex,
        [key]: value,
      },
    });
  };

  const updateOperating = (key: keyof FullModelAssumptions['operating'], value: number) => {
    onUpdateAssumptions({
      ...assumptions,
      operating: {
        ...assumptions.operating,
        [key]: value,
      },
    });
  };

  const currentTech = assumptions.project.technology || 'hydro';
  const currentTechMeta = TECHNOLOGY_REGISTRY[currentTech] || TECHNOLOGY_REGISTRY.hydro;

  const levyLabel =
    currentTech === 'solar_pv'
      ? 'Surface / Land Lease Charge'
      : currentTech === 'geothermal'
      ? 'Steam Field Exploration & Royalties'
      : currentTech === 'waste_to_energy'
      ? 'Residue & Environmental Handling'
      : currentTech === 'thermal'
      ? 'Ash Disposal & Environmental Levy'
      : 'Water Levy / BJPSDA Retribusi';

  const categoryBadgeColor: Record<string, string> = {
    fixed: 'bg-blue-50 text-blue-800 border-blue-200',
    variable: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    regulatory: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    admin: 'bg-amber-50 text-amber-800 border-amber-200',
    maintenance: 'bg-purple-50 text-purple-800 border-purple-200',
    other: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 text-xs">
      <WorkingInputEditor kind="opex" assumptions={assumptions} onUpdateAssumptions={onUpdateAssumptions} />

      {/* Top Banner with Action Buttons */}
      <div className="bg-[#fffdfa] border border-slate-200 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-950">
              Operating Expenditure (OPEX) & EBITDA Schedule
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Operating expenditure includes 6 standard formula parameters plus <strong>Custom OPEX Items</strong> that can be added and configured dynamically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Custom OPEX Item</span>
          </button>

          <button
            data-audit-key="ebitda"
            onClick={() => onOpenAuditTrace('ebitda')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Audit EBITDA Calculation</span>
          </button>
        </div>
      </div>

      {/* Custom OPEX Register Section */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Custom OPEX Items Register
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
              {activeCustomItems.length} Active / {customItems.length} Total
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-300">
              Base Total: <strong className="text-white">{formatCurrencyValue(totalCustomBaseIdrB, currencyDisplay, fx, 2)}</strong> / yr
            </span>
            <span className="text-slate-300">
              30-Yr Total: <strong className="text-emerald-300">{formatCurrencyValue(total30YrCustomOpex, currencyDisplay, fx, 2)}</strong>
            </span>
          </div>
        </div>

        {hasCustomItems ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Item Name & Notes</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Base Annual Cost</th>
                  <th className="py-2.5 px-3 text-center">Escalation (% p.a.)</th>
                  <th className="py-2.5 px-3 text-center">Operating Period</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      !item.active ? 'opacity-60 bg-slate-50/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.notes && (
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5 line-clamp-1">
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${
                          categoryBadgeColor[item.category] || categoryBadgeColor.other
                        }`}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyValue(item.amountIdrBillion, currencyDisplay, fx, 2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                      {item.escalationPct !== undefined
                        ? `${item.escalationPct.toFixed(2)}% (custom)`
                        : `${assumptions.operating.annualOpexEscalationPct.toFixed(2)}% (default)`}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      Yr {item.startYear ?? 1} - Yr {item.endYear ?? assumptions.project.operatingPeriodYears}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition cursor-pointer ${
                          item.active
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        {item.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          title="Edit Item"
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(item)}
                          title="Duplicate Item"
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          title="Delete Item"
                          className="p-1 rounded hover:bg-rose-100 text-rose-600 hover:text-rose-800 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 border-t border-slate-200 space-y-2">
            <p className="text-slate-500 text-xs">
              No custom OPEX items added yet. Use the button below to add specific operational costs (CSR, security, facility leases, EIA consulting, etc.).
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom OPEX Item Now</span>
            </button>
          </div>
        )}
      </div>

      {assumptions.workingInputs?.opex && (
        <div className="overflow-auto rounded-lg border border-stone-200 bg-[#fffdfa] p-4">
          <h3 className="font-bold text-xs mb-3">Active working cost elements · IDR billion · DRAFT</h3>
          <table className="w-full text-xs text-right">
            <thead>
              <tr>
                <th className="text-left p-2">Line / source</th>
                {annualRows.map((r) => (
                  <th key={r.year} className="p-2">Y{r.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assumptions.workingInputs.opex.lines.map((line) => (
                <tr key={line.id}>
                  <th className="text-left p-2 font-medium">
                    {line.description}
                    <small className="block text-slate-500">{line.id} · {line.sourceReference}</small>
                  </th>
                  {annualRows.map((r) => {
                    const item = r.workingOpexLines?.find((x) => x.id === line.id);
                    return (
                      <td className="p-2 font-mono" key={r.year} data-opex-line={line.id}>
                        {item?.state === 'NOT_APPLICABLE' ? 'Not Applicable' : formatNumber(item?.amount, 2, 'Blocked')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Standard OPEX Formula Register - Interactive & Editable */}
      <div className="bg-[#fffdfa] border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-900">
                Standard OPEX Cost Elements & Baseline Drivers
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
                {currentTechMeta.icon} {currentTechMeta.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Input manual pos-pos biaya operasional standar (Fixed, Variable, Asuransi, Retribusi, Gaji/Admin, Cadangan Pemeliharaan).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600">
              Yr 1 Base OPEX: <strong className="text-slate-950 font-bold">{formatCurrencyValue(annualRows[0]?.totalOpexIdrBillion || 0, currencyDisplay, fx, 2)}</strong>
            </span>
            <span className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Interactive Editor
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-stone-100/80 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="text-left py-2.5 px-4">Cost Element & Scope</th>
                <th className="text-left py-2.5 px-3">Category</th>
                <th className="text-left py-2.5 px-3 min-w-[200px]">Manual Input Value</th>
                <th className="text-right py-2.5 px-3 font-mono">Yr 1 Cost</th>
                <th className="text-right py-2.5 px-4 font-mono">30-Yr Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {/* 1. Fixed O&M */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">Fixed O&M (Operasional Tetap)</div>
                  <div className="text-[11px] text-slate-500">Routine equipment servicing, operations contracts, site facilities.</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${categoryBadgeColor.fixed}`}>
                    Fixed O&M
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.opex.fixedOpexIdrBillion}
                      onChange={(e) => updateOpex('fixedOpexIdrBillion', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">IDR B/yr</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrencyValue(annualRows[0]?.fixedOpex || 0, currencyDisplay, fx, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                  {formatCurrencyValue(annualRows.reduce((s, r) => s + (r.fixedOpex || 0), 0), currencyDisplay, fx, 2)}
                </td>
              </tr>

              {/* 2. Variable O&M */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">Variable O&M (Operasional Variabel)</div>
                  <div className="text-[11px] text-slate-500">Turbine lubricants, chemical reagents, consumables per kWh generated.</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${categoryBadgeColor.variable}`}>
                    Variable O&M
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.opex.variableOpexIdrPerKWh}
                      onChange={(e) => updateOpex('variableOpexIdrPerKWh', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">IDR / kWh</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrencyValue(annualRows[0]?.variableOpex || 0, currencyDisplay, fx, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                  {formatCurrencyValue(annualRows.reduce((s, r) => s + (r.variableOpex || 0), 0), currencyDisplay, fx, 2)}
                </td>
              </tr>

              {/* 3. Plant Insurance */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">Plant Insurance (Asuransi Pembangkit)</div>
                  <div className="text-[11px] text-slate-500">Property damage, machinery breakdown, and CGL policy (% of CAPEX).</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${categoryBadgeColor.other}`}>
                    Insurance
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.opex.insurancePctOfCapex}
                      onChange={(e) => updateOpex('insurancePctOfCapex', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">% of CAPEX</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrencyValue(annualRows[0]?.insurance || 0, currencyDisplay, fx, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                  {formatCurrencyValue(annualRows.reduce((s, r) => s + (r.insurance || 0), 0), currencyDisplay, fx, 2)}
                </td>
              </tr>

              {/* 4. Water / Surface / Resource Levies */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">{levyLabel}</div>
                  <div className="text-[11px] text-slate-500">Regulatory resource concession fee / land & water surface rental.</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${categoryBadgeColor.regulatory}`}>
                    Regulatory
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="0.2"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.opex.landWaterChargesIdrBillion}
                      onChange={(e) => updateOpex('landWaterChargesIdrBillion', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">IDR B/yr</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrencyValue(annualRows[0]?.landWaterCharges || 0, currencyDisplay, fx, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                  {formatCurrencyValue(annualRows.reduce((s, r) => s + (r.landWaterCharges || 0), 0), currencyDisplay, fx, 2)}
                </td>
              </tr>

              {/* 5. Admin & Staff */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">Admin, Staff & Management (Gaji & HR)</div>
                  <div className="text-[11px] text-slate-500">Engineers, plant operators, corporate overhead, accounting, audits.</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${categoryBadgeColor.admin}`}>
                    Admin & HR
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.opex.adminEmployeesIdrBillion}
                      onChange={(e) => updateOpex('adminEmployeesIdrBillion', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">IDR B/yr</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrencyValue(annualRows[0]?.adminEmployees || 0, currencyDisplay, fx, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                  {formatCurrencyValue(annualRows.reduce((s, r) => s + (r.adminEmployees || 0), 0), currencyDisplay, fx, 2)}
                </td>
              </tr>

              {/* 6. Maintenance Reserve */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">Maintenance & Overhaul Reserve (Cadangan)</div>
                  <div className="text-[11px] text-slate-500">Critical spares, runner refurbishments, scheduled mechanical overhaul.</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${categoryBadgeColor.maintenance}`}>
                    Maintenance
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.opex.maintenanceReserveIdrBillion}
                      onChange={(e) => updateOpex('maintenanceReserveIdrBillion', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">IDR B/yr</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                  {formatCurrencyValue(annualRows[0]?.maintenanceReserve || 0, currencyDisplay, fx, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                  {formatCurrencyValue(annualRows.reduce((s, r) => s + (r.maintenanceReserve || 0), 0), currencyDisplay, fx, 2)}
                </td>
              </tr>

              {/* 7. Annual OPEX Escalation */}
              <tr className="hover:bg-amber-50/30 transition-colors bg-stone-50/50">
                <td className="py-2.5 px-4">
                  <div className="font-bold text-slate-900">Annual OPEX Escalation (Eskalasi Biaya Tahunan)</div>
                  <div className="text-[11px] text-slate-500">Compound annual indexation applied to operational costs.</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider bg-slate-100 text-slate-700 border-slate-300">
                    Indexation
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5 max-w-[190px]">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      disabled={!!assumptions.workingInputs?.opex}
                      value={assumptions.operating.annualOpexEscalationPct}
                      onChange={(e) => updateOperating('annualOpexEscalationPct', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-right font-mono font-bold text-xs bg-amber-50/70 border border-amber-300 rounded focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[11px] text-slate-600 font-mono font-semibold whitespace-nowrap">% p.a.</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-500">
                  Yr 1: 1.00x
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-500">
                  Yr 30: {Math.pow(1 + (assumptions.operating.annualOpexEscalationPct || 0) / 100, (assumptions.project.operatingPeriodYears || 30) - 1).toFixed(2)}x
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-100 font-mono font-bold border-t-2 border-slate-300 text-slate-950">
              <tr>
                <td className="py-2.5 px-4 text-left uppercase text-[11px]">
                  Total Built-in OPEX Baseline
                </td>
                <td className="py-2.5 px-3 text-slate-500 text-[10px] uppercase font-sans">
                  6 Core Drivers
                </td>
                <td className="py-2.5 px-3 text-slate-600 text-xs">
                  Escalated at {assumptions.operating.annualOpexEscalationPct}% p.a.
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700">
                  {formatCurrencyValue(
                    (annualRows[0]?.fixedOpex || 0) +
                    (annualRows[0]?.variableOpex || 0) +
                    (annualRows[0]?.insurance || 0) +
                    (annualRows[0]?.landWaterCharges || 0) +
                    (annualRows[0]?.adminEmployees || 0) +
                    (annualRows[0]?.maintenanceReserve || 0),
                    currencyDisplay,
                    fx,
                    2
                  )}
                </td>
                <td className="py-2.5 px-4 text-right text-rose-700">
                  {formatCurrencyValue(
                    annualRows.reduce(
                      (s, r) =>
                        s +
                        (r.fixedOpex || 0) +
                        (r.variableOpex || 0) +
                        (r.insurance || 0) +
                        (r.landWaterCharges || 0) +
                        (r.adminEmployees || 0) +
                        (r.maintenanceReserve || 0),
                      0
                    ),
                    currencyDisplay,
                    fx,
                    2
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 30-Year Detailed Operating Schedule Table */}
      <div className="bg-[#fffdfa] border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
          <span>Detailed Operating Cost Elements & EBITDA Margin (IDR Billion)</span>
          <span>Escalation input: {assumptions.operating.annualOpexEscalationPct}% p.a.</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-center py-2.5 px-2">Year</th>
                <th className="text-right py-2.5 px-3">Revenue</th>
                <th className="text-right py-2.5 px-3">Fixed O&M</th>
                <th className="text-right py-2.5 px-3">Variable O&M</th>
                <th className="text-right py-2.5 px-3">Insurance</th>
                <th className="text-right py-2.5 px-3">
                  {currentTech === 'hydro' ? 'Water Levy (BJPSDA)' : levyLabel}
                </th>
                <th className="text-right py-2.5 px-3">Admin & Staff</th>
                <th className="text-right py-2.5 px-3">Maint. Reserve</th>
                {hasCustomItems && (
                  <th className="text-right py-2.5 px-3 text-purple-700 font-bold bg-purple-50/70">
                    Custom OPEX
                  </th>
                )}
                <th className="text-right py-2.5 px-3 text-rose-700 font-bold">Total OPEX</th>
                <th className="text-right py-2.5 px-3 text-emerald-700 font-bold">EBITDA</th>
                <th className="text-right py-2.5 px-3">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {annualRows.map((row) => (
                <tr key={row.year} className="hover:bg-stone-50/70">
                  <td className="py-2 px-2 text-center font-bold text-slate-800">Yr {row.year}</td>
                  <td className="py-2 px-3 text-right font-medium text-slate-700">{row.revenueIdrBillion.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{assumptions.workingInputs?.opex ? 'Not Applicable' : formatNumber(row.fixedOpex, 2, 'Blocked')}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{assumptions.workingInputs?.opex ? 'Not Applicable' : formatNumber(row.variableOpex, 2, 'Blocked')}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{assumptions.workingInputs?.opex ? 'Not Applicable' : formatNumber(row.insurance, 2, 'Blocked')}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{assumptions.workingInputs?.opex ? 'Not Applicable' : formatNumber(row.landWaterCharges, 2, 'Blocked')}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{assumptions.workingInputs?.opex ? 'Not Applicable' : formatNumber(row.adminEmployees, 2, 'Blocked')}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{assumptions.workingInputs?.opex ? 'Not Applicable' : formatNumber(row.maintenanceReserve, 2, 'Blocked')}</td>
                  {hasCustomItems && (
                    <td className="py-2 px-3 text-right text-purple-800 font-semibold bg-purple-50/30">
                      {(row.customOpex || 0) > 0 ? (row.customOpex || 0).toFixed(2) : '-'}
                    </td>
                  )}
                  <td className="py-2 px-3 text-right font-semibold text-rose-700">{formatNumber(row.totalOpexIdrBillion, 2, 'Blocked')}</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700 text-sm">{row.ebitdaIdrBillion.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">{row.ebitdaMarginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-stone-50 font-bold text-slate-900 border-t border-slate-300 font-mono tabular-nums">
              <tr>
                <td className="py-2.5 px-2 text-center">{annualRows.length}-Yr Total</td>
                <td className="py-2.5 px-3 text-right">{annualRows.reduce((s, r) => s + r.revenueIdrBillion, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{assumptions.workingInputs?.opex ? 'Not Applicable' : annualRows.reduce((s, r) => s + r.fixedOpex, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{assumptions.workingInputs?.opex ? 'Not Applicable' : annualRows.reduce((s, r) => s + r.variableOpex, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{assumptions.workingInputs?.opex ? 'Not Applicable' : annualRows.reduce((s, r) => s + r.insurance, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{assumptions.workingInputs?.opex ? 'Not Applicable' : annualRows.reduce((s, r) => s + r.landWaterCharges, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{assumptions.workingInputs?.opex ? 'Not Applicable' : annualRows.reduce((s, r) => s + r.adminEmployees, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{assumptions.workingInputs?.opex ? 'Not Applicable' : annualRows.reduce((s, r) => s + r.maintenanceReserve, 0).toFixed(2)}</td>
                {hasCustomItems && (
                  <td className="py-2.5 px-3 text-right text-purple-900 font-bold bg-purple-50/50">
                    {total30YrCustomOpex.toFixed(2)}
                  </td>
                )}
                <td className="py-2.5 px-3 text-right text-rose-700">{annualRows.reduce((s, r) => s + r.totalOpexIdrBillion, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right text-emerald-700 text-sm">{annualRows.reduce((s, r) => s + r.ebitdaIdrBillion, 0).toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right">{annualRows.reduce((s, r) => s + r.revenueIdrBillion, 0) === 0 ? 'N/A' : `${((annualRows.reduce((s, r) => s + r.ebitdaIdrBillion, 0) / annualRows.reduce((s, r) => s + r.revenueIdrBillion, 0)) * 100).toFixed(1)}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      <CustomOpexModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveCustomItem}
        initialItem={editingItem}
        defaultEscalationPct={assumptions.operating.annualOpexEscalationPct}
        operatingYears={assumptions.project.operatingPeriodYears}
        currencyDisplay={currencyDisplay}
        fxRate={fx}
      />
    </div>
  );
};
