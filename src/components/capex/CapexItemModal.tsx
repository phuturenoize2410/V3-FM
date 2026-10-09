import React, { useState, useEffect } from 'react';
import { CapexItem, CapexCategory, SpendingCurve } from '../../types';
import { X, Sparkles, Calculator, Check, AlertCircle } from 'lucide-react';

interface CapexItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: CapexItem) => void;
  initialItem?: CapexItem | null;
  maxConstructionMonths: number;
  fxRate: number;
}

interface PresetTemplate {
  name: string;
  category: CapexCategory;
  subCategory: string;
  unit: string;
  quantity: number;
  unitRateIdr: number;
  amountIdrBillion: number;
  startMonth: number;
  endMonth: number;
  curve: SpendingCurve;
  usefulLifeYears: number;
  notes: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: 'Structural Concrete K-350 & Portland Cement',
    category: 'material_civil',
    subCategory: 'Concrete Structural & Grouting Works',
    unit: 'm3',
    quantity: 18000,
    unitRateIdr: 1550000,
    amountIdrBillion: 27.9,
    startMonth: 2,
    endMonth: 24,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: 'Reinforced concrete requirements for intake, headrace, and powerhouse.',
  },
  {
    name: 'Deformed Steel Rebar (D16-D32) & Wiremesh',
    category: 'material_civil',
    subCategory: 'Rebar & Reinforcement Works',
    unit: 'ton',
    quantity: 1500,
    unitRateIdr: 14800000,
    amountIdrBillion: 22.2,
    startMonth: 3,
    endMonth: 24,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: 'Procurement of standard reinforcing steel with tensile test certification.',
  },
  {
    name: 'River Stone, Coarse Sand, Aggregate & Geotextile',
    category: 'material_civil',
    subCategory: 'Aggregate Material & Masonry',
    unit: 'm3',
    quantity: 22000,
    unitRateIdr: 380000,
    amountIdrBillion: 8.36,
    startMonth: 1,
    endMonth: 20,
    curve: 'linear',
    usefulLifeYears: 30,
    notes: 'Rip-rap stone masonry for riverbank protection and spillway.',
  },
  {
    name: 'High-Pressure Steel Penstock Pipe',
    category: 'material_em',
    subCategory: 'High-Pressure Waterway Pipe',
    unit: 'ton',
    quantity: 650,
    unitRateIdr: 42000000,
    amountIdrBillion: 27.3,
    startMonth: 10,
    endMonth: 26,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: 'ASTM A516 Gr 70 steel pipe complete with expansion joints and anchor blocks.',
  },
  {
    name: 'Tunnel Excavation Works (Tunneling & Shotcrete)',
    category: 'civil',
    subCategory: 'Headrace Waterway Tunnel',
    unit: 'meter',
    quantity: 2800,
    unitRateIdr: 28500000,
    amountIdrBillion: 79.8,
    startMonth: 2,
    endMonth: 24,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: 'Horseshoe tunnel excavation, rock bolting, shotcrete, and invert concrete.',
  },
  {
    name: 'Powerhouse Facility Building, Tailrace & 25-Ton Crane',
    category: 'civil',
    subCategory: 'Powerhouse Facility Building',
    unit: 'LS',
    quantity: 1,
    unitRateIdr: 45000000000,
    amountIdrBillion: 45.0,
    startMonth: 8,
    endMonth: 27,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: 'Powerhouse structure with 25-ton overhead travelling crane installation.',
  },
  {
    name: 'Francis / Pelton Hydro Turbines & Hydraulic Governor',
    category: 'em',
    subCategory: 'Main Generating Equipment',
    unit: 'set',
    quantity: 2,
    unitRateIdr: 48000000000,
    amountIdrBillion: 96.0,
    startMonth: 10,
    endMonth: 28,
    curve: 'late_heavy',
    usefulLifeYears: 25,
    notes: '2 units high-efficiency hydro turbines complete with main inlet valve (MIV) & bypass.',
  },
  {
    name: '3-Phase Synchronous Generators & Digital Excitation',
    category: 'em',
    subCategory: 'Generator & Excitation System',
    unit: 'set',
    quantity: 2,
    unitRateIdr: 39000000000,
    amountIdrBillion: 78.0,
    startMonth: 12,
    endMonth: 28,
    curve: 'late_heavy',
    usefulLifeYears: 25,
    notes: 'Synchronous generators with 11 kV output voltage and closed-loop cooling.',
  },
  {
    name: 'Main Step-Up Transformers 11/150 kV & Switchyard Bay',
    category: 'em',
    subCategory: 'Transformers & Interconnection Switchyard',
    unit: 'set',
    quantity: 1,
    unitRateIdr: 28000000000,
    amountIdrBillion: 28.0,
    startMonth: 14,
    endMonth: 28,
    curve: 'late_heavy',
    usefulLifeYears: 25,
    notes: '11/150 kV low-loss power transformer with Buchholz relay and fire protection.',
  },
  {
    name: 'Intake Sluice Gates, Trashrack & Trash Cleaning Machine',
    category: 'material_em',
    subCategory: 'Hydromechanical Equipment',
    unit: 'LS',
    quantity: 1,
    unitRateIdr: 16500000000,
    amountIdrBillion: 16.5,
    startMonth: 8,
    endMonth: 26,
    curve: 'linear',
    usefulLifeYears: 25,
    notes: 'Stainless steel slide gates with winch hoist and water level sensors.',
  },
  {
    name: '150 kV High-Voltage Overhead Transmission Line',
    category: 'transmission',
    subCategory: 'Power Evacuation Transmission Network',
    unit: 'km',
    quantity: 18,
    unitRateIdr: 2400000000,
    amountIdrBillion: 43.2,
    startMonth: 12,
    endMonth: 28,
    curve: 'linear',
    usefulLifeYears: 30,
    notes: '150 kV transmission line to nearest utility grid substation, ACSR conductor.',
  },
  {
    name: 'Land Acquisition & Right-of-Way (ROW)',
    category: 'dev',
    subCategory: 'Land Procurement & ROW Compensation',
    unit: 'ha',
    quantity: 45,
    unitRateIdr: 320000000,
    amountIdrBillion: 14.4,
    startMonth: 1,
    endMonth: 10,
    curve: 'early_heavy',
    usefulLifeYears: 30,
    notes: 'Land acquisition for weir site, tunnel, powerhouse, and ROW corridor.',
  },
  {
    name: 'EIA (AMDAL), Hydrology & Geotechnical Studies',
    category: 'dev',
    subCategory: 'Environmental & Engineering Studies',
    unit: 'LS',
    quantity: 1,
    unitRateIdr: 8500000000,
    amountIdrBillion: 8.5,
    startMonth: 1,
    endMonth: 8,
    curve: 'early_heavy',
    usefulLifeYears: 30,
    notes: 'Environmental impact permits, core borehole drilling, and river sediment analysis.',
  },
  {
    name: "Owner's Engineer (OE) & Construction Quality Supervision",
    category: 'owners',
    subCategory: 'Independent Supervision Consultant',
    unit: 'month',
    quantity: 30,
    unitRateIdr: 550000000,
    amountIdrBillion: 16.5,
    startMonth: 1,
    endMonth: 30,
    curve: 'linear',
    usefulLifeYears: 30,
    notes: 'OE consultant supervising QA/QC, physical progress, BoQ, and milestone certifications.',
  },
  {
    name: 'Testing, Commissioning, First Sync & COD Certificate (SLO)',
    category: 'pre_op',
    subCategory: 'Commissioning & Regulatory Certification',
    unit: 'LS',
    quantity: 1,
    unitRateIdr: 12500000000,
    amountIdrBillion: 12.5,
    startMonth: 22,
    endMonth: 30,
    curve: 'late_heavy',
    usefulLifeYears: 10,
    notes: '72-hour continuous reliability run, protection testing, and commercial operation clearance.',
  },
  {
    name: 'Physical Contingency & Unforeseen Geological Risks (5%)',
    category: 'contingency',
    subCategory: 'Contingency Cost Reserve',
    unit: 'LS',
    quantity: 1,
    unitRateIdr: 25000000000,
    amountIdrBillion: 25.0,
    startMonth: 1,
    endMonth: 30,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: 'Unforeseen reserve for geotechnical condition variations and variation orders.',
  },
];

export const CapexItemModal: React.FC<CapexItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  maxConstructionMonths,
  fxRate,
}) => {
  const [formData, setFormData] = useState<CapexItem>({
    id: '',
    name: '',
    category: 'civil',
    subCategory: '',
    unit: 'LS',
    quantity: 1,
    unitRateIdr: 0,
    amountIdrBillion: 0,
    startMonth: 1,
    endMonth: maxConstructionMonths || 30,
    curve: 's_curve',
    usefulLifeYears: 30,
    notes: '',
  });

  const [useUnitRateCalc, setUseUnitRateCalc] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    if (initialItem) {
      setFormData({
        ...initialItem,
        unit: initialItem.unit || 'LS',
        quantity: initialItem.quantity || 1,
        unitRateIdr: initialItem.unitRateIdr || 0,
        subCategory: initialItem.subCategory || '',
        notes: initialItem.notes || '',
      });
      setUseUnitRateCalc(!!initialItem.unitRateIdr && initialItem.unitRateIdr > 0);
      setSelectedPreset('');
    } else {
      setFormData({
        id: `capex_${Date.now()}`,
        name: '',
        category: 'civil',
        subCategory: '',
        unit: 'LS',
        quantity: 1,
        unitRateIdr: 0,
        amountIdrBillion: 0,
        startMonth: 1,
        endMonth: maxConstructionMonths || 30,
        curve: 's_curve',
        usefulLifeYears: 30,
        notes: '',
      });
      setUseUnitRateCalc(false);
      setSelectedPreset('');
    }
  }, [initialItem, isOpen, maxConstructionMonths]);

  if (!isOpen) return null;

  const handleApplyPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    const template = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (!template) return;

    setFormData((prev) => ({
      ...prev,
      name: template.name,
      category: template.category,
      subCategory: template.subCategory,
      unit: template.unit,
      quantity: template.quantity,
      unitRateIdr: template.unitRateIdr,
      amountIdrBillion: template.amountIdrBillion,
      startMonth: Math.min(template.startMonth, maxConstructionMonths),
      endMonth: Math.min(template.endMonth, maxConstructionMonths),
      curve: template.curve,
      usefulLifeYears: template.usefulLifeYears,
      notes: template.notes,
    }));
    setUseUnitRateCalc(template.unitRateIdr > 0 && template.unit !== 'LS');
  };

  const handleQuantityOrRateChange = (qty: number, rate: number) => {
    const calcBillion = (qty * rate) / 1e9;
    setFormData((prev) => ({
      ...prev,
      quantity: qty,
      unitRateIdr: rate,
      amountIdrBillion: Number(calcBillion.toFixed(4)),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Enter an item or work package name.');
      return;
    }
    if (formData.amountIdrBillion <= 0) {
      alert('CAPEX amount must be greater than zero.');
      return;
    }
    if (formData.startMonth > formData.endMonth) {
      alert('Start month must not exceed end month.');
      return;
    }

    onSave({
      ...formData,
      id: formData.id || `capex_${Date.now()}`,
    });
    onClose();
  };

  const usdMillion = formData.amountIdrBillion / (fxRate / 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-300 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-xs">
              {initialItem ? '✎' : '+'}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">
                {initialItem ? 'Edit CAPEX Item & Work Package' : 'Add New Project CAPEX Item'}
              </h3>
              <p className="text-[11px] text-slate-300">
                Civil works, construction materials, E&M, transmission or engineering services
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Preset Selector Banner */}
          {!initialItem && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 text-blue-900 font-bold">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Select a Standard IPP Hydro / Renewable Template (Optional):</span>
              </div>
              <select
                value={selectedPreset}
                onChange={(e) => handleApplyPreset(e.target.value)}
                className="w-full text-xs py-1.5 px-2.5 rounded bg-white border border-blue-300 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="">-- Start Blank or Select a Project Specification Preset --</option>
                {PRESET_TEMPLATES.map((tmpl, i) => (
                  <option key={i} value={tmpl.name}>
                    [{tmpl.category.toUpperCase()}] {tmpl.name} (Rp {tmpl.amountIdrBillion.toFixed(2)} B)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Work Package / Material Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Example: Portland Cement K-350 & Headrace Grouting"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded border border-slate-300 text-slate-900 text-xs font-semibold focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Project Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as CapexCategory })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-800 text-xs font-medium focus:border-blue-600 focus:outline-hidden bg-white"
              >
                <option value="civil">EPC Civil Works (Weir, Tunnel, Buildings)</option>
                <option value="material_civil">Civil Materials (Concrete, Cement, Steel, Stone)</option>
                <option value="em">Electro-Mechanical Equipment (Turbine, Generator, Transformer)</option>
                <option value="material_em">E&M & Hydromechanical Materials (Penstock, Gates, Trashrack)</option>
                <option value="transmission">Transmission Line & Interconnection Substation</option>
                <option value="dev">Project Development, FS, Geotechnical & Land (ROW)</option>
                <option value="pre_op">Pre-Operations, Testing/Commissioning & SLO</option>
                <option value="owners">Owner's Engineer (OE) & Construction Quality Supervision</option>
                <option value="contingency">Physical & Unforeseen Contingency</option>
                <option value="working_capital">Initial Working Capital</option>
                <option value="other">Other Works</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Subcategory / Work Package (Optional)
              </label>
              <input
                type="text"
                placeholder="Example: Waterway Structures, 2x15 MW Turbine Package"
                value={formData.subCategory || ''}
                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-slate-800 text-xs focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Volume, Rate & Calculation Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-blue-600" />
                Cost Basis (BoQ vs Lump Sum)
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={useUnitRateCalc}
                  onChange={(e) => setUseUnitRateCalc(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Calculate from Quantity × Unit Rate
              </label>
            </div>

            {useUnitRateCalc ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="m3, ton, set, km"
                    value={formData.unit || 'm3'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Quantity / Volume
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={formData.quantity || 0}
                    onChange={(e) => {
                      const q = parseFloat(e.target.value) || 0;
                      handleQuantityOrRateChange(q, formData.unitRateIdr || 0);
                    }}
                    className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Unit Rate (IDR/Unit)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={formData.unitRateIdr || 0}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value) || 0;
                      handleQuantityOrRateChange(formData.quantity || 0, r);
                    }}
                    className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono text-right"
                  />
                </div>
              </div>
            ) : null}

            {/* Total Amount Input / Result */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Total CAPEX Value (IDR Billion) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">Rp</span>
                  <input
                    type="number"
                    step="0.001"
                    min={0.001}
                    required
                    value={formData.amountIdrBillion}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({ ...formData, amountIdrBillion: val });
                    }}
                    className="w-full pl-8 pr-20 py-1.5 rounded border border-blue-400 bg-white text-slate-900 font-mono font-black text-sm text-right focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="absolute right-2.5 top-2 text-slate-400 text-[10px] font-medium">
                    Billion
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  USD Equivalent (FX IDR {fxRate.toLocaleString()})
                </label>
                <div className="py-1.5 px-3 rounded bg-slate-100 border border-slate-200 text-right font-mono font-bold text-sm text-slate-700">
                  ${usdMillion.toFixed(3)} M USD
                </div>
              </div>
            </div>
          </div>

          {/* Construction Window & Spending Profile */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Start Month (M1..M{maxConstructionMonths})
              </label>
              <input
                type="number"
                min={1}
                max={maxConstructionMonths}
                required
                value={formData.startMonth}
                onChange={(e) =>
                  setFormData({ ...formData, startMonth: parseInt(e.target.value) || 1 })
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                End Month (M1..M{maxConstructionMonths})
              </label>
              <input
                type="number"
                min={formData.startMonth}
                max={maxConstructionMonths}
                required
                value={formData.endMonth}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endMonth: parseInt(e.target.value) || maxConstructionMonths,
                  })
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Phasing Curve Profile
              </label>
              <select
                value={formData.curve}
                onChange={(e) =>
                  setFormData({ ...formData, curve: e.target.value as SpendingCurve })
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="s_curve">S-Curve (Sigmoid / Bell)</option>
                <option value="linear">Linear (Equal Monthly)</option>
                <option value="early_heavy">Early-Heavy (Front-Loaded)</option>
                <option value="late_heavy">Late-Heavy (Back-Loaded)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Depreciation Life (Years)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                required
                value={formData.usefulLifeYears}
                onChange={(e) =>
                  setFormData({ ...formData, usefulLifeYears: parseInt(e.target.value) || 0 })
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-center font-mono font-bold text-xs"
              />
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Engineering / Contractor Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="Example: Refer to EPC Contract BoQ Chapter 4 or SNI 2052:2017"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-700"
            />
          </div>

          {/* Warning / Confirmation Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 flex items-center gap-2 text-emerald-900 text-[11px]">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Changes to this item automatically flow into Total CAPEX,
              Sources & Uses, Bank Debt, Sponsor Equity, IDC and the Debt Amortization Schedule.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save & Update Model
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
