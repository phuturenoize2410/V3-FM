export type AmortizationType = 'equal_principal' | 'annuity' | 'sculpted';
export type DrawdownOrder = 'equity_first' | 'pro_rata' | 'debt_first';
export type IdcMode = 'capitalized' | 'paid';
export type DsraMonths = 3 | 6 | 12;
export type SpendingCurve = 'linear' | 's_curve' | 'early_heavy' | 'late_heavy' | 'custom';
export type CurrencyDisplay = 'IDR_B' | 'IDR_M' | 'USD_M' | 'USD_K';

export type CapexCategory =
  | 'civil'
  | 'material_civil'
  | 'em'
  | 'material_em'
  | 'transmission'
  | 'dev'
  | 'pre_op'
  | 'owners'
  | 'contingency'
  | 'working_capital'
  | 'other';

export type TabId =
  | '00_driver_cockpit'
  | '01_control'
  | '02_assumptions'
  | '03_timeline'
  | '04_capex'
  | '05_sources_uses'
  | '06_funding'
  | '07_debt'
  | '08_idc'
  | '09_revenue'
  | '10_opex'
  | '11_fixed_assets'
  | '12_depreciation'
  | '13_tax'
  | '14_income_statement'
  | '15_balance_sheet'
  | '16_cash_flow'
  | '17_cfads'
  | '18_dscr'
  | '19_dsra'
  | '20_llcr'
  | '21_project_cashflow'
  | '22_equity_cashflow'
  | '23_valuation'
  | '24_lcoe'
  | '25_sensitivity'
  | '26_scenarios'
  | '27_executive_summary'
  | '28_model_checks'
  | '29_reconciliation'
  | '30_audit_trail'
  | '31_plan_vs_actual';

export type TechnologyType =
  | 'hydro'
  | 'solar_pv'
  | 'geothermal'
  | 'waste_to_energy'
  | 'thermal'
  | 'generic';

export interface ProjectAssumptions {
  technology?: TechnologyType; // Asset Class: Hydro, Solar, Geothermal, Waste to Energy, Thermal, Generic
  projectName: string;
  installedCapacityMW: number;
  numberOfUnits: number;
  constructionStartDate: string; // YYYY-MM-DD
  codDate: string; // YYYY-MM-DD
  constructionPeriodMonths: number;
  operatingPeriodYears: number;
  epnParticipationPct: number; // e.g. 70
  otherSponsorParticipationPct: number; // e.g. 30
  projectLocation?: string;
  sponsorName?: string;
  offtakerName?: string;
  concessionPeriodYears?: number;
  commercialOperationDate?: string;
  majorOverhaul?: MajorOverhaulAssumptions;
}

export interface MajorOverhaulAssumptions {
  enabled: boolean;
  year: number; // operating year (e.g. Year 15)
  amountIdrBillion: number; // capital expenditure in IDR Billion
  depreciationYears: number; // depreciation horizon (e.g. 15 years)
}

export interface OperatingAssumptions {
  capacityFactorPct: number; // e.g. 64%
  plantAvailabilityPct: number; // e.g. 98%
  transmissionLossPct: number; // e.g. 4.8%
  auxiliaryConsumptionPct: number; // e.g. 1.2%
  annualDegradationPct: number; // e.g. 0.2%
  annualOpexEscalationPct: number; // e.g. 2.5%

  // Technology Specific Parameters (Holding Energy Suite)
  solarSpecificYieldKWhPerKWp?: number; // e.g. 1,550 kWh/kWp/yr
  solarPeakSunHoursPerDay?: number; // e.g. 4.5 hrs/day
  solarPerformanceRatioPct?: number; // e.g. 80.0%
  geothermalSteamFieldFeeIdrPerKWh?: number; // e.g. 180 IDR/kWh
  wteWasteThroughputTonsPerDay?: number; // e.g. 1,000 tons/day
  wteTippingFeeIdrPerTon?: number; // e.g. 350,000 IDR/ton
  wteKWhPerTonWaste?: number; // e.g. 380 kWh/ton
  thermalHeatRateKcalPerKWh?: number; // e.g. 2,350 kcal/kWh
  thermalFuelCostUsdPerTon?: number; // e.g. 75 USD/ton
  thermalCarbonTaxIdrPerTonCo2?: number; // e.g. 30,000 IDR/ton CO2
}

export interface TariffComponents {
  useComponents: boolean; // When true, tariff is built up from Components A, B, C, D, E
  componentA_CapitalRecoveryIdrPerKWh: number; // Component A: Capital Recovery (Debt & Equity)
  componentB_FixedOpexIdrPerKWh: number; // Component B: Fixed O&M Charge
  componentC_WaterLevyIdrPerKWh: number; // Component C: Hydrology / Water Resource Charge (BJPSDA)
  componentD_VariableOpexIdrPerKWh: number; // Component D: Variable O&M Charge
  componentE_TaxAdjustmentIdrPerKWh?: number; // Component E: Tax / Fiscal Adjustment Charge
  componentAEscalationPct?: number; // Escalation % for Comp A (typically 0% for capital recovery)
  componentBEscalationPct?: number; // Escalation % for Comp B (inflation-indexed)
  componentCEscalationPct?: number; // Escalation % for Comp C (water fee index)
  componentDEscalationPct?: number; // Escalation % for Comp D
  componentEEscalationPct?: number; // Escalation % for Comp E
  componentADegressionAfterLoan?: boolean; // Reduce Component A after senior debt is fully repaid
  componentADegressionPct?: number; // % reduction in Component A post-loan payoff (e.g. 50%)
  componentEDegressionAfterLoan?: boolean; // Reduce Component E post-loan payoff
  componentEDegressionPct?: number;
  twoTierEnabled?: boolean; // Enable stepped two-tier tariff (Stage I vs Stage II)
  tier1DurationYears?: number; // Duration of Tier 1 (e.g. 10 years matching debt tenor)
  tier1TariffIdrPerKWh?: number; // Tier 1 tariff override in IDR/kWh
  tier2TariffIdrPerKWh?: number; // Tier 2 tariff override in IDR/kWh
  levelizedDiscountRatePct?: number; // Discount rate for Levelized Tariff (NPV) calculation (e.g. 6.0%)
}

export interface RevenueAssumptions {
  baseTariffIdrPerKWh: number; // e.g. 1150 IDR/kWh (~6.76 cUSD/kWh)
  fxIdrPerUsd: number; // e.g. 17000
  annualTariffEscalationPct: number; // e.g. 2.0%
  tariffComponents?: TariffComponents;
}

export interface CapexItem {
  id: string;
  name: string;
  category: CapexCategory;
  subCategory?: string;
  unit?: string; // e.g. "LS", "m3", "ton", "set", "km", "ha", "bln"
  quantity?: number;
  unitRateIdr?: number; // e.g. unit price in IDR
  amountIdrBillion: number;
  startMonth: number; // 1-indexed
  endMonth: number;
  curve: SpendingCurve;
  customWeights?: number[]; // if custom curve
  usefulLifeYears: number; // for depreciation
  notes?: string;
}

export interface FundingAssumptions {
  bankDebtPct: number; // e.g. 70%
  equityPct: number; // e.g. 30%
  shareholderLoanPct: number; // e.g. 0%
  bankInterestRatePct: number; // e.g. 9.3%
  upfrontFeePct: number; // e.g. 1.0%
  commitmentFeePct: number; // e.g. 0.5%
  gracePeriodMonths: number; // e.g. 30 months (during construction)
  repaymentPeriodYears: number; // e.g. 10 years
  amortizationType: AmortizationType;
  drawdownOrder?: DrawdownOrder;
  targetDscrForSculpting?: number; // e.g. 1.30x
  covenantDscrBenchmark?: number; // e.g. 1.20x (Configurable Lender Covenant)
  idcMode: IdcMode;
  dsraRequirementMonths: DsraMonths;
  dsraMode?: 'months' | 'fixed';
  dsraFixedAmountIdrBillion?: number; // e.g. fixed reserve in IDR Billion
  facilityAmountLimitIdrBillion?: number; // e.g. max bank facility cap
  minimumCashBufferBillion: number; // e.g. 5.0 IDR B
}

export interface TaxAssumptions {
  corporateIncomeTaxRatePct: number; // e.g. 22%
  vatRatePct: number; // e.g. 11%
  withholdingTaxDividendsPct: number; // e.g. 10%
  withholdingTaxInterestPct: number; // e.g. 15%
  taxLossCarryForwardYears: number; // 5 years in Indonesia
  fiscalDepreciationRateBuildingsPct: number; // 5% (20 years SL)
  fiscalDepreciationRateEquipmentPct: number; // 6.25% or 12.5%
}

export interface ValuationAssumptions {
  costOfEquityPct: number; // e.g. 12.0%
  riskFreeRatePct: number; // e.g. 6.5%
  equityRiskPremiumPct: number; // e.g. 5.5%
  beta: number; // e.g. 1.0
  costOfDebtPreTaxPct: number; // e.g. 9.3%
}

export type OpexCategory = 'fixed' | 'variable' | 'regulatory' | 'admin' | 'maintenance' | 'other';

export interface CustomOpexItem {
  id: string;
  name: string;
  category: OpexCategory;
  amountIdrBillion: number; // annual base amount in IDR Billion
  escalationPct?: number; // annual escalation % override (optional, defaults to general opex escalation)
  startYear?: number; // operating year start (1..30, defaults to 1)
  endYear?: number; // operating year end (1..30, defaults to 30)
  active: boolean;
  notes?: string;
}

export interface OpexAssumptions {
  fixedOpexIdrBillion: number; // e.g. 11.5 B
  variableOpexIdrPerKWh: number; // e.g. 18 IDR/kWh
  insurancePctOfCapex: number; // e.g. 0.35%
  landWaterChargesIdrBillion: number; // e.g. 3.2 B
  adminEmployeesIdrBillion: number; // e.g. 6.8 B
  maintenanceReserveIdrBillion: number; // e.g. 2.0 B
  customOpexItems?: CustomOpexItem[];
}

export interface FullModelAssumptions {
  workingInputs?: import('./calculations/workingModelInputs').WorkingModelInputs;
  project: ProjectAssumptions;
  operating: OperatingAssumptions;
  revenue: RevenueAssumptions;
  capexItems: CapexItem[];
  funding: FundingAssumptions;
  tax: TaxAssumptions;
  valuation: ValuationAssumptions;
  opex: OpexAssumptions;
}

// ---------------- Calculation Output Types -----------------

export interface MonthlyCapexSchedule {
  month: number;
  dateStr: string;
  itemsExpenditure: Record<string, number>; // idr billion
  totalCapex: number; // Monthly Capex Cash Requirement
  cumulativeCapex: number; // Cumulative Capex Expenditure
  cumulativeCapexPct: number; // S-Curve % (0 to 100%)
  debtDrawdown: number; // Senior Bank Debt Disbursement
  equityDrawdown: number; // Sponsor Equity Disbursement
  totalDisbursement: number; // Total Disbursement (Debt + Equity)
  cumulativeDebt: number; // Cumulative Debt Drawn
  cumulativeEquity: number; // Cumulative Equity Injected
  undrawnDebt: number; // Undrawn Facility Balance
  commitmentFee: number; // Monthly Commitment Fee
  openingDebt: number;
  monthlyInterest: number; // Construction Interest Expense for Current Month
  idcCapitalized: number;
  idcPaid: number;
  closingDebt: number;
  cashVariance: number; // Cash Disbursement vs Capex Funding Variance
}

export interface SourcesAndUses {
  // Uses
  epcCivil: number;
  electroMechanical: number;
  transmission: number;
  developmentCost: number;
  preOperatingCost: number;
  ownersCost: number;
  contingency: number;
  initialWorkingCapital: number;
  baseCapexTotal: number;
  financingFees: number;
  idcTotal: number;
  dsraPreFunding: number;
  totalUses: number;

  // Sources
  bankLoanAmount: number;
  equityAmount: number;
  shareholderLoanAmount: number;
  totalSources: number;

  // Variance Check
  variance: number;
  isBalanced: boolean;
}

export interface DebtScheduleRow {
  year: number;
  dateStr: string;
  isOperating: boolean;
  openingBalance: number;
  drawdown: number;
  capitalizedIdc: number;
  interestExpense: number;
  principalRepayment: number;
  totalDebtService: number;
  closingBalance: number;
}

export interface AnnualOperatingRow {
  workingOpexLines?: ReadonlyArray<{ id: string; amount: number; state: 'VALUE' | 'EXPLICIT_ZERO' | 'NOT_APPLICABLE' }>;
  year: number;
  dateStr: string;
  // Technical & Generation
  capacityMW: number;
  hoursInYear: number;
  capacityFactorPct: number;
  plantAvailabilityPct: number;
  grossGenerationGWh: number;
  auxiliaryLossGWh: number;
  transmissionLossGWh: number;
  netGenerationGWh: number;
  netGenerationMWh: number;
  netGenerationKWh: number;

  // Revenue
  tariffIdrPerKWh: number;
  tariffUsdPerKWh: number;
  tariffComponentAIdr?: number; // Component A (Capital Recovery)
  tariffComponentBIdr?: number; // Component B (Fixed O&M)
  tariffComponentCIdr?: number; // Component C (Water Resource / BJPSDA)
  tariffComponentDIdr?: number; // Component D (Variable O&M)
  tariffComponentEIdr?: number; // Component E (Tax / Fiscal Adjustment)
  electricityRevenueIdrBillion?: number; // Power generation PPA revenue
  wteTippingFeeRevenueIdrBillion?: number; // Municipal waste tipping fee revenue (BLPS)
  revenueIdrBillion: number;
  revenueUsdMillion: number;
  majorOverhaulCapex?: number; // Capitalized overhaul / sustaining capex
  directCashFromOperations?: number;
  indirectCashFromOperations?: number;

  // OPEX
  fixedOpex: number;
  variableOpex: number;
  insurance: number;
  landWaterCharges: number;
  adminEmployees: number;
  maintenanceReserve: number;
  customOpex?: number;
  customOpexItemsBreakdown?: Array<{ id: string; name: string; amount: number }>;
  totalOpexIdrBillion: number;

  // EBITDA
  ebitdaIdrBillion: number;
  ebitdaMarginPct: number;

  // Depreciation
  accountingDepreciation: number;
  accountingAccumDepreciation: number;
  accountingNbv: number;
  fiscalDepreciation: number;

  // P&L
  ebitIdrBillion: number;
  interestExpense: number;
  ebtIdrBillion: number;

  // Tax
  taxLossOpening: number;
  taxLossGenerated: number;
  taxLossUtilized: number;
  taxLossClosing: number;
  taxableIncome: number;
  corporateTax: number;
  effectiveTaxRatePct: number;
  netIncomeIdrBillion: number; // PAT

  // Cash Flow & DSCR
  cfadsIdrBillion: number;
  principalRepayment: number;
  interestPayment: number;
  debtServiceIdrBillion: number;
  dscr: number | null;
  llcr: number | null;

  // DSRA
  requiredDsra: number;
  openingDsra: number;
  dsraFunding: number;
  dsraRelease: number;
  closingDsra: number;

  // Working Capital
  workingCapitalChange: number;
  workingCapitalClosing: number;

  // Cash Flow to Equity
  cashBeforeDistribution: number;
  dividendsPaid: number;
  closingCashBuffer: number;
  equityCashFlow: number;

  // Project Free Cash Flow
  projectFreeCashFlow: number;

  // Balance Sheet Items
  bsCash: number;
  bsDsra: number;
  bsWorkingCapital: number;
  bsPpeNbv: number;
  bsTotalAssets: number;
  bsDebt: number;
  bsRetainedEarnings: number;
  bsShareCapital: number;
  bsTotalLiabEquity: number;
  bsDifference: number;

  // Aliases & Comprehensive Financial Statement Mapping
  cfads: number;
  debtPrincipalRepayment: number;
  debtInterestExpense: number;
  debtOpeningBalance: number;
  taxLossCarriedForward: number;
  accumulatedDepreciationOpening: number;
  yearNumber: number;
  openingDebt: number;
  closingDebt: number;
  depreciationExpense: number;
  incomeTaxIdrBillion: number;
  grossFixedAssets: number;
  accumulatedDepreciationEnding: number;
  netFixedAssetsEnding: number;
  bsCashAndCashEquivalents: number;
  bsDsraBalance: number;
  bsWorkingCapitalReceivables: number;
  totalAssets: number;
  closingDebtBalance: number;
  totalLiabilities: number;
  shareCapitalPaidIn: number;
  retainedEarningsEnding: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanceSheetDifference: number;
  operatingCashFlow: number;
  totalDebtService: number;
  dsraMovement: number;
  dividendsDistributed: number;
  fcffIdrBillion: number;
  fcfeIdrBillion: number;
  financingCashFlow: number;
  netChangeInCash: number;
  cashBeginningBalance: number;
  cashEndingBalance: number;
}

export interface ModelMetrics {
  projectIrrPct: number;
  projectIrrAnnualizedPct: number;
  projectNpvIdrBillion: number;
  projectNpvUsdMillion: number;
  waccPct: number;

  equityIrrPct: number;
  equityIrrAnnualizedPct: number;
  equityNpvIdrBillion: number;
  equityNpvUsdMillion: number;

  minDscr: number;
  avgDscr: number;
  maxDscr: number;
  minLlcr: number;

  lcoeIdrPerKWh: number;
  lcoeUsdPerKWh: number;
  lcoeCentsPerKWh: number;
  levelizedTariffIdrPerKWh?: number;
  levelizedTariffUsdPerKWh?: number;
  levelizedTariffCentsPerKWh?: number;

  totalCapexIdrBillion: number;
  totalDebtIdrBillion: number;
  totalEquityIdrBillion: number;
  averageAnnualGenerationGWh: number;
  averageAnnualRevenueIdrBillion: number;
  averageAnnualEbitdaIdrBillion: number;
  averageEbitdaMarginPct: number;
  paybackPeriodYears: number;
  equityPaybackPeriodYears: number;
}

export interface ModelCheckItem {
  id: string;
  name: string;
  category: 'funding' | 'balance_sheet' | 'cash_flow' | 'debt' | 'tax' | 'generation';
  passed: boolean;
  valueDescription: string;
  tolerance: number;
  delta: number;
  details: string;
}

export interface FormulaTraceNode {
  metricName: string;
  symbolOrValue: string;
  formulaString: string;
  unit: string;
  description: string;
  components: {
    label: string;
    value: string | number;
    source: string;
    isInput: boolean;
  }[];
  notes?: string;
}

export type ScenarioType =
  | 'base'
  | 'p75'
  | 'p90'
  | 'capex_overrun'
  | 'refinancing'
  | 'bear'
  | 'bull';

export interface ReconciliationItem {
  id: string;
  metric: string;
  category: string;
  unit: string;
  originalValue: number | string;
  rebuiltValue: number | string;
  variance: number | string;
  variancePct: number | null;
  status: 'MATCH' | 'EXPECTED_DIFFERENCE' | 'ERROR';
  explanation: string;
}

export interface CapexRealizationItem {
  id: string;
  name: string;
  category: CapexCategory;
  planAmountIdrBillion: number;
  contractAwardedIdrBillion: number;
  actualIncurredIdrBillion: number;
  varianceIdrBillion: number; // actual - plan
  variancePct: number; // (actual - plan) / plan * 100
  status: 'SAVINGS' | 'ON_TRACK' | 'OVERRUN';
  contractorName?: string;
  completionPct?: number;
  notes?: string;
}

export interface AnnualRealizationRow {
  year: number;
  dateStr: string;
  // Generation
  planNetGenGWh: number;
  actualNetGenGWh: number;
  genVarianceGWh: number;
  genRealizationPct: number;
  // Tariff
  planTariffIdr: number;
  actualTariffIdr: number;
  // Revenue
  planRevenueIdrB: number;
  actualRevenueIdrB: number;
  revenueVarianceIdrB: number;
  // OPEX
  planOpexIdrB: number;
  actualOpexIdrB: number;
  opexVarianceIdrB: number;
  // EBITDA
  planEbitdaIdrB: number;
  actualEbitdaIdrB: number;
  // Debt Service & DSCR
  planDebtServiceIdrB: number;
  actualDebtServiceIdrB: number;
  planDscr: number | null;
  actualDscr: number | null;
  isCovenantMet: boolean;
  // Cash & Distribution
  planDividendsIdrB: number;
  actualDividendsIdrB: number;
}

export interface PlanVsActualSummary {
  planTotalCapex: number;
  actualTotalCapex: number;
  capexVariance: number;
  capexVariancePct: number;
  actualCodDelayMonths: number;
  planProjectIrr: number;
  actualProjectIrr: number;
  irrVariance: number;
  planEquityIrr: number;
  actualEquityIrr: number;
  planMinDscr: number;
  actualMinDscr: number;
  covenantDscr: number;
  cumulativePlanRevenue: number;
  cumulativeActualRevenue: number;
  cumulativePlanEbitda: number;
  cumulativeActualEbitda: number;
  cumulativePlanGenGWh: number;
  cumulativeActualGenGWh: number;
}


