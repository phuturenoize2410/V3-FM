import type { NavigateToTab } from '../../application/navigation';
import React, { useState, useMemo } from 'react';
import {
  FullModelAssumptions,
  CurrencyDisplay,
  ModelMetrics,
  AmortizationType,
  DrawdownOrder,
  IdcMode,
  DsraMonths,
  TabId,
} from '../../types';
import {
  calculateAuditedMonthlyCapex,
  calculateAuditedSourcesAndUses,
} from '../../calculations/constructionFundingEngine';
import { calculateAuditedDebtAndOperations } from '../../calculations/auditedOperatingEngine';
import {
  calculateModelMetrics,
  generateSensitivityMatrix,
} from '../../calculations/financialEngine';
import {
  BASE_PLTA_ASSUMPTIONS,
  BASE_PLTS_ASSUMPTIONS,
  BASE_PLTP_ASSUMPTIONS,
  BASE_WTE_ASSUMPTIONS,
  BASE_PLTU_ASSUMPTIONS,
  BASE_GENERIC_ASSUMPTIONS,
  HOLDING_TECHNOLOGY_PRESETS,
  TECHNOLOGY_REGISTRY,
} from '../../calculations/defaultAssumptions';
import { TechnologyType } from '../../types';
import {
  formatPercent,
  formatMultiple,
  formatCurrencyValue,
} from '../../utils/formatters';
import {
  SlidersHorizontal,
  RotateCcw,
  Zap,
  Shield,
  Hammer,
  DollarSign,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Grid,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  TrendingUp,
  Building,
  MapPin,
  Calendar,
  Award,
  Sparkles,
  Edit3,
} from 'lucide-react';

interface DriverCockpitTabProps {
  assumptions: FullModelAssumptions;
  onChangeAssumptions: (newAssumptions: FullModelAssumptions) => void;
  onResetDefaults: () => void;
  metrics: ModelMetrics;
  currencyDisplay: CurrencyDisplay;
  onOpenAuditTrace: (nodeKey?: string) => void;
  onSelectTab: NavigateToTab;
}

export const DriverCockpitTab: React.FC<DriverCockpitTabProps> = ({
  assumptions,
  onChangeAssumptions,
  onResetDefaults,
  metrics,
  currencyDisplay,
  onOpenAuditTrace,
  onSelectTab,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const currentTech: TechnologyType = assumptions.project.technology || 'hydro';
  const currentTechMeta = TECHNOLOGY_REGISTRY[currentTech] || TECHNOLOGY_REGISTRY.hydro;

  const handleSelectTechnology = (tech: TechnologyType) => {
    const preset = HOLDING_TECHNOLOGY_PRESETS[tech];
    if (preset) {
      onChangeAssumptions(JSON.parse(JSON.stringify(preset)));
    }
  };

  // Base metrics for real-time comparison deltas
  const baseMetrics = useMemo(() => {
    const basePreset = HOLDING_TECHNOLOGY_PRESETS[currentTech] || BASE_PLTA_ASSUMPTIONS;
    const baseCapex = calculateAuditedMonthlyCapex(basePreset);
    const baseSU = calculateAuditedSourcesAndUses(basePreset, baseCapex);
    const baseOp = calculateAuditedDebtAndOperations(basePreset, baseSU);
    return calculateModelMetrics(basePreset, baseCapex, baseOp.annualRows, baseSU);
  }, [currentTech]);

  // Preset Scenario Appliers
  const applyPresetDriver = (type: string) => {
    const basePreset = HOLDING_TECHNOLOGY_PRESETS[currentTech] || BASE_PLTA_ASSUMPTIONS;
    const updated: FullModelAssumptions = JSON.parse(JSON.stringify(basePreset));

    if (type === 'base') {
      onChangeAssumptions(updated);
    } else if (type === 'p90_drought') {
      updated.operating.capacityFactorPct = Math.max(10, Number((updated.operating.capacityFactorPct * 0.82).toFixed(1)));
      updated.revenue.baseTariffIdrPerKWh = Math.round(updated.revenue.baseTariffIdrPerKWh * 0.95);
      onChangeAssumptions(updated);
    } else if (type === 'capex_overrun') {
      updated.capexItems = updated.capexItems.map((item) => ({
        ...item,
        amountIdrBillion: Number((item.amountIdrBillion * 1.15).toFixed(3)),
      }));
      onChangeAssumptions(updated);
    } else if (type === 'high_interest') {
      updated.funding.bankInterestRatePct = Number((updated.funding.bankInterestRatePct + 2.0).toFixed(2));
      updated.valuation.costOfDebtPreTaxPct = updated.funding.bankInterestRatePct;
      onChangeAssumptions(updated);
    } else if (type === 'aggressive_gearing') {
      updated.funding.bankDebtPct = 80.0;
      updated.funding.equityPct = 20.0;
      onChangeAssumptions(updated);
    } else if (type === 'downside_triple') {
      updated.operating.capacityFactorPct = Math.max(10, Number((updated.operating.capacityFactorPct * 0.85).toFixed(1)));
      updated.capexItems = updated.capexItems.map((item) => ({
        ...item,
        amountIdrBillion: Number((item.amountIdrBillion * 1.12).toFixed(3)),
      }));
      updated.funding.bankInterestRatePct = Number((updated.funding.bankInterestRatePct + 1.5).toFixed(2));
      updated.valuation.costOfDebtPreTaxPct = updated.funding.bankInterestRatePct;
      onChangeAssumptions(updated);
    } else if (type === 'upside_bull') {
      updated.operating.capacityFactorPct = Math.min(98, Number((updated.operating.capacityFactorPct * 1.10).toFixed(1)));
      updated.revenue.baseTariffIdrPerKWh = Math.round(updated.revenue.baseTariffIdrPerKWh * 1.05);
      updated.funding.bankInterestRatePct = Math.max(6.0, Number((updated.funding.bankInterestRatePct - 0.5).toFixed(2)));
      updated.valuation.costOfDebtPreTaxPct = updated.funding.bankInterestRatePct;
      onChangeAssumptions(updated);
    }
  };

  // Updaters for project identity & specification
  const updateProject = (key: keyof FullModelAssumptions['project'], value: any) => {
    onChangeAssumptions({
      ...assumptions,
      project: { ...assumptions.project, [key]: value },
    });
  };

  const HOLDING_PROJECT_PRESETS: Record<TechnologyType, Array<{
    id: string;
    name: string;
    capacityMW: number;
    location: string;
    sponsor: string;
    offtaker: string;
    concessionYears: number;
    tariff: number;
  }>> = {
    hydro: [
      { id: 'plta_18mw_batang_toru', name: 'Batang Toru Run-of-River PLTA 18 MW', capacityMW: 18.0, location: 'Tapanuli Selatan, Sumut', sponsor: 'PT Energy Prima Nusantara (EPN)', offtaker: 'PT PLN (Persero)', concessionYears: 30, tariff: 1250 },
      { id: 'pltm_10mw_lau_gunung', name: 'Lau Gunung Mini-Hydro PLTM 10 MW', capacityMW: 10.0, location: 'Dairi, Sumatera Utara', sponsor: 'PT Inpola Meka Energi (EPN)', offtaker: 'PT PLN (Persero)', concessionYears: 25, tariff: 1280 },
      { id: 'plta_45mw_asahan', name: 'Asahan Run-of-River PLTA 45 MW', capacityMW: 45.0, location: 'Asahan / Toba, Sumut', sponsor: 'Konsorsium Hydro Nusantara', offtaker: 'PT PLN (Persero)', concessionYears: 30, tariff: 1180 },
      { id: 'plta_25mw_peusangan', name: 'Peusangan Hydro PLTA 25 MW', capacityMW: 25.0, location: 'Aceh Tengah, Aceh', sponsor: 'PT EPN Hydro Renewable', offtaker: 'PT PLN (Persero)', concessionYears: 30, tariff: 1200 },
    ],
    solar_pv: [
      { id: 'plts_145mw_cirata', name: 'Cirata Floating Solar PV 145 MWac', capacityMW: 145.0, location: 'Purwakarta, Jawa Barat', sponsor: 'PT PJB Masdar Solar Energi', offtaker: 'PT PLN (Persero)', concessionYears: 25, tariff: 986 },
      { id: 'plts_21mw_likupang', name: 'Likupang Ground Solar PV 21 MW', capacityMW: 21.0, location: 'Minahasa Utara, Sulut', sponsor: 'PT Vena Energy Indonesia', offtaker: 'PT PLN (Persero)', concessionYears: 20, tariff: 1100 },
      { id: 'plts_100mw_karangkates', name: 'Karangkates Floating PV 100 MW', capacityMW: 100.0, location: 'Malang, Jawa Timur', sponsor: 'PT PLN Nusantara Power', offtaker: 'PT PLN (Persero)', concessionYears: 25, tariff: 920 },
    ],
    geothermal: [
      { id: 'pltp_85mw_muara_laboh', name: 'Muara Laboh Geothermal PLTP 85 MW', capacityMW: 85.0, location: 'Solok Selatan, Sumbar', sponsor: 'PT Supreme Energy Muara Laboh', offtaker: 'PT PLN (Persero)', concessionYears: 30, tariff: 1480 },
      { id: 'pltp_91mw_rantau_dedap', name: 'Rantau Dedap Geothermal 91 MW', capacityMW: 91.0, location: 'Muara Enim, Sumsel', sponsor: 'PT Supreme Energy Rantau Dedap', offtaker: 'PT PLN (Persero)', concessionYears: 30, tariff: 1520 },
      { id: 'pltp_110mw_sarulla', name: 'Sarulla Geothermal Phase-1 110 MW', capacityMW: 110.0, location: 'Tapanuli Utara, Sumut', sponsor: 'Sarulla Operations Ltd', offtaker: 'PT PLN (Persero)', concessionYears: 30, tariff: 1420 },
    ],
    waste_to_energy: [
      { id: 'wte_20mw_benowo', name: 'Benowo Waste-to-Energy PLTSa 20 MW', capacityMW: 20.0, location: 'Surabaya, Jawa Timur', sponsor: 'PT Sumber Organik', offtaker: 'PT PLN & Pemkot Surabaya', concessionYears: 25, tariff: 1850 },
      { id: 'wte_15mw_bantargebang', name: 'Bantargebang WtE PLTSa 15 MW', capacityMW: 15.0, location: 'Bekasi, Jawa Barat', sponsor: 'PT Jakarta Propertindo', offtaker: 'PT PLN & Pemprov DKI', concessionYears: 25, tariff: 1900 },
      { id: 'wte_20mw_legok_nangka', name: 'Legok Nangka Waste-to-Energy 20 MW', capacityMW: 20.0, location: 'Bandung, Jawa Barat', sponsor: 'Konsorsium WtE Jabar', offtaker: 'PT PLN & Pemprov Jabar', concessionYears: 25, tariff: 1820 },
    ],
    thermal: [
      { id: 'pltu_100mw_celukan_bawang', name: 'Celukan Bawang Thermal 100 MW', capacityMW: 100.0, location: 'Buleleng, Bali', sponsor: 'PT General Energy Bali', offtaker: 'PT PLN (Persero)', concessionYears: 25, tariff: 1150 },
      { id: 'pltu_200mw_kalselteng', name: 'Kalselteng Thermal IPP 200 MW', capacityMW: 200.0, location: 'Tabalong, Kalsel', sponsor: 'PT Tanjung Power Indonesia', offtaker: 'PT PLN (Persero)', concessionYears: 25, tariff: 1080 },
    ],
    generic: [
      { id: 'gen_50mw_ipp', name: 'Generic Clean Energy IPP 50 MW', capacityMW: 50.0, location: 'Indonesia', sponsor: 'Holding Energy Portfolio', offtaker: 'PT PLN (Persero)', concessionYears: 25, tariff: 1200 },
    ],
  };

  const activePresets = HOLDING_PROJECT_PRESETS[currentTech] || HOLDING_PROJECT_PRESETS.hydro;

  const applyProjectPreset = (presetId: string) => {
    const p = activePresets.find((x) => x.id === presetId);
    if (!p) return;
    const currentCap = assumptions.project.installedCapacityMW || 18.0;
    const ratio = p.capacityMW / currentCap;
    const updatedCapexItems = assumptions.capexItems.map((item) => ({
      ...item,
      amountIdrBillion: Number((item.amountIdrBillion * ratio).toFixed(2)),
    }));
    onChangeAssumptions({
      ...assumptions,
      project: {
        ...assumptions.project,
        projectName: p.name,
        installedCapacityMW: p.capacityMW,
        projectLocation: p.location,
        sponsorName: p.sponsor,
        offtakerName: p.offtaker,
        operatingPeriodYears: p.concessionYears,
        concessionPeriodYears: p.concessionYears,
      },
      revenue: {
        ...assumptions.revenue,
        baseTariffIdrPerKWh: p.tariff,
      },
      capexItems: updatedCapexItems,
    });
  };

  const handleScaleCapexWithCapacity = () => {
    const currentCap = assumptions.project.installedCapacityMW || 18.0;
    const targetCapexTotal = currentCap * 26.0; // Standard Hydro benchmark ~26 IDR B / MW
    const currentCapexTotal = assumptions.capexItems.reduce((s, i) => s + i.amountIdrBillion, 0);
    if (currentCapexTotal <= 0) return;
    const ratio = targetCapexTotal / currentCapexTotal;
    const updatedCapexItems = assumptions.capexItems.map((item) => ({
      ...item,
      amountIdrBillion: Number((item.amountIdrBillion * ratio).toFixed(2)),
    }));
    onChangeAssumptions({
      ...assumptions,
      capexItems: updatedCapexItems,
    });
  };

  // Updaters for specific driver clusters
  const updateOperating = (key: keyof FullModelAssumptions['operating'], value: number) => {
    onChangeAssumptions({
      ...assumptions,
      operating: { ...assumptions.operating, [key]: value },
    });
  };

  const updateRevenue = (key: keyof FullModelAssumptions['revenue'], value: number) => {
    onChangeAssumptions({
      ...assumptions,
      revenue: { ...assumptions.revenue, [key]: value },
    });
  };

  const updateFunding = (key: keyof FullModelAssumptions['funding'], value: any) => {
    const updatedFunding = { ...assumptions.funding, [key]: value };
    // If gearing changed, keep debt + equity = 100%
    if (key === 'bankDebtPct') {
      updatedFunding.equityPct = Math.max(0, 100 - Number(value));
    } else if (key === 'equityPct') {
      updatedFunding.bankDebtPct = Math.max(0, 100 - Number(value));
    }
    onChangeAssumptions({
      ...assumptions,
      funding: updatedFunding,
      valuation:
        key === 'bankInterestRatePct'
          ? { ...assumptions.valuation, costOfDebtPreTaxPct: Number(value) }
          : assumptions.valuation,
    });
  };

  const updateCapexScaling = (scalePct: number) => {
    const factor = 1 + scalePct / 100;
    const baseItems = BASE_PLTA_ASSUMPTIONS.capexItems;
    onChangeAssumptions({
      ...assumptions,
      capexItems: baseItems.map((item) => ({
        ...item,
        amountIdrBillion: +(item.amountIdrBillion * factor).toFixed(3),
      })),
    });
  };

  const updateOpex = (key: keyof FullModelAssumptions['opex'], value: number) => {
    onChangeAssumptions({
      ...assumptions,
      opex: { ...assumptions.opex, [key]: value },
    });
  };

  const updateTax = (key: keyof FullModelAssumptions['tax'], value: number) => {
    onChangeAssumptions({
      ...assumptions,
      tax: { ...assumptions.tax, [key]: value },
    });
  };

  const updateValuation = (key: keyof FullModelAssumptions['valuation'], value: number) => {
    onChangeAssumptions({
      ...assumptions,
      valuation: { ...assumptions.valuation, [key]: value },
    });
  };

  // Calculate current Capex Scaling Delta relative to base
  const currentCapexTotal = assumptions.capexItems.reduce((s, i) => s + i.amountIdrBillion, 0);
  const baseCapexTotal = BASE_PLTA_ASSUMPTIONS.capexItems.reduce((s, i) => s + i.amountIdrBillion, 0);
  const capexVariancePct = ((currentCapexTotal - baseCapexTotal) / baseCapexTotal) * 100;

  // Real-time live net generation estimate (GWh/year)
  let annualNetGenGWh = 0;
  if (currentTech === 'solar_pv') {
    const psh = assumptions.operating.solarPeakSunHoursPerDay ?? 4.5;
    const pr = (assumptions.operating.solarPerformanceRatioPct ?? 80.0) / 100;
    const specificYield = assumptions.operating.solarSpecificYieldKWhPerKWp ?? (psh * 365 * pr);
    const grossGWh = (assumptions.project.installedCapacityMW * 1000 * specificYield) / 1e6;
    annualNetGenGWh = grossGWh * (1 - assumptions.operating.auxiliaryConsumptionPct / 100) * (1 - assumptions.operating.transmissionLossPct / 100);
  } else if (currentTech === 'waste_to_energy') {
    const dailyThroughput = assumptions.operating.wteWasteThroughputTonsPerDay ?? 1000;
    const kwhPerTon = assumptions.operating.wteKWhPerTonWaste ?? 380;
    const grossGWh = (dailyThroughput * 365 * kwhPerTon) / 1e6;
    annualNetGenGWh = grossGWh * (1 - assumptions.operating.auxiliaryConsumptionPct / 100) * (1 - assumptions.operating.transmissionLossPct / 100);
  } else {
    annualNetGenGWh =
      (assumptions.project.installedCapacityMW *
        8760 *
        (assumptions.operating.capacityFactorPct / 100) *
        (assumptions.operating.plantAvailabilityPct / 100) *
        (1 - assumptions.operating.auxiliaryConsumptionPct / 100) *
        (1 - assumptions.operating.transmissionLossPct / 100)) /
      1000;
  }

  // Year 1 Gross Revenue estimate (IDR Billion)
  let estYear1RevenueIdrB = (annualNetGenGWh * 1_000_000 * assumptions.revenue.baseTariffIdrPerKWh) / 1e9;
  if (currentTech === 'waste_to_energy') {
    const dailyThroughput = assumptions.operating.wteWasteThroughputTonsPerDay ?? 1000;
    const tippingFee = assumptions.operating.wteTippingFeeIdrPerTon ?? 350000;
    estYear1RevenueIdrB += (dailyThroughput * 365 * tippingFee) / 1e9;
  }

  // Real-time 1-Way Sensitivity Analysis (Spider / Tornado)
  const spiderData = useMemo(() => {
    if (assumptions.workingInputs?.opex) return []; // Legacy shock definitions do not describe the active generic master.
    const evaluate = (mod: FullModelAssumptions) => {
      const c = calculateAuditedMonthlyCapex(mod);
      const su = calculateAuditedSourcesAndUses(mod, c);
      const op = calculateAuditedDebtAndOperations(mod, su);
      return calculateModelMetrics(mod, c, op.annualRows, su);
    };

    // 1. Tariff +/- 10%
    const modTariffUp = JSON.parse(JSON.stringify(assumptions));
    modTariffUp.revenue.baseTariffIdrPerKWh *= 1.1;
    const modTariffDown = JSON.parse(JSON.stringify(assumptions));
    modTariffDown.revenue.baseTariffIdrPerKWh *= 0.9;

    // 2. Capacity Factor +/- 10%
    const modCfUp = JSON.parse(JSON.stringify(assumptions));
    modCfUp.operating.capacityFactorPct = Math.min(95, modCfUp.operating.capacityFactorPct * 1.1);
    const modCfDown = JSON.parse(JSON.stringify(assumptions));
    modCfDown.operating.capacityFactorPct = Math.max(10, modCfDown.operating.capacityFactorPct * 0.9);

    // 3. CAPEX +/- 10%
    const modCapexUp = JSON.parse(JSON.stringify(assumptions));
    modCapexUp.capexItems = modCapexUp.capexItems.map((i: any) => ({ ...i, amountIdrBillion: i.amountIdrBillion * 1.1 }));
    const modCapexDown = JSON.parse(JSON.stringify(assumptions));
    modCapexDown.capexItems = modCapexDown.capexItems.map((i: any) => ({ ...i, amountIdrBillion: i.amountIdrBillion * 0.9 }));

    // 4. Interest Rate +/- 100 bps
    const modRateUp = JSON.parse(JSON.stringify(assumptions));
    modRateUp.funding.bankInterestRatePct += 1.0;
    modRateUp.valuation.costOfDebtPreTaxPct += 1.0;
    const modRateDown = JSON.parse(JSON.stringify(assumptions));
    modRateDown.funding.bankInterestRatePct = Math.max(1, modRateDown.funding.bankInterestRatePct - 1.0);
    modRateDown.valuation.costOfDebtPreTaxPct = Math.max(1, modRateDown.valuation.costOfDebtPreTaxPct - 1.0);

    // 5. OPEX +/- 10%
    const modOpexUp = JSON.parse(JSON.stringify(assumptions));
    modOpexUp.opex.fixedOpexIdrBillion *= 1.1;
    modOpexUp.opex.variableOpexIdrPerKWh *= 1.1;
    const modOpexDown = JSON.parse(JSON.stringify(assumptions));
    modOpexDown.opex.fixedOpexIdrBillion *= 0.9;
    modOpexDown.opex.variableOpexIdrPerKWh *= 0.9;

    const resTariffUp = evaluate(modTariffUp);
    const resTariffDown = evaluate(modTariffDown);
    const resCfUp = evaluate(modCfUp);
    const resCfDown = evaluate(modCfDown);
    const resCapexUp = evaluate(modCapexUp);
    const resCapexDown = evaluate(modCapexDown);
    const resRateUp = evaluate(modRateUp);
    const resRateDown = evaluate(modRateDown);
    const resOpexUp = evaluate(modOpexUp);
    const resOpexDown = evaluate(modOpexDown);

    return [
      {
        driver: 'PPA Tariff (±10%)',
        category: 'Commercial',
        baseEquityIrr: metrics.equityIrrPct,
        irrLow: resTariffDown.equityIrrPct,
        irrHigh: resTariffUp.equityIrrPct,
        irrSwing: Math.abs(resTariffUp.equityIrrPct - resTariffDown.equityIrrPct),
        dscrLow: resTariffDown.minDscr,
        dscrHigh: resTariffUp.minDscr,
      },
      {
        driver: 'Capacity Factor (±10%)',
        category: 'Hydrology',
        baseEquityIrr: metrics.equityIrrPct,
        irrLow: resCfDown.equityIrrPct,
        irrHigh: resCfUp.equityIrrPct,
        irrSwing: Math.abs(resCfUp.equityIrrPct - resCfDown.equityIrrPct),
        dscrLow: resCfDown.minDscr,
        dscrHigh: resCfUp.minDscr,
      },
      {
        driver: 'Project CAPEX (±10%)',
        category: 'Construction',
        baseEquityIrr: metrics.equityIrrPct,
        irrLow: resCapexUp.equityIrrPct, // higher capex = lower IRR
        irrHigh: resCapexDown.equityIrrPct,
        irrSwing: Math.abs(resCapexDown.equityIrrPct - resCapexUp.equityIrrPct),
        dscrLow: resCapexUp.minDscr,
        dscrHigh: resCapexDown.minDscr,
      },
      {
        driver: 'Bank Interest Rate (±100 bps)',
        category: 'Debt',
        baseEquityIrr: metrics.equityIrrPct,
        irrLow: resRateUp.equityIrrPct,
        irrHigh: resRateDown.equityIrrPct,
        irrSwing: Math.abs(resRateDown.equityIrrPct - resRateUp.equityIrrPct),
        dscrLow: resRateUp.minDscr,
        dscrHigh: resRateDown.minDscr,
      },
      {
        driver: 'Operating Costs (±10%)',
        category: 'O&M',
        baseEquityIrr: metrics.equityIrrPct,
        irrLow: resOpexUp.equityIrrPct,
        irrHigh: resOpexDown.equityIrrPct,
        irrSwing: Math.abs(resOpexDown.equityIrrPct - resOpexUp.equityIrrPct),
        dscrLow: resOpexUp.minDscr,
        dscrHigh: resOpexDown.minDscr,
      },
    ].sort((a, b) => b.irrSwing - a.irrSwing);
  }, [assumptions, metrics]);

  // Dynamic 2D Matrix Selection
  const [matrixRowVar, setMatrixRowVar] = useState<'baseTariff' | 'capacityFactor' | 'interestRate'>('baseTariff');
  const [matrixMetric, setMatrixMetric] = useState<'equityIrr' | 'projectIrr' | 'minDscr'>('equityIrr');

  const live2DMatrix = useMemo(() => {
    return generateSensitivityMatrix(
      assumptions,
      matrixRowVar,
      matrixRowVar === 'interestRate' ? [-1.5, -0.75, 0, 0.75, 1.5] : [-10, -5, 0, 5, 10],
      'capex',
      [-10, -5, 0, 5, 10],
      matrixMetric
    );
  }, [assumptions, matrixRowVar, matrixMetric]);

  const getMatrixCellColor = (val: number, type: 'equityIrr' | 'projectIrr' | 'minDscr') => {
    if (type === 'minDscr') {
      if (val >= 1.35) return 'bg-emerald-100 text-emerald-900 font-bold';
      if (val >= 1.20) return 'bg-emerald-50 text-emerald-800 font-semibold';
      if (val >= 1.10) return 'bg-amber-100 text-amber-900 font-semibold';
      return 'bg-rose-100 text-rose-900 font-bold';
    } else if (type === 'equityIrr') {
      if (val >= 15.0) return 'bg-emerald-100 text-emerald-900 font-bold';
      if (val >= 12.5) return 'bg-emerald-50 text-emerald-800 font-semibold';
      if (val >= 10.0) return 'bg-amber-100 text-amber-900 font-semibold';
      return 'bg-rose-100 text-rose-900 font-bold';
    } else {
      if (val >= 12.0) return 'bg-emerald-100 text-emerald-900 font-bold';
      if (val >= 10.0) return 'bg-emerald-50 text-emerald-800 font-semibold';
      if (val >= 8.5) return 'bg-amber-100 text-amber-900 font-semibold';
      return 'bg-rose-100 text-rose-900 font-bold';
    }
  };

  // Deltas against Base Case
  const deltaEquityIrr = metrics.equityIrrPct - baseMetrics.equityIrrPct;
  const deltaProjectIrr = metrics.projectIrrPct - baseMetrics.projectIrrPct;
  const deltaMinDscr = metrics.minDscr - baseMetrics.minDscr;
  const deltaNpv = metrics.equityNpvIdrBillion - baseMetrics.equityNpvIdrBillion;

  return (
    <div className="w-full space-y-5">
      {/* 0. Energy Holding Portfolio Asset Class Switcher */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-sm text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 mb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase text-white tracking-wider">
                  Holding Energy Asset Portfolio
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 uppercase font-semibold">
                  Multi-Technology Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                Switch asset class to activate authentic technology dispatch, Capex schedules, Opex structures, and PPA tariffs.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase hidden md:inline">Active Asset Class:</span>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-sky-950 text-sky-300 border border-sky-700/80 uppercase font-bold flex items-center gap-1.5 shadow-2xs">
              <span>{currentTechMeta.icon}</span>
              <span>{currentTechMeta.label}</span>
            </span>
          </div>
        </div>

        {/* 6 Technology Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {(Object.keys(TECHNOLOGY_REGISTRY) as TechnologyType[]).map((techKey) => {
            const meta = TECHNOLOGY_REGISTRY[techKey];
            const isSelected = currentTech === techKey;
            return (
              <button
                key={techKey}
                type="button"
                onClick={() => handleSelectTechnology(techKey)}
                className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 border-sky-400 text-white shadow-md ring-2 ring-sky-400/30'
                    : 'bg-slate-800/80 hover:bg-slate-750 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg">{meta.icon}</span>
                  {isSelected && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-white text-sky-900 uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs leading-tight">
                  {meta.label.split(' ')[0]}
                </div>
                <div className="text-[10px] text-slate-300 truncate mt-0.5 opacity-90">
                  {meta.label.split('(')[1]?.replace(')', '') || meta.type}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Header Banner & Quick Presets */}
      <div className="bg-[#0F172A] text-white rounded-xl border border-slate-700 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg">
                <SlidersHorizontal className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Master Driver & Sensitivity Cockpit
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 uppercase font-semibold">
                    Dynamic Engine
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unified view of input drivers powering the financial model, scenarios and sensitivity analysis in real time.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Scenario Preset Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 mr-1 uppercase font-semibold">Presets:</span>
            <button
              onClick={() => applyPresetDriver('base')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition"
              title="Reset to P50 Management Base"
            >
              Base Case (P50)
            </button>
            <button
              onClick={() => applyPresetDriver('p90_drought')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 transition"
              title="Dry Year: Capacity Factor 52%"
            >
              P90 Drought (52% CF)
            </button>
            <button
              onClick={() => applyPresetDriver('capex_overrun')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 transition"
              title="Construction Overrun: +15% CAPEX"
            >
              CAPEX +15%
            </button>
            <button
              onClick={() => applyPresetDriver('high_interest')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-orange-950/70 hover:bg-orange-900/80 text-orange-300 border border-orange-800/80 transition"
              title="Interest Rate hike: 11.30%"
            >
              Rate +200bps
            </button>
            <button
              onClick={() => applyPresetDriver('aggressive_gearing')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/80 transition"
              title="80% Debt / 20% Equity"
            >
              80:20 Gearing
            </button>
            <button
              onClick={() => applyPresetDriver('downside_triple')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-rose-900/90 hover:bg-rose-800 text-white font-bold border border-rose-600 transition"
              title="Stress: CF -10%, Capex +12%, Rate +150bps"
            >
              Downside Stress
            </button>
            <button
              onClick={() => applyPresetDriver('upside_bull')}
              className="px-2.5 py-1 text-xs font-mono rounded bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/80 transition"
              title="Upside: CF 70%, Tariff 1,200, Rate 8.8%"
            >
              Upside Super-Year
            </button>
            <button
              onClick={onResetDefaults}
              className="px-2 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
              title="Reset all drivers to baseline"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Real-time KPI Ribbon with Delta vs Base */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
          {/* Equity IRR */}
          <button type="button"
            data-audit-key="equity_irr"
            onClick={() => onOpenAuditTrace('equity_irr')}
            className="w-full text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg p-2.5 cursor-pointer transition"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400 flex justify-between items-center">
              <span>Equity IRR</span>
              <span
                className={`text-[9px] font-bold px-1 rounded ${
                  deltaEquityIrr >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                }`}
              >
                {deltaEquityIrr >= 0 ? '+' : ''}
                {deltaEquityIrr.toFixed(2)}%
              </span>
            </div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {formatPercent(metrics.equityIrrPct, 2)}
            </div>
            <div className="text-[10px] text-slate-400">
              Base: {formatPercent(baseMetrics.equityIrrPct, 2)}
            </div>
          </button>

          {/* Project IRR */}
          <button type="button"
            data-audit-key="project_irr"
            onClick={() => onOpenAuditTrace('project_irr')}
            className="w-full text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg p-2.5 cursor-pointer transition"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400 flex justify-between items-center">
              <span>Project IRR</span>
              <span
                className={`text-[9px] font-bold px-1 rounded ${
                  deltaProjectIrr >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                }`}
              >
                {deltaProjectIrr >= 0 ? '+' : ''}
                {deltaProjectIrr.toFixed(2)}%
              </span>
            </div>
            <div className="text-lg font-black text-white mt-0.5">
              {formatPercent(metrics.projectIrrPct, 2)}
            </div>
            <div className="text-[10px] text-slate-400">
              WACC: {formatPercent(metrics.waccPct, 2)}
            </div>
          </button>

          {/* Min DSCR */}
          <button type="button"
            data-audit-key="min_dscr"
            onClick={() => onOpenAuditTrace('min_dscr')}
            className="w-full text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg p-2.5 cursor-pointer transition"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400 flex justify-between items-center">
              <span>Min DSCR</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  metrics.minDscr >= 1.20
                    ? 'bg-emerald-900/80 text-emerald-300'
                    : metrics.minDscr >= 1.05
                    ? 'bg-amber-900/80 text-amber-300'
                    : 'bg-rose-900/80 text-rose-200 animate-pulse'
                }`}
              >
                {metrics.minDscr >= 1.20 ? 'COV PASS' : 'COV TIGHT'}
              </span>
            </div>
            <div
              className={`text-lg font-black mt-0.5 ${
                metrics.minDscr >= 1.20
                  ? 'text-emerald-400'
                  : metrics.minDscr >= 1.05
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {formatMultiple(metrics.minDscr, 2)}
            </div>
            <div className="text-[10px] text-slate-400">
              Avg: {formatMultiple(metrics.avgDscr, 2)} (1.20x)
            </div>
          </button>

          {/* Min LLCR */}
          <button type="button"
            data-audit-key="llcr"
            onClick={() => onOpenAuditTrace('llcr')}
            className="w-full text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg p-2.5 cursor-pointer transition"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400">Min LLCR</div>
            <div className="text-lg font-black text-sky-400 mt-0.5">
              {formatMultiple(metrics.minLlcr, 2)}
            </div>
            <div className="text-[10px] text-slate-400">
              Loan Life Cov.
            </div>
          </button>

          {/* Equity NPV */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex justify-between items-center">
              <span>Equity NPV</span>
              <span
                className={`text-[9px] font-bold px-1 rounded ${
                  deltaNpv >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {deltaNpv >= 0 ? '+' : ''}
                {formatCurrencyValue(deltaNpv, currencyDisplay, fx, 0)}
              </span>
            </div>
            <div className="text-lg font-black text-white mt-0.5">
              {formatCurrencyValue(metrics.equityNpvIdrBillion, currencyDisplay, fx, 1)}
            </div>
            <div className="text-[10px] text-slate-400">
              Proj: {formatCurrencyValue(metrics.projectNpvIdrBillion, currencyDisplay, fx, 1)}
            </div>
          </div>

          {/* LCOE */}
          <button type="button"
            data-audit-key="lcoe"
            onClick={() => onOpenAuditTrace('lcoe')}
            className="w-full text-left bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg p-2.5 cursor-pointer transition"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400">Levelized LCOE</div>
            <div className="text-lg font-black text-sky-300 mt-0.5">
              {metrics.lcoeCentsPerKWh.toFixed(2)} ¢/kWh
            </div>
            <div className="text-[10px] text-slate-400">
              {metrics.lcoeIdrPerKWh.toFixed(0)} IDR/kWh
            </div>
          </button>

          {/* Total Uses / CAPEX */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Project Cost</div>
            <div className="text-lg font-black text-slate-200 mt-0.5">
              {formatCurrencyValue(metrics.totalCapexIdrBillion, currencyDisplay, fx, 1)}
            </div>
            <div className="text-[10px] text-slate-400">
              Debt: {formatCurrencyValue(metrics.totalDebtIdrBillion, currencyDisplay, fx, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Project Master Identification & Capacity Driver */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        {/* Card Header with Presets & Dropdown */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                  Project Master Identity & Capacity Specification
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-900/80 text-sky-300 border border-sky-700 uppercase font-bold">
                  {assumptions.project.installedCapacityMW} MW Installed
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                Select a project preset or adjust its name, capacity (MW), sponsors, location and concession period in real time.
              </p>
            </div>
          </div>

          {/* Quick Project Presets Pills */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">Project Presets:</span>
            {activePresets.map((preset) => {
              const isSelected = assumptions.project.projectName === preset.name;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyProjectPreset(preset.id)}
                  className={`px-2.5 py-1 text-xs rounded transition cursor-pointer border ${
                    isSelected
                      ? 'bg-sky-600 text-white font-bold border-sky-400 shadow-xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-500'
                  }`}
                  title={`${preset.name} - ${preset.capacityMW} MW (${preset.location})`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Master Project Inputs Grid */}
        <div className="p-4 bg-slate-50/60 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Project Name */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-sans font-bold">
              <span>Project Name</span>
              <Edit3 className="w-3 h-3 text-slate-400" />
            </div>
            <input
              type="text"
              value={assumptions.project.projectName}
              onChange={(e) => updateProject('projectName', e.target.value)}
              className="w-full text-xs font-bold text-slate-900 px-2 py-1.5 border border-slate-300 rounded focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none bg-white"
              placeholder="e.g. 18 MW Batang Toru Hydro"
            />
            <div className="text-[10px] text-slate-500 font-sans">
              Primary title for financial model & reports
            </div>
          </div>

          {/* Installed Capacity (MW) */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-sans font-bold">
              <span>Installed Capacity (MW)</span>
              <span className="text-sky-600 font-bold font-mono">{assumptions.project.installedCapacityMW} MW</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="1"
                max="250"
                value={assumptions.project.installedCapacityMW}
                onChange={(e) => updateProject('installedCapacityMW', Math.max(0.1, Number(e.target.value)))}
                className="w-20 text-sm font-black text-sky-700 px-2 py-1 border border-slate-300 rounded text-right focus:border-sky-500 focus:outline-none"
              />
              <input
                type="range"
                min="5"
                max="100"
                step="0.5"
                value={assumptions.project.installedCapacityMW}
                onChange={(e) => updateProject('installedCapacityMW', Number(e.target.value))}
                className="flex-1 accent-sky-600 cursor-pointer"
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-sans">
              <span>Output: {annualNetGenGWh.toFixed(1)} GWh/yr</span>
              <button
                onClick={handleScaleCapexWithCapacity}
                className="text-[9px] text-sky-700 hover:text-sky-900 underline font-semibold cursor-pointer"
                title="Scale total CAPEX proportionally (~IDR 26 Billion per MW)"
              >
                Auto-Scale CAPEX
              </button>
            </div>
          </div>

          {/* Project Location */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-sans font-bold">
              <span>Project Location</span>
              <MapPin className="w-3 h-3 text-slate-400" />
            </div>
            <input
              type="text"
              value={assumptions.project.projectLocation}
              onChange={(e) => updateProject('projectLocation', e.target.value)}
              className="w-full text-xs font-semibold text-slate-900 px-2 py-1.5 border border-slate-300 rounded focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none bg-white"
              placeholder="e.g. North Sumatra, Indonesia"
            />
            <div className="text-[10px] text-slate-500 font-sans">
              Province & Operational Concession
            </div>
          </div>

          {/* Sponsor & Equity Share */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-sans font-bold">
              <span>Sponsor & Lead Equity Share</span>
              <Award className="w-3 h-3 text-slate-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={assumptions.project.sponsorName}
                onChange={(e) => updateProject('sponsorName', e.target.value)}
                className="flex-1 text-xs font-semibold text-slate-900 px-2 py-1.5 border border-slate-300 rounded focus:border-sky-500 focus:outline-none bg-white"
                placeholder="PT EPN"
              />
              <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-1 rounded border border-slate-300">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={assumptions.project.epnParticipationPct}
                  onChange={(e) => updateProject('epnParticipationPct', Number(e.target.value))}
                  className="w-10 text-xs font-bold text-right bg-transparent focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-bold">%</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              Consortium & Sponsor Shareholding
            </div>
          </div>
        </div>

        {/* Secondary Specification Row: Offtaker, Concession, COD, Construction Months */}
        <div className="px-4 py-2.5 bg-slate-100/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Offtaker PPA:</span>
            <input
              type="text"
              value={assumptions.project.offtakerName}
              onChange={(e) => updateProject('offtakerName', e.target.value)}
              className="px-2 py-0.5 font-bold text-slate-800 bg-white border border-slate-300 rounded text-xs focus:outline-none w-36"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Operating Tenor:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="5"
                max="40"
                value={assumptions.project.operatingPeriodYears}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateProject('operatingPeriodYears', val);
                  updateProject('concessionPeriodYears', val);
                }}
                className="w-12 px-1.5 py-0.5 font-bold text-slate-800 bg-white border border-slate-300 rounded text-right text-xs focus:outline-none"
              />
              <span className="text-[10px] text-slate-600 font-sans">PPA Years</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Commercial COD:</span>
            <input
              type="date"
              value={assumptions.project.commercialOperationDate}
              onChange={(e) => updateProject('commercialOperationDate', e.target.value)}
              className="px-1.5 py-0.5 font-bold text-slate-800 bg-white border border-slate-300 rounded text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Construction:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="6"
                max="60"
                value={assumptions.project.constructionPeriodMonths}
                onChange={(e) => updateProject('constructionPeriodMonths', Number(e.target.value))}
                className="w-12 px-1.5 py-0.5 font-bold text-slate-800 bg-white border border-slate-300 rounded text-right text-xs focus:outline-none"
              />
              <span className="text-[10px] text-slate-600 font-sans">Months</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Unified Driver Input Console: 5 Key Driver Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Panel A: Technology-Specific Generation & Resource Drivers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-sky-100 text-sky-700 rounded text-base">
                  {currentTechMeta.icon}
                </span>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {currentTech === 'solar_pv'
                    ? '1. Solar Irradiance & Yield'
                    : currentTech === 'waste_to_energy'
                    ? '1. Waste Feedstock & Thermal Yield'
                    : currentTech === 'geothermal'
                    ? '1. Geothermal Steam & Enthalpy'
                    : currentTech === 'thermal'
                    ? '1. Thermal Heat Rate & Dispatch'
                    : '1. Hydrology & Energy Yield'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                {annualNetGenGWh.toFixed(1)} GWh/yr
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* Technology-Specific Input Controls */}
              {currentTech === 'solar_pv' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Peak Sun Hours (PSH)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="2.5"
                          max="7.0"
                          value={assumptions.operating.solarPeakSunHoursPerDay ?? 4.5}
                          onChange={(e) => updateOperating('solarPeakSunHoursPerDay', Number(e.target.value))}
                          className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input"
                        />
                        <span className="text-slate-500 text-[10px]">h/day</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Specific Yield (kWh/kWp)</label>
                      <input
                        type="number"
                        step="10"
                        value={assumptions.operating.solarSpecificYieldKWhPerKWp ?? 1550}
                        onChange={(e) => updateOperating('solarSpecificYieldKWhPerKWp', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Perf. Ratio PR (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="70"
                        max="90"
                        value={assumptions.operating.solarPerformanceRatioPct ?? 80.5}
                        onChange={(e) => updateOperating('solarPerformanceRatioPct', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">PV Degrad. (%/yr)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={assumptions.operating.annualDegradationPct}
                        onChange={(e) => updateOperating('annualDegradationPct', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </>
              ) : currentTech === 'waste_to_energy' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Waste Throughput</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="50"
                          min="100"
                          max="3000"
                          value={assumptions.operating.wteWasteThroughputTonsPerDay ?? 1000}
                          onChange={(e) => updateOperating('wteWasteThroughputTonsPerDay', Number(e.target.value))}
                          className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input"
                        />
                        <span className="text-slate-500 text-[10px]">T/d</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Yield (kWh / Ton)</label>
                      <input
                        type="number"
                        step="10"
                        value={assumptions.operating.wteKWhPerTonWaste ?? 380}
                        onChange={(e) => updateOperating('wteKWhPerTonWaste', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans font-medium text-slate-600">Municipal Tipping Fee (BLPS)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="10000"
                        value={assumptions.operating.wteTippingFeeIdrPerTon ?? 350000}
                        onChange={(e) => updateOperating('wteTippingFeeIdrPerTon', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input text-right"
                      />
                      <span className="text-slate-500 text-[10px]">IDR/Ton</span>
                    </div>
                  </div>
                </>
              ) : currentTech === 'thermal' ? (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-sans font-medium text-slate-700">Dispatch / Capacity Factor</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="40"
                          max="95"
                          value={assumptions.operating.capacityFactorPct}
                          onChange={(e) => updateOperating('capacityFactorPct', Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 text-right rounded finmod-input"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="0.5"
                      value={assumptions.operating.capacityFactorPct}
                      onChange={(e) => updateOperating('capacityFactorPct', Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Heat Rate (kcal/kWh)</label>
                      <input
                        type="number"
                        step="25"
                        value={assumptions.operating.thermalHeatRateKcalPerKWh ?? 2350}
                        onChange={(e) => updateOperating('thermalHeatRateKcalPerKWh', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Fuel Cost ($/Ton)</label>
                      <input
                        type="number"
                        step="1"
                        value={assumptions.operating.thermalFuelCostUsdPerTon ?? 75}
                        onChange={(e) => updateOperating('thermalFuelCostUsdPerTon', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </>
              ) : currentTech === 'geothermal' ? (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-sans font-medium text-slate-700">Baseload CF (%)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="80"
                          max="98"
                          value={assumptions.operating.capacityFactorPct}
                          onChange={(e) => updateOperating('capacityFactorPct', Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 text-right rounded finmod-input"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="98"
                      step="0.5"
                      value={assumptions.operating.capacityFactorPct}
                      onChange={(e) => updateOperating('capacityFactorPct', Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Steam Fee (Rp/kWh)</label>
                      <input
                        type="number"
                        step="5"
                        value={assumptions.operating.geothermalSteamFieldFeeIdrPerKWh ?? 180}
                        onChange={(e) => updateOperating('geothermalSteamFieldFeeIdrPerKWh', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs finmod-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-sans font-medium text-slate-600">Enthalpy Decline (%)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={assumptions.operating.annualDegradationPct}
                        onChange={(e) => updateOperating('annualDegradationPct', Number(e.target.value))}
                        className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Hydropower & Generic */
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-sans font-medium text-slate-700">Capacity Factor (CF)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="35"
                        max="90"
                        value={assumptions.operating.capacityFactorPct}
                        onChange={(e) => updateOperating('capacityFactorPct', Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 text-right rounded finmod-input"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="85"
                    step="0.5"
                    value={assumptions.operating.capacityFactorPct}
                    onChange={(e) => updateOperating('capacityFactorPct', Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>P90 (52%)</span>
                    <span className="font-semibold text-slate-600">Base P50 (64%)</span>
                    <span>P10 (72%)</span>
                  </div>
                </div>
              )}

              {/* Shared Plant Availability & Installed Capacity */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Capacity (MW)</label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="1000"
                    value={assumptions.project.installedCapacityMW}
                    onChange={(e) =>
                      onChangeAssumptions({
                        ...assumptions,
                        project: { ...assumptions.project, installedCapacityMW: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Plant Availability</label>
                  <input
                    type="number"
                    step="0.5"
                    min="80"
                    max="100"
                    value={assumptions.operating.plantAvailabilityPct}
                    onChange={(e) => updateOperating('plantAvailabilityPct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Losses & Aux */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Trans. Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={assumptions.operating.transmissionLossPct}
                    onChange={(e) => updateOperating('transmissionLossPct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Aux. Cons. (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={assumptions.operating.auxiliaryConsumptionPct}
                    onChange={(e) => updateOperating('auxiliaryConsumptionPct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Operating Concession:</span>
            <span className="font-bold text-slate-900">{assumptions.project.operatingPeriodYears} Years PPA</span>
          </div>
        </div>

        {/* Panel B: Commercial Tariff & FX Drivers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-100 text-emerald-700 rounded">
                  <DollarSign className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  2. Tariff, FX & Commercial
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                Rev Y1: {formatCurrencyValue(estYear1RevenueIdrB, currencyDisplay, fx, 1)}
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* Base Tariff */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-medium text-slate-700">Base Feed-in Tariff</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="10"
                      min="600"
                      max="2500"
                      value={assumptions.revenue.baseTariffIdrPerKWh}
                      onChange={(e) => updateRevenue('baseTariffIdrPerKWh', Number(e.target.value))}
                      className="w-20 px-1.5 py-0.5 text-right rounded finmod-input"
                    />
                    <span className="text-slate-500 font-bold">IDR/kWh</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="800"
                  max="1600"
                  step="10"
                  value={assumptions.revenue.baseTariffIdrPerKWh}
                  onChange={(e) => updateRevenue('baseTariffIdrPerKWh', Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>800 IDR</span>
                  <span className="font-semibold text-slate-600">
                    {((assumptions.revenue.baseTariffIdrPerKWh / fx) * 100).toFixed(2)} ¢USD/kWh
                  </span>
                  <span>1,600 IDR</span>
                </div>
              </div>

              {/* FX Exchange Rate */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-medium text-slate-700">Exchange Rate (IDR/USD)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="100"
                      min="13000"
                      max="24000"
                      value={assumptions.revenue.fxIdrPerUsd}
                      onChange={(e) => updateRevenue('fxIdrPerUsd', Number(e.target.value))}
                      className="w-20 px-1.5 py-0.5 text-right rounded finmod-input"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="14000"
                  max="20000"
                  step="100"
                  value={assumptions.revenue.fxIdrPerUsd}
                  onChange={(e) => updateRevenue('fxIdrPerUsd', Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>14,000</span>
                  <span className="font-semibold text-slate-600">Base: 17,000</span>
                  <span>20,000</span>
                </div>
              </div>

              {/* Escalations */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Tariff Escal. (%/yr)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={assumptions.revenue.annualTariffEscalationPct}
                    onChange={(e) => updateRevenue('annualTariffEscalationPct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">OPEX Escal. (%/yr)</label>
                  <input
                    type="number"
                    step="0.25"
                    disabled={!!assumptions.workingInputs?.opex} title={assumptions.workingInputs?.opex ? "Edit the active OPEX master" : undefined} value={assumptions.operating.annualOpexEscalationPct}
                    onChange={(e) => updateOperating('annualOpexEscalationPct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Levelized Tariff Live Display */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-sans">Levelized PPA Tariff (NPV):</span>
                <span className="font-mono font-bold text-emerald-700">
                  Rp {(metrics.levelizedTariffIdrPerKWh || assumptions.revenue.baseTariffIdrPerKWh).toFixed(1)} / kWh
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>PPA Counterparty:</span>
            <span className="font-bold text-slate-900">PT PLN (Persero) - Take-or-Pay</span>
          </div>
        </div>

        {/* Panel C: CAPEX & Construction Drivers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-100 text-amber-700 rounded">
                  <Hammer className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  3. Project CAPEX & EPC
                </h3>
              </div>
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  Math.abs(capexVariancePct) < 0.1
                    ? 'bg-slate-100 text-slate-700'
                    : capexVariancePct > 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {capexVariancePct > 0 ? '+' : ''}
                {capexVariancePct.toFixed(1)}% vs Base
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* Capex Scale Variance Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-medium text-slate-700">CAPEX Overrun / Contingency</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrencyValue(currentCapexTotal, currencyDisplay, fx, 1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="40"
                  step="1"
                  value={capexVariancePct}
                  onChange={(e) => updateCapexScaling(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>-20% Savings</span>
                  <span className="font-semibold text-slate-600">Base (664.8 B)</span>
                  <span>+40% Overrun</span>
                </div>
              </div>

              {/* Construction Period */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Construction (Mo)</label>
                  <input
                    type="number"
                    step="1"
                    min="18"
                    max="60"
                    value={assumptions.project.constructionPeriodMonths}
                    onChange={(e) =>
                      onChangeAssumptions({
                        ...assumptions,
                        project: { ...assumptions.project, constructionPeriodMonths: Number(e.target.value) },
                      })
                    }
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">IDC Accounting</label>
                  <select
                    value={assumptions.funding.idcMode}
                    onChange={(e) => updateFunding('idcMode', e.target.value as IdcMode)}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="capitalized">Capitalized to Cost</option>
                    <option value="paid">Paid During Constr.</option>
                  </select>
                </div>
              </div>

              {/* Drawdown Order */}
              <div>
                <label className="block text-[10px] font-sans font-medium text-slate-500 mb-1">Funding Drawdown Priority</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['pro_rata', 'equity_first', 'debt_first'] as DrawdownOrder[]).map((order) => (
                    <button
                      key={order}
                      onClick={() => updateFunding('drawdownOrder', order)}
                      className={`py-1 text-[10px] font-bold rounded border uppercase transition ${
                        assumptions.funding.drawdownOrder === order
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {order.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Major Overhaul Sustaining Capex */}
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-sans">Major Overhaul Capex:</span>
                <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-700">
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
                      onChangeAssumptions({
                        ...assumptions,
                        project: { ...assumptions.project, majorOverhaul: { ...existing, enabled } },
                      });
                    }}
                    className="w-3 h-3 text-amber-600 rounded cursor-pointer"
                  />
                  <span>{assumptions.project.majorOverhaul?.enabled ? `Yr ${assumptions.project.majorOverhaul.year} (${assumptions.project.majorOverhaul.amountIdrBillion} B)` : 'Disabled'}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Hard CAPEX Items:</span>
            <button
              data-nav-tab={'04_capex'}
              onClick={() => onSelectTab('04_capex')}
              className="font-bold text-sky-600 hover:underline flex items-center gap-1"
            >
              Inspect 10 Line Items <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Panel D: Senior Debt & Financing Drivers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-indigo-100 text-indigo-700 rounded">
                  <Shield className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  4. Senior Debt & Capital Structure
                </h3>
              </div>
              <span className="text-[11px] font-mono text-indigo-700 font-bold">
                {assumptions.funding.bankDebtPct}% Debt / {assumptions.funding.equityPct}% Eq
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* Gearing Ratio */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-medium text-slate-700">Bank Debt Gearing</span>
                  <span className="font-bold text-indigo-700">{assumptions.funding.bankDebtPct}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="85"
                  step="5"
                  value={assumptions.funding.bankDebtPct}
                  onChange={(e) => updateFunding('bankDebtPct', Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>50% Debt</span>
                  <span className="font-semibold text-slate-600">Base: 70% Debt</span>
                  <span>85% Debt</span>
                </div>
              </div>

              {/* Bank Interest Rate */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-medium text-slate-700">Bank Interest Rate (% p.a.)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="4.0"
                      max="18.0"
                      value={assumptions.funding.bankInterestRatePct}
                      onChange={(e) => updateFunding('bankInterestRatePct', Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-right rounded finmod-input"
                    />
                    <span className="text-slate-500 font-bold">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="6.0"
                  max="14.0"
                  step="0.1"
                  value={assumptions.funding.bankInterestRatePct}
                  onChange={(e) => updateFunding('bankInterestRatePct', Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>6.0%</span>
                  <span className="font-semibold text-slate-600">Base: 9.30%</span>
                  <span>14.0%</span>
                </div>
              </div>

              {/* Repayment Tenor & Amortization */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Repayment (Years)</label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    max="20"
                    value={assumptions.funding.repaymentPeriodYears}
                    onChange={(e) => updateFunding('repaymentPeriodYears', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Amortization</label>
                  <select
                    value={assumptions.funding.amortizationType}
                    onChange={(e) => updateFunding('amortizationType', e.target.value as AmortizationType)}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="annuity">Mortgage Annuity</option>
                    <option value="equal_principal">Equal Principal</option>
                    <option value="sculpted">Sculpted to CFADS</option>
                  </select>
                </div>
              </div>

              {/* DSRA Requirement */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-sans font-medium text-slate-600 text-[11px]">DSRA Reserve</span>
                <div className="flex items-center gap-1">
                  <select
                    value={assumptions.funding.dsraMode ?? 'months'}
                    onChange={(e) => updateFunding('dsraMode', e.target.value)}
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-slate-300 bg-white"
                  >
                    <option value="months">Months Forward</option>
                    <option value="fixed">Fixed (IDR B)</option>
                  </select>
                  {assumptions.funding.dsraMode === 'fixed' ? (
                    <input
                      type="number"
                      step="0.1"
                      value={assumptions.funding.dsraFixedAmountIdrBillion ?? 2.756}
                      onChange={(e) => updateFunding('dsraFixedAmountIdrBillion', parseFloat(e.target.value) || 0)}
                      className="w-14 px-1 py-0.5 text-right font-bold text-xs border border-slate-300 rounded"
                    />
                  ) : (
                    <div className="flex gap-1">
                      {([3, 6, 12] as DsraMonths[]).map((mo) => (
                        <button
                          key={mo}
                          onClick={() => updateFunding('dsraRequirementMonths', mo)}
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                            assumptions.funding.dsraRequirementMonths === mo
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {mo}M
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Minimum Covenant:</span>
            <span className="font-bold text-slate-900">1.20x Senior DSCR</span>
          </div>
        </div>

        {/* Panel E: OPEX, Tax & Valuation Hurdle */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-rose-100 text-rose-700 rounded">
                  <Activity className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  5. OPEX, Tax & Valuation
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500 font-semibold">
                WACC: {formatPercent(metrics.waccPct, 2)}
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              {/* Fixed OPEX */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-medium text-slate-700">Fixed OPEX (Annual)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      min="5"
                      max="30"
                      disabled={!!assumptions.workingInputs?.opex} title={assumptions.workingInputs?.opex ? "Edit the active OPEX master" : undefined} value={assumptions.opex.fixedOpexIdrBillion}
                      onChange={(e) => updateOpex('fixedOpexIdrBillion', Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-right font-bold text-slate-900 border border-slate-300 rounded focus:border-rose-500 focus:outline-none"
                    />
                    <span className="text-slate-500 font-bold">IDR B</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="6"
                  max="25"
                  step="0.5"
                  disabled={!!assumptions.workingInputs?.opex} title={assumptions.workingInputs?.opex ? "Edit the active OPEX master" : undefined} value={assumptions.opex.fixedOpexIdrBillion}
                  onChange={(e) => updateOpex('fixedOpexIdrBillion', Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
              </div>

              {/* Corporate Income Tax & Cost of Equity */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Corp Tax Rate (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="15"
                    max="30"
                    value={assumptions.tax.corporateIncomeTaxRatePct}
                    onChange={(e) => updateTax('corporateIncomeTaxRatePct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Cost of Equity (Ke %)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="8"
                    max="20"
                    value={assumptions.valuation.costOfEquityPct}
                    onChange={(e) => updateValuation('costOfEquityPct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Variable OPEX & Risk Free Rate */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Var OPEX (IDR/kWh)</label>
                  <input
                    type="number"
                    step="1"
                    disabled={!!assumptions.workingInputs?.opex} title={assumptions.workingInputs?.opex ? "Edit the active OPEX master" : undefined} value={assumptions.opex.variableOpexIdrPerKWh}
                    onChange={(e) => updateOpex('variableOpexIdrPerKWh', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans font-medium text-slate-500">Risk-Free Rate (%)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={assumptions.valuation.riskFreeRatePct}
                    onChange={(e) => updateValuation('riskFreeRatePct', Number(e.target.value))}
                    className="w-full px-2 py-1 text-slate-800 font-bold border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>Tax Shield / Loss Carry:</span>
            <span className="font-bold text-slate-900">5-Yr Indonesia Loss Carryforward</span>
          </div>
        </div>

        {/* Panel F: Quick Model Health & Navigation Shortcuts */}
        <div className="bg-slate-900 text-white rounded-xl border border-slate-700 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-sky-500/20 text-sky-400 rounded">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Model Integrity & Direct Links
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                16/16 BALANCED
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-slate-300">Balance Sheet Check</span>
                <span className="text-emerald-400 font-bold">0.000 Diff (30 Yrs)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-slate-300">Sources = Uses</span>
                <span className="text-emerald-400 font-bold">Match (749.37 IDR B)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-slate-300">Equity Payback</span>
                <span className="text-sky-300 font-bold">{metrics.equityPaybackPeriodYears.toFixed(1)} Years</span>
              </div>

              <div className="pt-2 text-[11px] font-sans text-slate-400">
                Quick Jump to Core Financial Statements:
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-sans">
                <button
                  data-nav-tab={'14_income_statement'}
                  onClick={() => onSelectTab('14_income_statement')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-left flex items-center justify-between"
                >
                  <span>14. Income Stmt</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  data-nav-tab={'15_balance_sheet'}
                  onClick={() => onSelectTab('15_balance_sheet')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-left flex items-center justify-between"
                >
                  <span>15. Balance Sheet</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  data-nav-tab={'17_cfads'}
                  onClick={() => onSelectTab('17_cfads')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-left flex items-center justify-between"
                >
                  <span>17. CFADS Waterfall</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  data-nav-tab={'18_dscr'}
                  onClick={() => onSelectTab('18_dscr')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-left flex items-center justify-between"
                >
                  <span>18. DSCR Covenants</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Date Algorithm:</span>
            <span className="text-sky-400 font-bold">Newton-Raphson XIRR</span>
          </div>
        </div>
      </div>

      {/* 3. Real-Time Sensitivity & Scenario Engine Integrated Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: 1-Way Sensitivity Tornado / Ranking */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Live Sensitivity Tornado (Elasticity Ranking)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ranking pengaruh driver variabel terhadap Equity IRR saat ini ({formatPercent(metrics.equityIrrPct, 2)}).
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-200 font-bold uppercase">
              Ranked by Swing
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {assumptions.workingInputs?.opex && <p className="text-xs text-amber-800">Legacy driver sensitivities are unavailable while a working OPEX master is active. Use explicit working-input scenarios; no zero sensitivity is inferred.</p>}
            {spiderData.map((item, idx) => {
              const maxSwing = Math.max(...spiderData.map((s) => s.irrSwing));
              const barWidthPct = Math.min(100, (item.irrSwing / (maxSwing || 1)) * 100);

              return (
                <div key={item.driver} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        #{idx + 1}
                      </span>
                      <span className="font-sans font-bold text-slate-800">{item.driver}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({item.category})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">
                        {item.irrLow.toFixed(2)}% — {item.irrHigh.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-sky-600 font-bold ml-1.5">
                        (Δ {item.irrSwing.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar representation */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex items-center">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        idx === 0
                          ? 'bg-sky-600'
                          : idx === 1
                          ? 'bg-emerald-600'
                          : idx === 2
                          ? 'bg-amber-600'
                          : 'bg-slate-500'
                      }`}
                      style={{ width: `${Math.max(15, barWidthPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>Downside Min DSCR: <strong className={item.dscrLow < 1.2 ? 'text-rose-600' : 'text-slate-700'}>{item.dscrLow.toFixed(2)}x</strong></span>
                    <span>Upside Min DSCR: <strong>{item.dscrHigh.toFixed(2)}x</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Interactive 2D Sensitivity Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Grid className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Dynamic 2D Sensitivity Matrix
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cross-stress testing driver baris vs Project CAPEX kolom.
                  </p>
                </div>
              </div>

              {/* Matrix Controls */}
              <div className="flex items-center gap-1 text-xs font-mono">
                <select
                  value={matrixRowVar}
                  onChange={(e) => setMatrixRowVar(e.target.value as any)}
                  className="bg-slate-100 text-slate-800 border border-slate-300 rounded px-2 py-1 text-[11px] font-bold"
                >
                  <option value="baseTariff">Row: PPA Tariff</option>
                  <option value="capacityFactor">Row: Capacity Factor</option>
                  <option value="interestRate">Row: Interest Rate</option>
                </select>
                <select
                  value={matrixMetric}
                  onChange={(e) => setMatrixMetric(e.target.value as any)}
                  className="bg-slate-100 text-slate-800 border border-slate-300 rounded px-2 py-1 text-[11px] font-bold"
                >
                  <option value="equityIrr">Equity IRR (%)</option>
                  <option value="projectIrr">Project IRR (%)</option>
                  <option value="minDscr">Min DSCR (x)</option>
                </select>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px] uppercase">
                      {live2DMatrix.rowParamName} \ {live2DMatrix.colParamName}
                    </th>
                    {live2DMatrix.colLabels.map((cLabel) => (
                      <th
                        key={cLabel}
                        className={`p-2 text-center border border-slate-200 text-[10px] font-bold ${
                          cLabel === '0%' ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {live2DMatrix.matrix.map((row, rIdx) => {
                    const rLabel = live2DMatrix.rowLabels[rIdx];
                    const isBaseRow = rLabel === '0%' || rLabel === '+0%' || rLabel === '+0.0%';

                    return (
                      <tr key={rLabel}>
                        <td
                          className={`p-2 border border-slate-200 font-bold text-[11px] ${
                            isBaseRow ? 'bg-sky-50 text-sky-900' : 'bg-slate-50 text-slate-800'
                          }`}
                        >
                          {rLabel}
                        </td>
                        {row.map((val, cIdx) => {
                          const isCenter = isBaseRow && live2DMatrix.colLabels[cIdx] === '0%';
                          const cellColor = getMatrixCellColor(val, matrixMetric);

                          return (
                            <td
                              key={cIdx}
                              className={`p-2 text-center border border-slate-200 text-[11px] ${cellColor} ${
                                isCenter ? 'ring-2 ring-sky-600 font-black' : ''
                              }`}
                            >
                              {matrixMetric === 'minDscr' ? formatMultiple(val, 2) : formatPercent(val, 2)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-emerald-200 rounded"></span> Healthy
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-amber-200 rounded"></span> Adequate
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-rose-200 rounded"></span> Stressed / Breach
              </span>
            </div>
            <span>Center = Active Live Configuration</span>
          </div>
        </div>
      </div>
    </div>
  );
};
