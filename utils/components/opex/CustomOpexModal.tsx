import React, { useState, useEffect } from 'react';
import { CustomOpexItem, OpexCategory, CurrencyDisplay } from '../../types';
import { X, Sparkles, Plus, Save, AlertCircle } from 'lucide-react';

interface CustomOpexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: CustomOpexItem) => void;
  initialItem?: CustomOpexItem | null;
  defaultEscalationPct: number;
  operatingYears?: number;
  currencyDisplay: CurrencyDisplay;
  fxRate: number;
}

interface OpexPresetTemplate {
  name: string;
  category: OpexCategory;
  amountIdrBillion: number;
  notes: string;
}

const OPEX_PRESETS: OpexPresetTemplate[] = [
  {
    name: 'Site Perimeter & Intake Security Patrol',
    category: 'admin',
    amountIdrBillion: 1.187,
    notes: '24/7 security service and patrol stations for weir, intake, and powerhouse (Sesuai Contoh PDF Redelong: Rp 1.187 Juta).',
  },
  {
    name: 'Professional Fees (Audit, Legal & Tax)',
    category: 'admin',
    amountIdrBillion: 0.5,
    notes: 'External auditor fees, legal counsels, and tax consulting retainer (Sesuai Contoh PDF Redelong: Rp 500 Juta).',
  },
  {
    name: 'Health & Safety (K3 Pembangkit)',
    category: 'regulatory',
    amountIdrBillion: 0.289,
    notes: 'Alat pelindung diri (APD), SMK3 audit, medical checkup, dan sertifikasi keselamatan (Sesuai Contoh PDF: Rp 289 Juta).',
  },
  {
    name: 'Utilities (Water & Communications)',
    category: 'fixed',
    amountIdrBillion: 0.296,
    notes: 'Internet fiber optic site, telekomunikasi satelit SCADA, dan listrik/air utilitas (Sesuai Contoh PDF: Rp 296 Juta).',
  },
  {
    name: 'Fuel & Operational Vehicle Maintenance',
    category: 'maintenance',
    amountIdrBillion: 0.176,
    notes: 'BBM mobil patroli operasional, servis rutin armada 4x4 site (Sesuai Contoh PDF: Rp 176 Juta).',
  },
  {
    name: 'Driver & Office Support Staff',
    category: 'admin',
    amountIdrBillion: 0.198,
    notes: 'Tenaga pendukung kantor site, driver operasional & office boy (Sesuai Contoh PDF: Rp 198 Juta).',
  },
  {
    name: 'Donation & Community Representation (CSR)',
    category: 'regulatory',
    amountIdrBillion: 0.018,
    notes: 'Bina lingkungan warga sekitar DAS dan representasi humas lokal (Sesuai Contoh PDF: Rp 18 Juta).',
  },
  {
    name: 'Technical Training & Operator Certification',
    category: 'admin',
    amountIdrBillion: 0.04,
    notes: 'Pelatihan berkala kompetensi operator dan sertifikasi ketenagalistrikan (Sesuai Contoh PDF: Rp 40 Juta).',
  },
  {
    name: 'General Office & Administrative Expenses',
    category: 'admin',
    amountIdrBillion: 0.121,
    notes: 'ATK, konsumsi, dan perlengkapan administrasi kantor (Sesuai Contoh PDF: Rp 121 Juta).',
  },
  {
    name: 'Reservoir Bathymetry & Sedimentation Monitoring',
    category: 'maintenance',
    amountIdrBillion: 0.4,
    notes: 'Periodic sonar sedimentation surveys and environmental compliance reporting.',
  },
  {
    name: 'Access Road & Logistics Facility Lease',
    category: 'fixed',
    amountIdrBillion: 0.35,
    notes: 'Right-of-way easement fees and logistics access road compensation.',
  },
  {
    name: 'Critical Turbine Spare Parts Inventory Reserve',
    category: 'maintenance',
    amountIdrBillion: 0.3,
    notes: 'Rotational turbine bearings, mechanical seals, and SCADA vibration sensor reserves.',
  },
];

export const CustomOpexModal: React.FC<CustomOpexModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  defaultEscalationPct,
  operatingYears = 30,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<OpexCategory>('fixed');
  const [amountIdrBillion, setAmountIdrBillion] = useState<number>(0.5);
  const [useCustomEscalation, setUseCustomEscalation] = useState(false);
  const [escalationPct, setEscalationPct] = useState<number>(defaultEscalationPct);
  const [startYear, setStartYear] = useState<number>(1);
  const [endYear, setEndYear] = useState<number>(operatingYears);
  const [active, setActive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name);
      setCategory(initialItem.category);
      setAmountIdrBillion(initialItem.amountIdrBillion);
      if (initialItem.escalationPct !== undefined) {
        setUseCustomEscalation(true);
        setEscalationPct(initialItem.escalationPct);
      } else {
        setUseCustomEscalation(false);
        setEscalationPct(defaultEscalationPct);
      }
      setStartYear(initialItem.startYear ?? 1);
      setEndYear(initialItem.endYear ?? operatingYears);
      setActive(initialItem.active);
      setNotes(initialItem.notes ?? '');
    } else {
      setName('');
      setCategory('fixed');
      setAmountIdrBillion(0.5);
      setUseCustomEscalation(false);
      setEscalationPct(defaultEscalationPct);
      setStartYear(1);
      setEndYear(operatingYears);
      setActive(true);
      setNotes('');
    }
    setError(null);
  }, [initialItem, isOpen, defaultEscalationPct, operatingYears]);

  if (!isOpen) return null;

  const applyPreset = (preset: OpexPresetTemplate) => {
    setName(preset.name);
    setCategory(preset.category);
    setAmountIdrBillion(preset.amountIdrBillion);
    setNotes(preset.notes);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('OPEX item name is required.');
      return;
    }
    if (amountIdrBillion < 0 || isNaN(amountIdrBillion)) {
      setError('Annual amount must be a positive number (>= 0).');
      return;
    }
    if (startYear < 1 || startYear > operatingYears) {
      setError(`Start operating year must be between 1 and ${operatingYears}.`);
      return;
    }
    if (endYear < startYear || endYear > operatingYears) {
      setError(`End operating year must be between ${startYear} and ${operatingYears}.`);
      return;
    }

    const item: CustomOpexItem = {
      id: initialItem?.id ?? `opex_custom_${Date.now()}`,
      name: name.trim(),
      category,
      amountIdrBillion,
      escalationPct: useCustomEscalation ? escalationPct : undefined,
      startYear,
      endYear,
      active,
      notes: notes.trim() || undefined,
    };

    onSave(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 font-sans text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              {initialItem ? 'Edit Custom OPEX Item' : 'Add Custom OPEX Item'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Custom operating cost item beyond standard formulas, integrated into annual schedules and financial statements.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets */}
          {!initialItem && (
            <div>
              <div className="flex items-center gap-1.5 text-slate-700 font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Select Quick Renewable / Hydropower Preset Template:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OPEX_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="text-left p-2 rounded border border-slate-200 bg-slate-50/70 hover:bg-emerald-50 hover:border-emerald-300 transition text-[11px] cursor-pointer group"
                  >
                    <div className="font-semibold text-slate-800 group-hover:text-emerald-900 line-clamp-1">
                      {p.name}
                    </div>
                    <div className="text-slate-500 font-mono text-[10px] mt-0.5">
                      {p.amountIdrBillion.toFixed(2)} IDR B/yr • Category: {p.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Form Fields */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                OPEX Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CSR & Catchment Community Development"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cost Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as OpexCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 font-sans"
                >
                  <option value="fixed">Additional Fixed O&M</option>
                  <option value="variable">Additional Variable O&M</option>
                  <option value="regulatory">Regulatory, EIA & CSR</option>
                  <option value="admin">Administration, Legal & Staff</option>
                  <option value="maintenance">Special Maintenance & Reserves</option>
                  <option value="other">Other / Operating Contingency</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Base Annual Amount (IDR Billion / yr) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amountIdrBillion}
                  onChange={(e) => setAmountIdrBillion(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Escalation options */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 text-[11px]">
                  <input
                    type="checkbox"
                    checked={useCustomEscalation}
                    onChange={(e) => setUseCustomEscalation(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Apply Custom Escalation Rate for this Item</span>
                </label>
                {!useCustomEscalation && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Model default: {defaultEscalationPct.toFixed(2)}% p.a.
                  </span>
                )}
              </div>

              {useCustomEscalation && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-600">Annual Escalation:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={escalationPct}
                    onChange={(e) => setEscalationPct(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-slate-300 rounded font-mono font-bold text-right bg-white"
                  />
                  <span className="font-mono text-slate-500 text-[11px]">% per year</span>
                </div>
              )}
            </div>

            {/* Operating Horizon Timing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Start Operating Year</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-mono">Yr</span>
                  <input
                    type="number"
                    min="1"
                    max={operatingYears}
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">End Operating Year</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-mono">Yr</span>
                  <input
                    type="number"
                    min="1"
                    max={operatingYears}
                    value={endYear}
                    onChange={(e) => setEndYear(parseInt(e.target.value) || operatingYears)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-lg">
              <div>
                <div className="font-bold text-slate-900">OPEX Item Status</div>
                <div className="text-[10px] text-slate-500">
                  {active ? 'Active item included in Total OPEX & EBITDA calculations' : 'Inactive item (excluded from calculations)'}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Justification (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Brief cost reference, contract basis, or operational justification..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save OPEX Item</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
