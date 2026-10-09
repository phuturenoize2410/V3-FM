import React, { useState, useMemo } from 'react';
import {
  FullModelAssumptions,
  MonthlyCapexSchedule,
  CurrencyDisplay,
  CapexItem,
  CapexCategory,
  SpendingCurve,
  DrawdownOrder,
} from '../../types';
import { formatCurrencyValue, formatNumber } from '../../utils/formatters';
import {
  Hammer,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  Edit3,
  Search,
  Filter,
  TrendingUp,
  Layers,
  Building2,
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { CapexItemModal } from '../capex/CapexItemModal';
import { SCurveChart } from '../capex/SCurveChart';
import { BASE_PLTA_ASSUMPTIONS } from '../../calculations/defaultAssumptions';

interface CapexTabProps {
  assumptions: FullModelAssumptions;
  monthlySchedule?: MonthlyCapexSchedule[];
  capexSchedule?: MonthlyCapexSchedule[];
  currencyDisplay: CurrencyDisplay;
  sourcesAndUses?: any;
  onUpdateCapexItem?: (id: string, updates: Partial<CapexItem>) => void;
  onUpdateAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onChangeAssumptions?: (newAssumptions: FullModelAssumptions) => void;
  onChangeDrawdownOrder?: (order: DrawdownOrder) => void;
  onOpenAuditTrace?: (key: string) => void;
}

export const CapexTab: React.FC<CapexTabProps> = ({
  assumptions,
  monthlySchedule,
  capexSchedule,
  currencyDisplay,
  sourcesAndUses,
  onUpdateAssumptions,
  onChangeAssumptions,
  onUpdateCapexItem,
  onChangeDrawdownOrder,
  onOpenAuditTrace,
}) => {
  const [viewMode, setViewMode] = useState<'items' | 'scurve' | 'matrix'>('items');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CapexItem | null>(null);

  const fx = assumptions.revenue.fxIdrPerUsd;
  const schedule = monthlySchedule || capexSchedule || [];
  const { capexItems, project, funding } = assumptions;

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

  const totalBaseCapex = capexItems.reduce((s, i) => s + i.amountIdrBillion, 0);
  const totalScheduleCapex = schedule.reduce((s, m) => s + m.totalCapex, 0);
  const difference = Math.abs(totalBaseCapex - totalScheduleCapex);
  const isValid = difference < 0.001;

  // Safe Assumptions Update
  const safeUpdate = (newAssumptions: FullModelAssumptions) => {
    if (typeof onUpdateAssumptions === 'function') {
      onUpdateAssumptions(newAssumptions);
    } else if (typeof onChangeAssumptions === 'function') {
      onChangeAssumptions(newAssumptions);
    }
  };

  // Quick field updates (inline in table)
  const updateItemField = (id: string, field: keyof CapexItem, val: any) => {
    if (typeof onUpdateCapexItem === 'function') {
      onUpdateCapexItem(id, { [field]: val });
    }
    const updated = capexItems.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });
    safeUpdate({
      ...assumptions,
      capexItems: updated,
    });
  };

  // Add or Edit item via modal
  const handleSaveModalItem = (savedItem: CapexItem) => {
    let updatedList: CapexItem[];
    const exists = capexItems.some((i) => i.id === savedItem.id);
    if (exists) {
      updatedList = capexItems.map((i) => (i.id === savedItem.id ? savedItem : i));
    } else {
      updatedList = [...capexItems, savedItem];
    }

    safeUpdate({
      ...assumptions,
      capexItems: updatedList,
    });
    if (typeof onUpdateCapexItem === 'function') {
      onUpdateCapexItem(savedItem.id, savedItem);
    }
  };

  // Duplicate item
  const handleDuplicateItem = (item: CapexItem) => {
    const duplicated: CapexItem = {
      ...item,
      id: `capex_${Date.now()}`,
      name: `${item.name} (Copy)`,
    };
    const updatedList = [...capexItems, duplicated];
    safeUpdate({
      ...assumptions,
      capexItems: updatedList,
    });
  };

  // Delete item
  const handleDeleteItem = (id: string, name: string) => {
    if (capexItems.length <= 1) {
      alert('Model must have at least 1 CAPEX item.');
      return;
    }
    if (window.confirm(`Delete item "${name}" from the CAPEX model?`)) {
      const updatedList = capexItems.filter((i) => i.id !== id);
      safeUpdate({
        ...assumptions,
        capexItems: updatedList,
      });
    }
  };

  // Reset to default
  const handleResetDefaults = () => {
    if (
      window.confirm(
        'Reset all CAPEX items to the standard hydro configuration (IDR 669.953 Billion)?'
      )
    ) {
      safeUpdate({
        ...assumptions,
        capexItems: BASE_PLTA_ASSUMPTIONS.capexItems,
      });
    }
  };

  // Category Badges & Labels
  const getCategoryBadge = (category: CapexCategory) => {
    switch (category) {
      case 'civil':
        return {
          label: 'Civil Works',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'material_civil':
        return {
          label: 'Civil Materials',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      case 'em':
        return {
          label: 'E&M Equipment',
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
        };
      case 'material_em':
        return {
          label: 'E&M Materials',
          bg: 'bg-pink-100 text-pink-800 border-pink-200',
        };
      case 'transmission':
        return {
          label: 'Transmission & Substation',
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        };
      case 'dev':
        return {
          label: 'Development & Land',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'pre_op':
        return {
          label: 'Pre-Operations & Commissioning',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'owners':
        return {
          label: "Owner's Engineer (OE)",
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
        };
      case 'contingency':
        return {
          label: 'Contingency',
          bg: 'bg-orange-100 text-orange-800 border-orange-200',
        };
      case 'working_capital':
        return {
          label: 'Working Capital',
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
        };
      default:
        return {
          label: 'Other',
          bg: 'bg-gray-100 text-gray-800 border-gray-200',
        };
    }
  };

  // Filtered Capex Items
  const filteredItems = useMemo(() => {
    return capexItems.filter((item) => {
      const matchQuery =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.subCategory && item.subCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchQuery) return false;
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'civil_group') {
        return item.category === 'civil' || item.category === 'material_civil';
      }
      if (categoryFilter === 'em_group') {
        return item.category === 'em' || item.category === 'material_em';
      }
      return item.category === categoryFilter;
    });
  }, [capexItems, searchQuery, categoryFilter]);

  // Aggregated Category Summary
  const categorySummary = useMemo(() => {
    const summary: Record<string, { total: number; count: number }> = {
      civil_total: { total: 0, count: 0 },
      em_total: { total: 0, count: 0 },
      transmission: { total: 0, count: 0 },
      dev_land: { total: 0, count: 0 },
      oe_preop: { total: 0, count: 0 },
      contingency: { total: 0, count: 0 },
    };

    capexItems.forEach((item) => {
      if (item.category === 'civil' || item.category === 'material_civil') {
        summary.civil_total.total += item.amountIdrBillion;
        summary.civil_total.count += 1;
      } else if (item.category === 'em' || item.category === 'material_em') {
        summary.em_total.total += item.amountIdrBillion;
        summary.em_total.count += 1;
      } else if (item.category === 'transmission') {
        summary.transmission.total += item.amountIdrBillion;
        summary.transmission.count += 1;
      } else if (item.category === 'dev') {
        summary.dev_land.total += item.amountIdrBillion;
        summary.dev_land.count += 1;
      } else if (item.category === 'owners' || item.category === 'pre_op') {
        summary.oe_preop.total += item.amountIdrBillion;
        summary.oe_preop.count += 1;
      } else {
        summary.contingency.total += item.amountIdrBillion;
        summary.contingency.count += 1;
      }
    });

    return summary;
  }, [capexItems]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200 text-xs">
      {/* Top Banner & Reconciliation Check */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-600 text-white font-bold">
              <Hammer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Construction Cost (CAPEX) & S-Curve Cash Disbursement
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold border border-blue-200">
                  {capexItems.length} Work Package
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Capital expenditure (CAPEX), construction materials and cash disbursement waterfall over the construction period of {project.constructionPeriodMonths} months.
              </p>
            </div>
          </div>
        </div>

        {/* Validation & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Validation Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
              isValid
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            {isValid ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Total Phased = Base ({totalBaseCapex.toFixed(3)} IDR B)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Difference: {difference.toFixed(4)} IDR B</span>
              </>
            )}
          </div>

          {/* Add Item Button */}
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add CAPEX Item / BoQ
          </button>

          {/* Reset to Default Button */}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="p-1.5 rounded border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="Reset to Standard Hydro Item List"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-0.5 rounded border border-slate-300 flex text-xs font-medium">
            <button
              onClick={() => setViewMode('items')}
              className={`px-3 py-1 rounded transition cursor-pointer ${
                viewMode === 'items'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 BoQ & Work Package
            </button>
            <button
              onClick={() => setViewMode('scurve')}
              className={`px-3 py-1 rounded transition cursor-pointer ${
                viewMode === 'scurve'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📈 S-Curve & Disbursement
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 rounded transition cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Monthly Item Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Civil Works & Materials
          </div>
          <div className="text-sm font-black text-blue-700 mt-1">
            {(categorySummary.civil_total.total * mult).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {((categorySummary.civil_total.total / (totalBaseCapex || 1)) * 100).toFixed(1)}% | {categorySummary.civil_total.count} Item
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            E&M & Hydromechanical
          </div>
          <div className="text-sm font-black text-purple-700 mt-1">
            {(categorySummary.em_total.total * mult).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {((categorySummary.em_total.total / (totalBaseCapex || 1)) * 100).toFixed(1)}% | {categorySummary.em_total.count} Item
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Transmission & 150kV Substation
          </div>
          <div className="text-sm font-black text-cyan-700 mt-1">
            {(categorySummary.transmission.total * mult).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {((categorySummary.transmission.total / (totalBaseCapex || 1)) * 100).toFixed(1)}% | {categorySummary.transmission.count} Item
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Development & Land
          </div>
          <div className="text-sm font-black text-emerald-700 mt-1">
            {(categorySummary.dev_land.total * mult).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {((categorySummary.dev_land.total / (totalBaseCapex || 1)) * 100).toFixed(1)}% | {categorySummary.dev_land.count} Item
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            OE & Pre-Operations (SLO)
          </div>
          <div className="text-sm font-black text-amber-700 mt-1">
            {(categorySummary.oe_preop.total * mult).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {((categorySummary.oe_preop.total / (totalBaseCapex || 1)) * 100).toFixed(1)}% | {categorySummary.oe_preop.count} Item
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Contingency & Working Capital
          </div>
          <div className="text-sm font-black text-orange-700 mt-1">
            {(categorySummary.contingency.total * mult).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {((categorySummary.contingency.total / (totalBaseCapex || 1)) * 100).toFixed(1)}% | {categorySummary.contingency.count} Item
          </div>
        </div>
      </div>

      {/* VIEW 1: BOQ & CAPEX ITEMS */}
      {viewMode === 'items' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search items, specifications or materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs bg-white focus:outline-blue-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                All ({capexItems.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('civil_group')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  categoryFilter === 'civil_group'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Civil Works & Materials
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('em_group')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  categoryFilter === 'em_group'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                E&M & Hydromechanical
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('transmission')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  categoryFilter === 'transmission'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Transmission
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('dev')}
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  categoryFilter === 'dev'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Land & Environmental Assessment (AMDAL)
              </button>
            </div>

            <div className="text-xs font-mono font-bold text-slate-700">
              Total Capex: <span className="text-blue-700 font-black">{(totalBaseCapex * mult).toFixed(2)}</span> {unitLabel}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left py-2 px-3">Item / BoQ Work Package</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-right py-2 px-2">Volume & Unit</th>
                  <th className="text-right py-2 px-3">CAPEX Value ({unitLabel})</th>
                  <th className="text-right py-2 px-2">Share (%)</th>
                  <th className="text-center py-2 px-2">Start Month</th>
                  <th className="text-center py-2 px-2">End Month</th>
                  <th className="text-center py-2 px-2">Phasing Curve</th>
                  <th className="text-center py-2 px-2">Depreciation Life</th>
                  <th className="text-center py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.map((item) => {
                  const badge = getCategoryBadge(item.category);
                  const share = (item.amountIdrBillion / (totalBaseCapex || 1)) * 100;
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition">
                      {/* Name & Subcategory */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        {item.subCategory && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            {item.subCategory}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-blue-600 font-sans italic">
                            {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-2.5 px-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Volume & Unit */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                        {item.quantity && item.quantity > 1 ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {item.quantity.toLocaleString()} {item.unit || 'LS'}
                            </div>
                            {item.unitRateIdr && item.unitRateIdr > 0 ? (
                              <div className="text-[10px] text-slate-400">
                                @ Rp {item.unitRateIdr.toLocaleString()}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-400">Lump Sum (LS)</span>
                        )}
                      </td>

                      {/* Capex Amount */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        <input
                          type="number"
                          step="0.1"
                          value={item.amountIdrBillion}
                          onChange={(e) =>
                            updateItemField(
                              item.id,
                              'amountIdrBillion',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-28 text-right px-2 py-1 rounded bg-amber-50/70 border border-amber-300 text-slate-900 font-bold focus:outline-blue-500 focus:bg-white"
                          title="Edit this item's CAPEX value directly (IDR Billion)"
                        />
                      </td>

                      {/* Share */}
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-700">
                        {share.toFixed(1)}%
                      </td>

                      {/* Start Month */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min={1}
                          max={project.constructionPeriodMonths}
                          value={item.startMonth}
                          onChange={(e) =>
                            updateItemField(
                              item.id,
                              'startMonth',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-12 text-center px-1 py-1 rounded bg-slate-50 border border-slate-300 font-mono font-bold"
                        />
                      </td>

                      {/* End Month */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min={item.startMonth}
                          max={project.constructionPeriodMonths}
                          value={item.endMonth}
                          onChange={(e) =>
                            updateItemField(
                              item.id,
                              'endMonth',
                              parseInt(e.target.value) || project.constructionPeriodMonths
                            )
                          }
                          className="w-12 text-center px-1 py-1 rounded bg-slate-50 border border-slate-300 font-mono font-bold"
                        />
                      </td>

                      {/* Curve */}
                      <td className="py-2.5 px-2 text-center">
                        <select
                          value={item.curve}
                          onChange={(e) =>
                            updateItemField(item.id, 'curve', e.target.value as SpendingCurve)
                          }
                          className="px-1.5 py-1 rounded bg-slate-50 border border-slate-300 font-medium text-[11px]"
                        >
                          <option value="s_curve">S-Curve</option>
                          <option value="linear">Linear</option>
                          <option value="early_heavy">Front-Loaded</option>
                          <option value="late_heavy">Back-Loaded</option>
                        </select>
                      </td>

                      {/* Depr Life */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={item.usefulLifeYears}
                          onChange={(e) =>
                            updateItemField(
                              item.id,
                              'usefulLifeYears',
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-12 text-center px-1 py-1 rounded bg-slate-50 border border-slate-300 font-mono"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-1 rounded text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                            title="Edit Details (BoQ, Description, Unit)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(item)}
                            className="p-1 rounded text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Duplicate This Item"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="p-1 rounded text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-left uppercase text-[11px]">
                    Total Base Project Cost (CAPEX)
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-800 text-sm font-black">
                    {(totalBaseCapex * mult).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">100.0%</td>
                  <td colSpan={5} className="py-2.5 px-3 text-slate-500 text-right font-normal">
                    {filteredItems.length} of {capexItems.length} items shown
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: S-CURVE & CASH DISBURSEMENT SCHEDULE */}
      {viewMode === 'scurve' && (
        <div className="space-y-4">
          {/* S-Curve Chart */}
          <SCurveChart
            schedule={schedule}
            drawdownOrder={funding.drawdownOrder || 'pro_rata'}
            onChangeDrawdownOrder={onChangeDrawdownOrder}
            currencyDisplay={currencyDisplay}
            fxRate={fx}
          />

          {/* Cash Disbursement Waterfall Table */}
          <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap justify-between items-center text-xs font-bold uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Monthly Cash Requirements & Disbursement Waterfall
              </span>
              <span className="font-mono text-blue-300">
                Total Phased Capex: {(totalScheduleCapex * mult).toFixed(2)} {unitLabel}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
              <table className="w-full text-xs text-right border-collapse font-mono">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2 text-center">Months</th>
                    <th className="py-2 px-2 text-left font-sans">Date</th>
                    <th className="py-2 px-2 text-slate-900">CAPEX Requirements</th>
                    <th className="py-2 px-2 text-slate-600">Cumulative CAPEX</th>
                    <th className="py-2 px-2 text-amber-600 font-sans">S-Curve %</th>
                    <th className="py-2 px-2 text-emerald-700">Equity Drawdown</th>
                    <th className="py-2 px-2 text-blue-700">Debt Drawdown</th>
                    <th className="py-2 px-2 text-slate-900 font-black">Total Drawdown</th>
                    <th className="py-2 px-2 text-slate-500">Opening Debt Balance</th>
                    <th className="py-2 px-2 text-amber-700">Interest (IDC)</th>
                    <th className="py-2 px-2 text-blue-900 font-black">Closing Debt Balance</th>
                    <th className="py-2 px-2 text-purple-700">Undrawn Facility</th>
                    <th className="py-2 px-2 text-slate-600">Commitment Fee</th>
                    <th className="py-2 px-2 text-emerald-600 font-sans text-center">Cash Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {schedule.map((row) => {
                    const isBalanced = row.cashVariance < 0.001;
                    return (
                      <tr key={row.month} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-2 text-center font-bold text-slate-900">
                          M{row.month}
                        </td>
                        <td className="py-2 px-2 text-left font-sans text-slate-600">
                          {row.dateStr}
                        </td>
                        <td className="py-2 px-2 font-bold text-slate-900">
                          {(row.totalCapex * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {(row.cumulativeCapex * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-amber-600 font-bold font-sans">
                          {row.cumulativeCapexPct.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2 text-emerald-700 font-semibold">
                          {(row.equityDrawdown * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-blue-700 font-semibold">
                          {(row.debtDrawdown * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 font-black text-slate-900">
                          {(row.totalDisbursement * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-slate-600">
                          {(row.openingDebt * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-amber-700">
                          {(row.idcCapitalized > 0 ? row.idcCapitalized : row.idcPaid) * mult > 0
                            ? (
                                (row.idcCapitalized > 0 ? row.idcCapitalized : row.idcPaid) *
                                mult
                              ).toFixed(2)
                            : '-'}
                        </td>
                        <td className="py-2 px-2 font-bold text-blue-900">
                          {(row.closingDebt * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-purple-700">
                          {(row.undrawnDebt * mult).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-slate-500">
                          {(row.commitmentFee * mult).toFixed(3)}
                        </td>
                        <td className="py-2 px-2 text-center font-sans">
                          {isBalanced ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ✓ Balance
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              Δ {row.cashVariance.toFixed(3)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-2 text-left font-sans uppercase">
                      Construction Period Total
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-900">
                      {(totalScheduleCapex * mult).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2">-</td>
                    <td className="py-2.5 px-2 text-amber-600 font-sans">100.0%</td>
                    <td className="py-2.5 px-2 text-emerald-800">
                      {(schedule.reduce((s, r) => s + r.equityDrawdown, 0) * mult).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-blue-800">
                      {(schedule.reduce((s, r) => s + r.debtDrawdown, 0) * mult).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-900">
                      {(schedule.reduce((s, r) => s + r.totalDisbursement, 0) * mult).toFixed(2)}
                    </td>
                    <td colSpan={2} className="py-2.5 px-2 text-amber-700">
                      IDC: {(schedule.reduce((s, r) => s + (r.idcCapitalized || r.idcPaid), 0) * mult).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-blue-900">
                      COD: {schedule.length > 0 ? (schedule[schedule.length - 1].closingDebt * mult).toFixed(2) : '0.00'}
                    </td>
                    <td colSpan={3} className="py-2.5 px-2 text-center text-emerald-700 font-sans font-bold">
                      All CAPEX Requirements Fully Funded
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: MONTHLY ITEMIZED MATRIX */}
      {viewMode === 'matrix' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              Monthly Spending Matrix by Work Item (M1 - M{project.constructionPeriodMonths})
            </span>
            <span className="font-mono text-blue-300">Units: {unitLabel}</span>
          </div>

          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-xs text-right border-collapse font-mono">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3 text-left font-sans min-w-[200px] sticky left-0 bg-slate-100 z-20">
                    Work Package
                  </th>
                  <th className="py-2 px-2 text-center font-sans">Category</th>
                  <th className="py-2 px-2 font-black text-slate-900">Total Capex</th>
                  {schedule.map((m) => (
                    <th key={m.month} className="py-2 px-2 min-w-[65px] text-center font-bold">
                      M{m.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {capexItems.map((item) => {
                  const badge = getCategoryBadge(item.category);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 text-left font-sans font-bold text-slate-900 sticky left-0 bg-white z-10 truncate max-w-[240px]">
                        {item.name}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.bg}`}>
                          {item.category.substring(0, 8)}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-bold text-slate-900">
                        {(item.amountIdrBillion * mult).toFixed(2)}
                      </td>
                      {schedule.map((m) => {
                        const spend = m.itemsExpenditure[item.id] || 0;
                        return (
                          <td
                            key={m.month}
                            className={`py-2 px-2 ${
                              spend > 0 ? 'text-slate-900 font-medium bg-blue-50/20' : 'text-slate-300'
                            }`}
                          >
                            {spend > 0 ? (spend * mult).toFixed(2) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="py-2.5 px-3 text-left font-sans uppercase sticky left-0 bg-slate-100 z-20">
                    Total Monthly CAPEX Requirements
                  </td>
                  <td className="py-2.5 px-2">-</td>
                  <td className="py-2.5 px-2 text-blue-800 font-black">
                    {(totalScheduleCapex * mult).toFixed(2)}
                  </td>
                  {schedule.map((m) => (
                    <td key={m.month} className="py-2.5 px-2 text-blue-800 font-bold">
                      {(m.totalCapex * mult).toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Item Modal */}
      <CapexItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveModalItem}
        initialItem={editingItem}
        maxConstructionMonths={project.constructionPeriodMonths}
        fxRate={fx}
      />
    </div>
  );
};
