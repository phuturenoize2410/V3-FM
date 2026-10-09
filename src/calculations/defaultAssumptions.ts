import { FullModelAssumptions, TechnologyType } from '../types';

export interface TechnologyMeta {
  type: TechnologyType;
  label: string;
  icon: string;
  shortDesc: string;
  componentCLabel: string;
  generationBasis: string;
}

export const TECHNOLOGY_REGISTRY: Record<TechnologyType, TechnologyMeta> = {
  hydro: {
    type: 'hydro',
    label: 'PLTA (Hydropower)',
    icon: '💧',
    shortDesc: 'Run-of-river & reservoir, Francis/Pelton turbines, water resource levy (BJPSDA)',
    componentCLabel: 'Component C: Water Levy (BJPSDA)',
    generationBasis: 'Hydrology Flow & Head',
  },
  solar_pv: {
    type: 'solar_pv',
    label: 'PLTS (Solar PV)',
    icon: '☀️',
    shortDesc: 'Ground-mount & floating solar PV, specific yield (kWh/kWp), PSH & PV degradation',
    componentCLabel: 'Component C: Water Body / Land Lease',
    generationBasis: 'Solar Irradiance & PSH',
  },
  geothermal: {
    type: 'geothermal',
    label: 'PLTP (Geothermal)',
    icon: '🌋',
    shortDesc: 'High baseload CF (90-95%), make-up well sustaining capex, steam field resource fee',
    componentCLabel: 'Component C: Steam Field Resource Fee',
    generationBasis: 'Steam Reservoir Enthalpy',
  },
  waste_to_energy: {
    type: 'waste_to_energy',
    label: 'WtE (Waste to Energy / PLTSa)',
    icon: '♻️',
    shortDesc: 'Dual revenue stream: Electricity PPA + Municipal Tipping Fee (BLPS), waste throughput',
    componentCLabel: 'Component C: Ash Disposal & Residue Fee',
    generationBasis: 'Municipal Waste Throughput',
  },
  thermal: {
    type: 'thermal',
    label: 'PLTU (Thermal IPP)',
    icon: '🏭',
    shortDesc: 'Baseload thermal, heat rate (kcal/kWh), fuel pass-through Component C, carbon tax',
    componentCLabel: 'Component C: Fuel Pass-Through & Carbon Charge',
    generationBasis: 'Calorific Heat Rate & Dispatch',
  },
  generic: {
    type: 'generic',
    label: 'Generic Clean IPP',
    icon: '⚡',
    shortDesc: 'Universal power generation dispatch and project finance structure',
    componentCLabel: 'Component C: Resource / Concession Levy',
    generationBasis: 'Contracted Dispatch Factor',
  },
};

// ============================================================================
// 1. PLTA (HYDROPOWER) - BASE REFERENCE PROJECT
// Batang Toru Run-of-River PLTA 18 MW
// ============================================================================
export const BASE_PLTA_ASSUMPTIONS: FullModelAssumptions = {
  project: {
    technology: 'hydro',
    projectName: 'Batang Toru Run-of-River PLTA 18 MW',
    installedCapacityMW: 18.0,
    numberOfUnits: 2, // 2 x 9.0 MW Francis turbines
    constructionStartDate: '2025-01-01',
    codDate: '2027-07-01',
    constructionPeriodMonths: 30, // 2.5 years
    operatingPeriodYears: 30, // 30-year concession
    epnParticipationPct: 70.0,
    otherSponsorParticipationPct: 30.0,
    majorOverhaul: {
      enabled: false,
      year: 15,
      amountIdrBillion: 26.371,
      depreciationYears: 15,
    },
  },
  operating: {
    capacityFactorPct: 64.0, // Base sample: 64%
    plantAvailabilityPct: 98.0,
    transmissionLossPct: 4.8, // Base sample: 4.8%
    auxiliaryConsumptionPct: 1.2,
    annualDegradationPct: 0.15,
    annualOpexEscalationPct: 2.5,
  },
  revenue: {
    baseTariffIdrPerKWh: 1250.0, // ~7.35 cUSD/kWh at 17,000 FX (Standard PLN Hydro PPA)
    fxIdrPerUsd: 17000.0, // Base sample: 17,000 IDR/USD
    annualTariffEscalationPct: 2.0,
    tariffComponents: {
      useComponents: false, // Default to blended scalar to ensure zero-drift backwards compatibility
      componentA_CapitalRecoveryIdrPerKWh: 850.0, // Component A: Capital Recovery (Capex / Debt Service & ROE)
      componentB_FixedOpexIdrPerKWh: 230.0,       // Component B: Fixed O&M Charge
      componentC_WaterLevyIdrPerKWh: 70.0,        // Component C: Water Resource Fee (BJPSDA)
      componentD_VariableOpexIdrPerKWh: 100.0,    // Component D: Variable O&M Charge
      componentE_TaxAdjustmentIdrPerKWh: 0.0,     // Component E: Tax / Fiscal Adjustment Charge
      componentAEscalationPct: 0.0,               // Typically fixed or 0% for capital recovery
      componentBEscalationPct: 2.5,               // Escalated with CPI / general inflation
      componentCEscalationPct: 2.0,               // Water resource fee escalation
      componentDEscalationPct: 2.0,               // Variable O&M escalation
      componentEEscalationPct: 2.0,
      componentADegressionAfterLoan: true,        // Degressive post-debt repayment
      componentADegressionPct: 50.0,              // 50% reduction in Component A after debt is retired
      componentEDegressionAfterLoan: true,
      componentEDegressionPct: 50.0,
      twoTierEnabled: false,
      tier1DurationYears: 10,
      tier1TariffIdrPerKWh: 1250.0,
      tier2TariffIdrPerKWh: 1050.0,
      levelizedDiscountRatePct: 6.0,
    },
  },
  capexItems: [
    {
      id: 'epc_civil',
      name: 'EPC Civil Works (Weir, Headrace Tunnel, Surge Tank, Powerhouse)',
      category: 'civil',
      amountIdrBillion: 301.479,
      startMonth: 1,
      endMonth: 28,
      curve: 's_curve',
      usefulLifeYears: 30,
    },
    {
      id: 'epc_em',
      name: 'Electro-Mechanical Equipment (Turbines, Generators, Transformers)',
      category: 'em',
      amountIdrBillion: 214.385,
      startMonth: 8,
      endMonth: 29,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'transmission',
      name: 'Interconnection Substation & 150 kV Transmission Line',
      category: 'transmission',
      amountIdrBillion: 53.596,
      startMonth: 14,
      endMonth: 28,
      curve: 'linear',
      usefulLifeYears: 30,
    },
    {
      id: 'dev_cost',
      name: 'Project Development, Feasibility, Land Acquisition & EIA/AMDAL',
      category: 'dev',
      amountIdrBillion: 26.798,
      startMonth: 1,
      endMonth: 12,
      curve: 'linear',
      usefulLifeYears: 30,
    },
    {
      id: 'pre_op',
      name: 'Pre-Operating, Testing & Commissioning Expenses',
      category: 'pre_op',
      amountIdrBillion: 16.749,
      startMonth: 20,
      endMonth: 30,
      curve: 'linear',
      usefulLifeYears: 10,
    },
    {
      id: 'owners_eng',
      name: "Owner's Engineer & Project Management Consultancy",
      category: 'owners',
      amountIdrBillion: 16.749,
      startMonth: 1,
      endMonth: 30,
      curve: 'linear',
      usefulLifeYears: 30,
    },
    {
      id: 'contingency',
      name: 'Physical & Unforeseen Contingency (5.0%)',
      category: 'contingency',
      amountIdrBillion: 33.498,
      startMonth: 1,
      endMonth: 30,
      curve: 's_curve',
      usefulLifeYears: 30,
    },
    {
      id: 'working_cap',
      name: 'Initial Operating Working Capital Seed',
      category: 'working_capital',
      amountIdrBillion: 6.699,
      startMonth: 29,
      endMonth: 30,
      curve: 'linear',
      usefulLifeYears: 0,
    },
  ],
  funding: {
    bankDebtPct: 70.0, // Base sample: 70%
    equityPct: 30.0, // Base sample: 30%
    shareholderLoanPct: 0.0,
    bankInterestRatePct: 9.3, // Base sample: 9.3%
    upfrontFeePct: 1.0,
    commitmentFeePct: 0.5,
    gracePeriodMonths: 30, // Co-terminus with construction
    repaymentPeriodYears: 15, // Standard hydro project finance tenor: 15 years
    amortizationType: 'annuity', // Mortgage style annuity debt service
    targetDscrForSculpting: 1.30,
    covenantDscrBenchmark: 1.20, // Configurable Lender Covenant Benchmark (default >= 1.20x)
    idcMode: 'capitalized', // 'capitalized' or 'paid'
    dsraRequirementMonths: 6, // 6 months of forward debt service
    dsraMode: 'months',
    dsraFixedAmountIdrBillion: 2.756,
    minimumCashBufferBillion: 5.0,
  },
  tax: {
    corporateIncomeTaxRatePct: 22.0, // Standard Indonesian CIT
    vatRatePct: 11.0,
    withholdingTaxDividendsPct: 10.0,
    withholdingTaxInterestPct: 15.0,
    taxLossCarryForwardYears: 5,
    fiscalDepreciationRateBuildingsPct: 5.0, // 20 years SL
    fiscalDepreciationRateEquipmentPct: 12.5, // Group 2 or 3
  },
  valuation: {
    costOfEquityPct: 12.0,
    riskFreeRatePct: 6.5,
    equityRiskPremiumPct: 5.5,
    beta: 1.0,
    costOfDebtPreTaxPct: 9.3,
  },
  opex: {
    fixedOpexIdrBillion: 11.5,
    variableOpexIdrPerKWh: 18.0,
    insurancePctOfCapex: 0.35,
    landWaterChargesIdrBillion: 3.2,
    adminEmployeesIdrBillion: 6.8,
    maintenanceReserveIdrBillion: 2.0,
  },
};

// ============================================================================
// 2. PLTS (SOLAR PV) - FLOATING & GROUND UTILITY SCALE
// Cirata Floating Solar PV 145 MWac
// ============================================================================
export const BASE_PLTS_ASSUMPTIONS: FullModelAssumptions = {
  project: {
    technology: 'solar_pv',
    projectName: 'Cirata Floating Solar PV 145 MWac',
    installedCapacityMW: 145.0,
    numberOfUnits: 13, // 13 inverter array blocks
    constructionStartDate: '2025-01-01',
    codDate: '2026-07-01',
    constructionPeriodMonths: 18, // 1.5 years rapid EPC
    operatingPeriodYears: 25, // 25-year standard solar PPA
    epnParticipationPct: 51.0,
    otherSponsorParticipationPct: 49.0,
    majorOverhaul: {
      enabled: true,
      year: 12,
      amountIdrBillion: 110.0, // Inverter central replacement at Year 12
      depreciationYears: 13,
    },
  },
  operating: {
    capacityFactorPct: 17.7,
    plantAvailabilityPct: 99.0,
    transmissionLossPct: 2.5,
    auxiliaryConsumptionPct: 0.8,
    annualDegradationPct: 0.50, // Tier-1 Bloomberg PV degradation 0.5%/yr
    annualOpexEscalationPct: 2.5,
    solarSpecificYieldKWhPerKWp: 1550, // 1,550 kWh/kWp/year
    solarPeakSunHoursPerDay: 4.5,
    solarPerformanceRatioPct: 80.5,
  },
  revenue: {
    baseTariffIdrPerKWh: 986.0, // ~5.8 cUSD/kWh (Cirata Benchmark PPA)
    fxIdrPerUsd: 17000.0,
    annualTariffEscalationPct: 0.0, // Fixed USD-indexed flat tariff
    tariffComponents: {
      useComponents: false,
      componentA_CapitalRecoveryIdrPerKWh: 720.0,
      componentB_FixedOpexIdrPerKWh: 150.0,
      componentC_WaterLevyIdrPerKWh: 60.0, // Reservoir surface anchoring & lease fee
      componentD_VariableOpexIdrPerKWh: 56.0,
      componentE_TaxAdjustmentIdrPerKWh: 0.0,
      componentAEscalationPct: 0.0,
      componentBEscalationPct: 2.5,
      componentCEscalationPct: 2.0,
      componentDEscalationPct: 2.0,
      componentEEscalationPct: 2.0,
      componentADegressionAfterLoan: false,
      componentADegressionPct: 0.0,
      componentEDegressionAfterLoan: false,
      componentEDegressionPct: 0.0,
      twoTierEnabled: false,
      tier1DurationYears: 10,
      tier1TariffIdrPerKWh: 986.0,
      tier2TariffIdrPerKWh: 800.0,
      levelizedDiscountRatePct: 6.0,
    },
  },
  capexItems: [
    {
      id: 'pv_modules',
      name: 'Tier-1 Bifacial Solar PV Modules (TOPCon / HJT)',
      category: 'em',
      amountIdrBillion: 850.0,
      startMonth: 4,
      endMonth: 16,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'floating_anchoring',
      name: 'High-Density HDPE Floaters, Mooring Lines & Anchoring Grid',
      category: 'civil',
      amountIdrBillion: 380.0,
      startMonth: 2,
      endMonth: 15,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'inverters_transformers',
      name: 'Central Inverters, MV Step-Up Transformers & SCADA',
      category: 'em',
      amountIdrBillion: 210.0,
      startMonth: 6,
      endMonth: 17,
      curve: 'linear',
      usefulLifeYears: 15,
    },
    {
      id: 'substation_grid',
      name: '150 kV Step-Up Substation & Overhead Grid Interconnection Line',
      category: 'transmission',
      amountIdrBillion: 145.0,
      startMonth: 3,
      endMonth: 16,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'dev_eia',
      name: 'Bathymetry, Geotechnical Surveys, AMDAL/ESIA & Permitting',
      category: 'dev',
      amountIdrBillion: 65.0,
      startMonth: 1,
      endMonth: 8,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'owners_pm',
      name: "Owner's Engineer, Project Management & Site Security",
      category: 'owners',
      amountIdrBillion: 45.0,
      startMonth: 1,
      endMonth: 18,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'contingency',
      name: 'Physical Contingency (5%)',
      category: 'contingency',
      amountIdrBillion: 85.0,
      startMonth: 1,
      endMonth: 18,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'working_cap',
      name: 'Initial Operating Working Capital Seed',
      category: 'working_capital',
      amountIdrBillion: 25.0,
      startMonth: 17,
      endMonth: 18,
      curve: 'linear',
      usefulLifeYears: 0,
    },
  ],
  funding: {
    bankDebtPct: 75.0,
    equityPct: 25.0,
    shareholderLoanPct: 0.0,
    bankInterestRatePct: 8.5, // Climate concessional green loan
    upfrontFeePct: 1.0,
    commitmentFeePct: 0.5,
    gracePeriodMonths: 18,
    repaymentPeriodYears: 15,
    amortizationType: 'annuity',
    targetDscrForSculpting: 1.25,
    covenantDscrBenchmark: 1.15,
    idcMode: 'capitalized',
    dsraRequirementMonths: 6,
    dsraMode: 'months',
    dsraFixedAmountIdrBillion: 12.0,
    minimumCashBufferBillion: 8.0,
  },
  tax: {
    corporateIncomeTaxRatePct: 22.0,
    vatRatePct: 11.0,
    withholdingTaxDividendsPct: 10.0,
    withholdingTaxInterestPct: 15.0,
    taxLossCarryForwardYears: 5,
    fiscalDepreciationRateBuildingsPct: 5.0,
    fiscalDepreciationRateEquipmentPct: 12.5,
  },
  valuation: {
    costOfEquityPct: 11.5,
    riskFreeRatePct: 6.5,
    equityRiskPremiumPct: 5.0,
    beta: 0.95,
    costOfDebtPreTaxPct: 8.5,
  },
  opex: {
    fixedOpexIdrBillion: 16.5,
    variableOpexIdrPerKWh: 6.5,
    insurancePctOfCapex: 0.30,
    landWaterChargesIdrBillion: 4.5,
    adminEmployeesIdrBillion: 5.5,
    maintenanceReserveIdrBillion: 3.0,
  },
};

// ============================================================================
// 3. PLTP (GEOTHERMAL / PANAS BUMI)
// Muara Laboh Geothermal PLTP 85 MW
// ============================================================================
export const BASE_PLTP_ASSUMPTIONS: FullModelAssumptions = {
  project: {
    technology: 'geothermal',
    projectName: 'Muara Laboh Geothermal PLTP 85 MW',
    installedCapacityMW: 85.0,
    numberOfUnits: 1, // 1 x 85 MW condensing steam turbine
    constructionStartDate: '2025-01-01',
    codDate: '2028-07-01',
    constructionPeriodMonths: 42, // 3.5 years (deep drilling & steam field)
    operatingPeriodYears: 30,
    epnParticipationPct: 60.0,
    otherSponsorParticipationPct: 40.0,
    majorOverhaul: {
      enabled: true,
      year: 10,
      amountIdrBillion: 280.0, // Make-up well drilling Capex
      depreciationYears: 10,
    },
  },
  operating: {
    capacityFactorPct: 92.0, // Very high baseload CF
    plantAvailabilityPct: 96.0,
    transmissionLossPct: 2.0,
    auxiliaryConsumptionPct: 4.5, // High aux for reinjection pumps & cooling towers
    annualDegradationPct: 0.10, // Reservoir pressure / enthalpy decline
    annualOpexEscalationPct: 2.5,
    geothermalSteamFieldFeeIdrPerKWh: 180.0,
  },
  revenue: {
    baseTariffIdrPerKWh: 1480.0, // ~8.7 cUSD/kWh (Standard PLN Geothermal PPA)
    fxIdrPerUsd: 17000.0,
    annualTariffEscalationPct: 1.5,
    tariffComponents: {
      useComponents: false,
      componentA_CapitalRecoveryIdrPerKWh: 950.0,
      componentB_FixedOpexIdrPerKWh: 220.0,
      componentC_WaterLevyIdrPerKWh: 180.0, // Steam Field Resource Royalty / Fee
      componentD_VariableOpexIdrPerKWh: 130.0,
      componentE_TaxAdjustmentIdrPerKWh: 0.0,
      componentAEscalationPct: 0.0,
      componentBEscalationPct: 2.5,
      componentCEscalationPct: 2.0,
      componentDEscalationPct: 2.0,
      componentEEscalationPct: 2.0,
      componentADegressionAfterLoan: true,
      componentADegressionPct: 40.0,
      componentEDegressionAfterLoan: false,
      componentEDegressionPct: 0.0,
      twoTierEnabled: false,
      tier1DurationYears: 12,
      tier1TariffIdrPerKWh: 1480.0,
      tier2TariffIdrPerKWh: 1250.0,
      levelizedDiscountRatePct: 6.0,
    },
  },
  capexItems: [
    {
      id: 'drilling_wells',
      name: 'Production & Reinjection Well Drilling (8 Deep Geothermal Wells)',
      category: 'dev',
      amountIdrBillion: 2150.0,
      startMonth: 1,
      endMonth: 36,
      curve: 's_curve',
      usefulLifeYears: 30,
    },
    {
      id: 'fags_gathering',
      name: 'Fluid Collection & Reinjection System (FAGS / Steam Piping)',
      category: 'civil',
      amountIdrBillion: 980.0,
      startMonth: 12,
      endMonth: 38,
      curve: 's_curve',
      usefulLifeYears: 30,
    },
    {
      id: 'turbine_plant',
      name: 'Power Plant EPC (Dual-Flash Steam Turbine, Generator, Condenser)',
      category: 'em',
      amountIdrBillion: 1850.0,
      startMonth: 14,
      endMonth: 40,
      curve: 's_curve',
      usefulLifeYears: 30,
    },
    {
      id: 'switchyard_grid',
      name: '150 kV Switchyard & Interconnection Transmission Line',
      category: 'transmission',
      amountIdrBillion: 320.0,
      startMonth: 20,
      endMonth: 39,
      curve: 'linear',
      usefulLifeYears: 30,
    },
    {
      id: 'exploration_dev',
      name: 'Resource Exploration, Slim Hole Drilling, EIA/AMDAL & Land',
      category: 'dev',
      amountIdrBillion: 260.0,
      startMonth: 1,
      endMonth: 18,
      curve: 'linear',
      usefulLifeYears: 30,
    },
    {
      id: 'owners_consultancy',
      name: "Owner's Engineer & Subsurface Geoscientific Supervision",
      category: 'owners',
      amountIdrBillion: 120.0,
      startMonth: 1,
      endMonth: 42,
      curve: 'linear',
      usefulLifeYears: 30,
    },
    {
      id: 'contingency',
      name: 'Geological & Subsurface Drilling Contingency (5%)',
      category: 'contingency',
      amountIdrBillion: 280.0,
      startMonth: 1,
      endMonth: 42,
      curve: 's_curve',
      usefulLifeYears: 30,
    },
    {
      id: 'working_cap',
      name: 'Initial Operating Working Capital Seed',
      category: 'working_capital',
      amountIdrBillion: 40.0,
      startMonth: 40,
      endMonth: 42,
      curve: 'linear',
      usefulLifeYears: 0,
    },
  ],
  funding: {
    bankDebtPct: 70.0,
    equityPct: 30.0,
    shareholderLoanPct: 0.0,
    bankInterestRatePct: 9.0,
    upfrontFeePct: 1.0,
    commitmentFeePct: 0.5,
    gracePeriodMonths: 42,
    repaymentPeriodYears: 16,
    amortizationType: 'sculpted',
    targetDscrForSculpting: 1.35,
    covenantDscrBenchmark: 1.25,
    idcMode: 'capitalized',
    dsraRequirementMonths: 6,
    dsraMode: 'months',
    dsraFixedAmountIdrBillion: 35.0,
    minimumCashBufferBillion: 15.0,
  },
  tax: {
    corporateIncomeTaxRatePct: 22.0,
    vatRatePct: 11.0,
    withholdingTaxDividendsPct: 10.0,
    withholdingTaxInterestPct: 15.0,
    taxLossCarryForwardYears: 5,
    fiscalDepreciationRateBuildingsPct: 5.0,
    fiscalDepreciationRateEquipmentPct: 12.5,
  },
  valuation: {
    costOfEquityPct: 13.0,
    riskFreeRatePct: 6.5,
    equityRiskPremiumPct: 6.5,
    beta: 1.05,
    costOfDebtPreTaxPct: 9.0,
  },
  opex: {
    fixedOpexIdrBillion: 45.0,
    variableOpexIdrPerKWh: 24.0,
    insurancePctOfCapex: 0.45,
    landWaterChargesIdrBillion: 12.0,
    adminEmployeesIdrBillion: 18.0,
    maintenanceReserveIdrBillion: 10.0,
  },
};

// ============================================================================
// 4. WASTE TO ENERGY (WtE / PLTSa) - DUAL REVENUE STREAM
// Benowo Waste-to-Energy PLTSa 20 MW
// ============================================================================
export const BASE_WTE_ASSUMPTIONS: FullModelAssumptions = {
  project: {
    technology: 'waste_to_energy',
    projectName: 'Benowo Waste-to-Energy PLTSa 20 MW',
    installedCapacityMW: 20.0,
    numberOfUnits: 2, // 2 x 10 MW grate inceneration lines
    constructionStartDate: '2025-01-01',
    codDate: '2027-01-01',
    constructionPeriodMonths: 24,
    operatingPeriodYears: 25,
    epnParticipationPct: 80.0,
    otherSponsorParticipationPct: 20.0,
    majorOverhaul: {
      enabled: true,
      year: 12,
      amountIdrBillion: 65.0, // Boiler refractory relining & baghouse filter retrofit
      depreciationYears: 10,
    },
  },
  operating: {
    capacityFactorPct: 85.0,
    plantAvailabilityPct: 92.0,
    transmissionLossPct: 2.0,
    auxiliaryConsumptionPct: 9.5, // High aux for flue gas treatment, ID fans, baghouse
    annualDegradationPct: 0.20,
    annualOpexEscalationPct: 3.0,
    wteWasteThroughputTonsPerDay: 1000, // 1,000 Tons/day municipal solid waste
    wteTippingFeeIdrPerTon: 350000, // Rp 350,000 / ton (Biaya Layanan Pengolahan Sampah - BLPS)
    wteKWhPerTonWaste: 380, // 380 kWh generated per ton of municipal waste
  },
  revenue: {
    baseTariffIdrPerKWh: 1850.0, // ~10.9 cUSD/kWh (Govt Perpres 35/2018 Feed-in Tariff)
    fxIdrPerUsd: 17000.0,
    annualTariffEscalationPct: 2.0,
    tariffComponents: {
      useComponents: false,
      componentA_CapitalRecoveryIdrPerKWh: 1100.0,
      componentB_FixedOpexIdrPerKWh: 350.0,
      componentC_WaterLevyIdrPerKWh: 180.0, // Ash disposal & flue gas consumables fee
      componentD_VariableOpexIdrPerKWh: 220.0,
      componentE_TaxAdjustmentIdrPerKWh: 0.0,
      componentAEscalationPct: 0.0,
      componentBEscalationPct: 2.5,
      componentCEscalationPct: 2.0,
      componentDEscalationPct: 2.5,
      componentEEscalationPct: 2.0,
      componentADegressionAfterLoan: true,
      componentADegressionPct: 50.0,
      componentEDegressionAfterLoan: false,
      componentEDegressionPct: 0.0,
      twoTierEnabled: false,
      tier1DurationYears: 10,
      tier1TariffIdrPerKWh: 1850.0,
      tier2TariffIdrPerKWh: 1400.0,
      levelizedDiscountRatePct: 6.0,
    },
  },
  capexItems: [
    {
      id: 'waste_handling',
      name: 'Waste Reception Bunker, Overhead Crane & Pre-treatment Shredders',
      category: 'civil',
      amountIdrBillion: 140.0,
      startMonth: 1,
      endMonth: 18,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'grate_boiler',
      name: 'Moving Grate Incineration Boilers & Combustion System',
      category: 'em',
      amountIdrBillion: 360.0,
      startMonth: 4,
      endMonth: 22,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'turbine_generator',
      name: 'Steam Turbine Generator & Air-Cooled Condenser Unit',
      category: 'em',
      amountIdrBillion: 150.0,
      startMonth: 8,
      endMonth: 22,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'flue_gas_cleaning',
      name: 'Flue Gas Cleaning System (SNCR + Semi-Dry Scrubber + Fabric Filter)',
      category: 'em',
      amountIdrBillion: 180.0,
      startMonth: 6,
      endMonth: 23,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'civil_stack',
      name: 'Main Process Building, Control Room, Chimney Stack & Landfill Capping',
      category: 'civil',
      amountIdrBillion: 120.0,
      startMonth: 1,
      endMonth: 20,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'grid_interconnection',
      name: '20 kV / 150 kV Step-Up Substation & Overhead Grid Connection',
      category: 'transmission',
      amountIdrBillion: 45.0,
      startMonth: 12,
      endMonth: 22,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'dev_eia_blps',
      name: 'Municipal Concession Agreement, AMDAL & Social Permitting',
      category: 'dev',
      amountIdrBillion: 35.0,
      startMonth: 1,
      endMonth: 12,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'contingency_owners',
      name: "Owner's Engineer, Project Management & Contingency (6%)",
      category: 'contingency',
      amountIdrBillion: 65.0,
      startMonth: 1,
      endMonth: 24,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'working_cap',
      name: 'Initial Operating Working Capital Seed',
      category: 'working_capital',
      amountIdrBillion: 15.0,
      startMonth: 23,
      endMonth: 24,
      curve: 'linear',
      usefulLifeYears: 0,
    },
  ],
  funding: {
    bankDebtPct: 70.0,
    equityPct: 30.0,
    shareholderLoanPct: 0.0,
    bankInterestRatePct: 9.5,
    upfrontFeePct: 1.0,
    commitmentFeePct: 0.5,
    gracePeriodMonths: 24,
    repaymentPeriodYears: 14,
    amortizationType: 'annuity',
    targetDscrForSculpting: 1.30,
    covenantDscrBenchmark: 1.20,
    idcMode: 'capitalized',
    dsraRequirementMonths: 6,
    dsraMode: 'months',
    dsraFixedAmountIdrBillion: 8.0,
    minimumCashBufferBillion: 6.0,
  },
  tax: {
    corporateIncomeTaxRatePct: 22.0,
    vatRatePct: 11.0,
    withholdingTaxDividendsPct: 10.0,
    withholdingTaxInterestPct: 15.0,
    taxLossCarryForwardYears: 5,
    fiscalDepreciationRateBuildingsPct: 5.0,
    fiscalDepreciationRateEquipmentPct: 12.5,
  },
  valuation: {
    costOfEquityPct: 12.5,
    riskFreeRatePct: 6.5,
    equityRiskPremiumPct: 6.0,
    beta: 1.0,
    costOfDebtPreTaxPct: 9.5,
  },
  opex: {
    fixedOpexIdrBillion: 24.0,
    variableOpexIdrPerKWh: 35.0, // Flue gas consumables (hydrated lime, activated carbon, urea)
    insurancePctOfCapex: 0.40,
    landWaterChargesIdrBillion: 6.5,
    adminEmployeesIdrBillion: 12.0,
    maintenanceReserveIdrBillion: 6.0,
  },
};

// ============================================================================
// 5. PLTU (THERMAL IPP) - CFB / COAL & GAS FIRED
// Celukan Bawang Thermal Power Plant 100 MW
// ============================================================================
export const BASE_PLTU_ASSUMPTIONS: FullModelAssumptions = {
  project: {
    technology: 'thermal',
    projectName: 'Celukan Bawang Thermal Power Plant 100 MW',
    installedCapacityMW: 100.0,
    numberOfUnits: 2, // 2 x 50 MW Circulating Fluidized Bed (CFB) boilers
    constructionStartDate: '2025-01-01',
    codDate: '2027-07-01',
    constructionPeriodMonths: 30,
    operatingPeriodYears: 25,
    epnParticipationPct: 70.0,
    otherSponsorParticipationPct: 30.0,
    majorOverhaul: {
      enabled: true,
      year: 10,
      amountIdrBillion: 150.0, // Boiler major turnaround & turbine rotor overhaul
      depreciationYears: 10,
    },
  },
  operating: {
    capacityFactorPct: 80.0,
    plantAvailabilityPct: 90.0,
    transmissionLossPct: 2.5,
    auxiliaryConsumptionPct: 8.0, // Aux for pulverizers, cooling towers, ID/FD fans
    annualDegradationPct: 0.15,
    annualOpexEscalationPct: 2.5,
    thermalHeatRateKcalPerKWh: 2350,
    thermalFuelCostUsdPerTon: 75.0,
    thermalCarbonTaxIdrPerTonCo2: 30000,
  },
  revenue: {
    baseTariffIdrPerKWh: 1150.0, // ~6.75 cUSD/kWh
    fxIdrPerUsd: 17000.0,
    annualTariffEscalationPct: 2.0,
    tariffComponents: {
      useComponents: false,
      componentA_CapitalRecoveryIdrPerKWh: 620.0,
      componentB_FixedOpexIdrPerKWh: 180.0,
      componentC_WaterLevyIdrPerKWh: 240.0, // Component C: Fuel Cost Pass-Through & Carbon Charge
      componentD_VariableOpexIdrPerKWh: 110.0,
      componentE_TaxAdjustmentIdrPerKWh: 0.0,
      componentAEscalationPct: 0.0,
      componentBEscalationPct: 2.5,
      componentCEscalationPct: 2.0,
      componentDEscalationPct: 2.0,
      componentEEscalationPct: 2.0,
      componentADegressionAfterLoan: true,
      componentADegressionPct: 50.0,
      componentEDegressionAfterLoan: false,
      componentEDegressionPct: 0.0,
      twoTierEnabled: false,
      tier1DurationYears: 10,
      tier1TariffIdrPerKWh: 1150.0,
      tier2TariffIdrPerKWh: 950.0,
      levelizedDiscountRatePct: 6.0,
    },
  },
  capexItems: [
    {
      id: 'cfb_boilers',
      name: 'Circulating Fluidized Bed (CFB) Boilers & ESP Dust Collectors',
      category: 'em',
      amountIdrBillion: 680.0,
      startMonth: 4,
      endMonth: 28,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'steam_turbines',
      name: 'High-Pressure Steam Turbine Generators & Surface Condensers',
      category: 'em',
      amountIdrBillion: 390.0,
      startMonth: 8,
      endMonth: 28,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'coal_handling_jetty',
      name: 'Coal Unloading Jetty, Conveyor Trippers & Stacker-Reclaimer',
      category: 'civil',
      amountIdrBillion: 210.0,
      startMonth: 2,
      endMonth: 24,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'civil_cooling_chimney',
      name: 'Powerhouse, Natural Draft Cooling Towers & 120m Concrete Chimney',
      category: 'civil',
      amountIdrBillion: 280.0,
      startMonth: 1,
      endMonth: 26,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'transmission_grid',
      name: '150 kV Switchyard & Interconnection Transmission Line',
      category: 'transmission',
      amountIdrBillion: 95.0,
      startMonth: 12,
      endMonth: 27,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'dev_pm_permitting',
      name: "Project Development, AMDAL, Owner's Engineer & Supervision",
      category: 'owners',
      amountIdrBillion: 65.0,
      startMonth: 1,
      endMonth: 30,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'contingency',
      name: 'Physical & Unforeseen Contingency (5%)',
      category: 'contingency',
      amountIdrBillion: 90.0,
      startMonth: 1,
      endMonth: 30,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'working_cap',
      name: 'Initial Fuel Inventory & Operating Working Capital Seed',
      category: 'working_capital',
      amountIdrBillion: 30.0,
      startMonth: 28,
      endMonth: 30,
      curve: 'linear',
      usefulLifeYears: 0,
    },
  ],
  funding: {
    bankDebtPct: 70.0,
    equityPct: 30.0,
    shareholderLoanPct: 0.0,
    bankInterestRatePct: 9.8,
    upfrontFeePct: 1.0,
    commitmentFeePct: 0.5,
    gracePeriodMonths: 30,
    repaymentPeriodYears: 12,
    amortizationType: 'equal_principal',
    targetDscrForSculpting: 1.35,
    covenantDscrBenchmark: 1.25,
    idcMode: 'capitalized',
    dsraRequirementMonths: 6,
    dsraMode: 'months',
    dsraFixedAmountIdrBillion: 18.0,
    minimumCashBufferBillion: 10.0,
  },
  tax: {
    corporateIncomeTaxRatePct: 22.0,
    vatRatePct: 11.0,
    withholdingTaxDividendsPct: 10.0,
    withholdingTaxInterestPct: 15.0,
    taxLossCarryForwardYears: 5,
    fiscalDepreciationRateBuildingsPct: 5.0,
    fiscalDepreciationRateEquipmentPct: 12.5,
  },
  valuation: {
    costOfEquityPct: 13.5,
    riskFreeRatePct: 6.5,
    equityRiskPremiumPct: 7.0,
    beta: 1.1,
    costOfDebtPreTaxPct: 9.8,
  },
  opex: {
    fixedOpexIdrBillion: 32.0,
    variableOpexIdrPerKWh: 22.0,
    insurancePctOfCapex: 0.40,
    landWaterChargesIdrBillion: 8.0,
    adminEmployeesIdrBillion: 14.0,
    maintenanceReserveIdrBillion: 7.0,
  },
};

// ============================================================================
// 6. GENERIC CLEAN ENERGY IPP
// Generic Clean Energy IPP 50 MW
// ============================================================================
export const BASE_GENERIC_ASSUMPTIONS: FullModelAssumptions = {
  project: {
    technology: 'generic',
    projectName: 'Generic Clean Energy IPP 50 MW',
    installedCapacityMW: 50.0,
    numberOfUnits: 2,
    constructionStartDate: '2025-01-01',
    codDate: '2027-01-01',
    constructionPeriodMonths: 24,
    operatingPeriodYears: 25,
    epnParticipationPct: 100.0,
    otherSponsorParticipationPct: 0.0,
  },
  operating: {
    capacityFactorPct: 65.0,
    plantAvailabilityPct: 95.0,
    transmissionLossPct: 3.0,
    auxiliaryConsumptionPct: 2.0,
    annualDegradationPct: 0.20,
    annualOpexEscalationPct: 2.5,
  },
  revenue: {
    baseTariffIdrPerKWh: 1200.0,
    fxIdrPerUsd: 17000.0,
    annualTariffEscalationPct: 2.0,
    tariffComponents: {
      useComponents: false,
      componentA_CapitalRecoveryIdrPerKWh: 780.0,
      componentB_FixedOpexIdrPerKWh: 210.0,
      componentC_WaterLevyIdrPerKWh: 90.0,
      componentD_VariableOpexIdrPerKWh: 120.0,
      componentE_TaxAdjustmentIdrPerKWh: 0.0,
      componentAEscalationPct: 0.0,
      componentBEscalationPct: 2.5,
      componentCEscalationPct: 2.0,
      componentDEscalationPct: 2.0,
      componentEEscalationPct: 2.0,
      componentADegressionAfterLoan: true,
      componentADegressionPct: 50.0,
      componentEDegressionAfterLoan: false,
      componentEDegressionPct: 0.0,
      twoTierEnabled: false,
      tier1DurationYears: 10,
      tier1TariffIdrPerKWh: 1200.0,
      tier2TariffIdrPerKWh: 1000.0,
      levelizedDiscountRatePct: 6.0,
    },
  },
  capexItems: [
    {
      id: 'gen_epc_primary',
      name: 'Primary Power Generation Island & EPC Equipment',
      category: 'em',
      amountIdrBillion: 650.0,
      startMonth: 3,
      endMonth: 22,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'gen_electrical',
      name: 'Electrical Balance of Plant & Grid Interconnection',
      category: 'transmission',
      amountIdrBillion: 120.0,
      startMonth: 8,
      endMonth: 22,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'gen_civil',
      name: 'Civil Works, Foundations & Site Infrastructure',
      category: 'civil',
      amountIdrBillion: 110.0,
      startMonth: 1,
      endMonth: 18,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'gen_dev',
      name: 'Project Development, Land Acquisition & Permitting',
      category: 'dev',
      amountIdrBillion: 50.0,
      startMonth: 1,
      endMonth: 12,
      curve: 'linear',
      usefulLifeYears: 25,
    },
    {
      id: 'gen_contingency',
      name: "Owner's Costs & Project Contingency (5%)",
      category: 'contingency',
      amountIdrBillion: 50.0,
      startMonth: 1,
      endMonth: 24,
      curve: 's_curve',
      usefulLifeYears: 25,
    },
    {
      id: 'working_cap',
      name: 'Initial Operating Working Capital Seed',
      category: 'working_capital',
      amountIdrBillion: 20.0,
      startMonth: 23,
      endMonth: 24,
      curve: 'linear',
      usefulLifeYears: 0,
    },
  ],
  funding: {
    bankDebtPct: 70.0,
    equityPct: 30.0,
    shareholderLoanPct: 0.0,
    bankInterestRatePct: 9.0,
    upfrontFeePct: 1.0,
    commitmentFeePct: 0.5,
    gracePeriodMonths: 24,
    repaymentPeriodYears: 15,
    amortizationType: 'annuity',
    targetDscrForSculpting: 1.30,
    covenantDscrBenchmark: 1.20,
    idcMode: 'capitalized',
    dsraRequirementMonths: 6,
    dsraMode: 'months',
    dsraFixedAmountIdrBillion: 10.0,
    minimumCashBufferBillion: 5.0,
  },
  tax: {
    corporateIncomeTaxRatePct: 22.0,
    vatRatePct: 11.0,
    withholdingTaxDividendsPct: 10.0,
    withholdingTaxInterestPct: 15.0,
    taxLossCarryForwardYears: 5,
    fiscalDepreciationRateBuildingsPct: 5.0,
    fiscalDepreciationRateEquipmentPct: 12.5,
  },
  valuation: {
    costOfEquityPct: 12.0,
    riskFreeRatePct: 6.5,
    equityRiskPremiumPct: 5.5,
    beta: 1.0,
    costOfDebtPreTaxPct: 9.0,
  },
  opex: {
    fixedOpexIdrBillion: 18.0,
    variableOpexIdrPerKWh: 15.0,
    insurancePctOfCapex: 0.35,
    landWaterChargesIdrBillion: 4.0,
    adminEmployeesIdrBillion: 8.0,
    maintenanceReserveIdrBillion: 3.0,
  },
};

// ============================================================================
// HOLDING TECHNOLOGY PRESETS DICTIONARY
// ============================================================================
export const HOLDING_TECHNOLOGY_PRESETS: Record<TechnologyType, FullModelAssumptions> = {
  hydro: BASE_PLTA_ASSUMPTIONS,
  solar_pv: BASE_PLTS_ASSUMPTIONS,
  geothermal: BASE_PLTP_ASSUMPTIONS,
  waste_to_energy: BASE_WTE_ASSUMPTIONS,
  thermal: BASE_PLTU_ASSUMPTIONS,
  generic: BASE_GENERIC_ASSUMPTIONS,
};
