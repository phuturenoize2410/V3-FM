/*
 * Investment lifecycle, actual-data mapping and post-investment-review utilities.
 *
 * Design principle:
 * - Actuals are imported/verifiable source data. They are never generated from the model.
 * - Mapping rules translate source-system dimensions into FinMod model line items.
 * - Unmapped records remain explicit and are never guessed.
 * - Energy sales and tariff mix are explicit operating KPIs, not hidden inside revenue.
 * - Tariff tiers are optional and fully assumption-driven; no EBL/PPA/tier terms are hardcoded here.
 */

export type LifecyclePhase =
  | 'development'
  | 'financial_close'
  | 'construction'
  | 'cod'
  | 'operations'
  | 'ppa_expiry';

export type ActualDataClass =
  | 'actual'
  | 'commitment'
  | 'forecast_etc'
  | 'budget'
  | 'model_baseline';

export interface ActualSourceRow {
  rowId: string;
  sourceSystem: string;
  sourceFile?: string;
  postingDate: string;
  cutoffDate?: string;
  company?: string;
  projectId?: string;
  phase?: LifecyclePhase;
  glAccount?: string;
  costCenter?: string;
  wbsCode?: string;
  costCode?: string;
  contractId?: string;
  vendor?: string;
  currency?: string;
  amount: number;
  dataClass: ActualDataClass;
  description?: string;
}

export interface MappingRule {
  id: string;
  priority: number;
  enabled: boolean;
  company?: string;
  projectId?: string;
  phase?: LifecyclePhase;
  glAccount?: string;
  costCenter?: string;
  wbsPrefix?: string;
  costCodePrefix?: string;
  contractId?: string;
  finmodCategory: string;
  finmodSubcategory?: string;
  finmodLineItem: string;
  accountingTreatment?: 'capitalized' | 'expensed' | 'working_capital' | 'financing' | 'other';
  debtEligible?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface MappedActualRow extends ActualSourceRow {
  mappingRuleId: string | null;
  finmodCategory: string | null;
  finmodSubcategory: string | null;
  finmodLineItem: string | null;
  accountingTreatment: MappingRule['accountingTreatment'] | null;
  debtEligible: boolean | null;
  mappingStatus: 'mapped' | 'unmapped';
}

function normalize(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function dateInRange(dateStr: string, from?: string, to?: string): boolean {
  const value = new Date(dateStr).getTime();
  if (!Number.isFinite(value)) return false;
  if (from && value < new Date(from).getTime()) return false;
  if (to && value > new Date(to).getTime()) return false;
  return true;
}

function matchesRule(row: ActualSourceRow, rule: MappingRule): boolean {
  if (!rule.enabled) return false;
  if (!dateInRange(row.postingDate, rule.effectiveFrom, rule.effectiveTo)) return false;
  if (rule.company && normalize(row.company) !== normalize(rule.company)) return false;
  if (rule.projectId && normalize(row.projectId) !== normalize(rule.projectId)) return false;
  if (rule.phase && row.phase !== rule.phase) return false;
  if (rule.glAccount && normalize(row.glAccount) !== normalize(rule.glAccount)) return false;
  if (rule.costCenter && normalize(row.costCenter) !== normalize(rule.costCenter)) return false;
  if (rule.contractId && normalize(row.contractId) !== normalize(rule.contractId)) return false;
  if (rule.wbsPrefix && !normalize(row.wbsCode).startsWith(normalize(rule.wbsPrefix))) return false;
  if (rule.costCodePrefix && !normalize(row.costCode).startsWith(normalize(rule.costCodePrefix))) return false;
  return true;
}

export function mapActualRows(
  rows: ActualSourceRow[],
  rules: MappingRule[],
  cutoffDate?: string
): MappedActualRow[] {
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
  const cutoff = cutoffDate ? new Date(cutoffDate).getTime() : null;

  return rows
    .filter((row) => {
      if (cutoff === null) return true;
      const posting = new Date(row.postingDate).getTime();
      return Number.isFinite(posting) && posting <= cutoff;
    })
    .map((row) => {
      const rule = sortedRules.find((candidate) => matchesRule(row, candidate));
      if (!rule) {
        return {
          ...row,
          mappingRuleId: null,
          finmodCategory: null,
          finmodSubcategory: null,
          finmodLineItem: null,
          accountingTreatment: null,
          debtEligible: null,
          mappingStatus: 'unmapped' as const,
        };
      }

      return {
        ...row,
        mappingRuleId: rule.id,
        finmodCategory: rule.finmodCategory,
        finmodSubcategory: rule.finmodSubcategory ?? null,
        finmodLineItem: rule.finmodLineItem,
        accountingTreatment: rule.accountingTreatment ?? null,
        debtEligible: rule.debtEligible ?? null,
        mappingStatus: 'mapped' as const,
      };
    });
}

export interface MappingControlSummary {
  totalRows: number;
  mappedRows: number;
  unmappedRows: number;
  totalAmount: number;
  mappedAmount: number;
  unmappedAmount: number;
  mappingCoveragePct: number;
}

export function summarizeMapping(rows: MappedActualRow[]): MappingControlSummary {
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const mapped = rows.filter((row) => row.mappingStatus === 'mapped');
  const unmapped = rows.filter((row) => row.mappingStatus === 'unmapped');
  const mappedAmount = mapped.reduce((sum, row) => sum + row.amount, 0);
  const unmappedAmount = unmapped.reduce((sum, row) => sum + row.amount, 0);
  return {
    totalRows: rows.length,
    mappedRows: mapped.length,
    unmappedRows: unmapped.length,
    totalAmount,
    mappedAmount,
    unmappedAmount,
    mappingCoveragePct: rows.length > 0 ? (mapped.length / rows.length) * 100 : 100,
  };
}

export interface CostPerformanceInput {
  lineItem: string;
  originalModel: number;
  approvedBudget: number;
  actualToDate: number;
  commitmentOutstanding: number;
  etc: number;
}

export interface CostPerformanceRow extends CostPerformanceInput {
  eac: number;
  varianceVsBudget: number;
  varianceVsOriginalModel: number;
  actualPlusCommitment: number;
  uncommittedEtc: number;
}

export function calculateCostPerformance(input: CostPerformanceInput): CostPerformanceRow {
  const eac = input.actualToDate + input.commitmentOutstanding + input.etc;
  return {
    ...input,
    eac,
    varianceVsBudget: eac - input.approvedBudget,
    varianceVsOriginalModel: eac - input.originalModel,
    actualPlusCommitment: input.actualToDate + input.commitmentOutstanding,
    uncommittedEtc: input.etc,
  };
}

export interface TariffTier {
  id: string;
  fromGWh: number;
  toGWh?: number;
  tariffIdrPerKWh: number;
  annualEscalationPct?: number;
}

export interface EnergySalesContract {
  committedEnergyGWh?: number;
  flatTariffIdrPerKWh?: number;
  annualEscalationPct?: number;
  tiers?: TariffTier[];
}

export interface EnergySalesResult {
  energySalesGWh: number;
  committedEnergyGWh: number | null;
  commitmentVarianceGWh: number | null;
  revenueIdrBillion: number;
  effectiveTariffIdrPerKWh: number;
  tierRevenueIdrBillion: Record<string, number>;
  tierEnergyGWh: Record<string, number>;
}

function escalatedTariff(base: number, escalationPct: number, yearIndex: number): number {
  return base * Math.pow(1 + escalationPct / 100, Math.max(0, yearIndex));
}

export function calculateEnergySales(
  energySalesGWh: number,
  contract: EnergySalesContract,
  yearIndex = 0
): EnergySalesResult {
  const sales = Math.max(0, energySalesGWh);
  const tierRevenueIdrBillion: Record<string, number> = {};
  const tierEnergyGWh: Record<string, number> = {};
  let revenueIdrBillion = 0;

  const activeTiers = (contract.tiers ?? [])
    .filter((tier) => tier.toGWh === undefined || tier.toGWh > tier.fromGWh)
    .sort((a, b) => a.fromGWh - b.fromGWh);

  if (activeTiers.length > 0) {
    for (const tier of activeTiers) {
      const upper = tier.toGWh ?? Number.POSITIVE_INFINITY;
      const tierGWh = Math.max(0, Math.min(sales, upper) - Math.max(0, tier.fromGWh));
      const tariff = escalatedTariff(
        tier.tariffIdrPerKWh,
        tier.annualEscalationPct ?? contract.annualEscalationPct ?? 0,
        yearIndex
      );
      const tierRevenue = (tierGWh * 1e6 * tariff) / 1e9;
      tierEnergyGWh[tier.id] = tierGWh;
      tierRevenueIdrBillion[tier.id] = tierRevenue;
      revenueIdrBillion += tierRevenue;
    }
  } else {
    const tariff = escalatedTariff(
      contract.flatTariffIdrPerKWh ?? 0,
      contract.annualEscalationPct ?? 0,
      yearIndex
    );
    revenueIdrBillion = (sales * 1e6 * tariff) / 1e9;
    tierEnergyGWh.flat = sales;
    tierRevenueIdrBillion.flat = revenueIdrBillion;
  }

  const effectiveTariffIdrPerKWh = sales > 0 ? (revenueIdrBillion * 1e9) / (sales * 1e6) : 0;
  const committedEnergyGWh = Number.isFinite(contract.committedEnergyGWh)
    ? (contract.committedEnergyGWh as number)
    : null;

  return {
    energySalesGWh: sales,
    committedEnergyGWh,
    commitmentVarianceGWh:
      committedEnergyGWh === null ? null : sales - committedEnergyGWh,
    revenueIdrBillion,
    effectiveTariffIdrPerKWh,
    tierRevenueIdrBillion,
    tierEnergyGWh,
  };
}

export interface PirOperatingPeriodInput {
  year: number;
  modelEnergySalesGWh: number;
  actualEnergySalesGWh: number;
  modelRevenueIdrBillion: number;
  actualRevenueIdrBillion: number;
  modelOpexIdrBillion?: number;
  actualOpexIdrBillion?: number;
  modelCfadsIdrBillion?: number;
  actualCfadsIdrBillion?: number;
  modelDscr?: number | null;
  actualDscr?: number | null;
}

export interface PirOperatingPeriodResult extends PirOperatingPeriodInput {
  energySalesVarianceGWh: number;
  energySalesVariancePct: number | null;
  modelEffectiveTariffIdrPerKWh: number;
  actualEffectiveTariffIdrPerKWh: number;
  volumeRevenueImpactIdrBillion: number;
  tariffMixRevenueImpactIdrBillion: number;
  revenueVarianceIdrBillion: number;
  opexVarianceIdrBillion: number | null;
  cfadsVarianceIdrBillion: number | null;
  dscrVariance: number | null;
}

/**
 * Revenue bridge convention:
 *   volume impact = (Actual MWh-equivalent sales - Model sales) × Model effective tariff
 *   tariff/mix impact = Actual revenue - revenue at Actual volume using Model tariff
 * This keeps physical volume and commercial tariff/tier effects separate.
 */
export function calculatePirOperatingPeriod(
  input: PirOperatingPeriodInput
): PirOperatingPeriodResult {
  const modelTariff =
    input.modelEnergySalesGWh > 0
      ? (input.modelRevenueIdrBillion * 1e9) / (input.modelEnergySalesGWh * 1e6)
      : 0;
  const actualTariff =
    input.actualEnergySalesGWh > 0
      ? (input.actualRevenueIdrBillion * 1e9) / (input.actualEnergySalesGWh * 1e6)
      : 0;

  const revenueAtActualVolumeModelTariff =
    (input.actualEnergySalesGWh * 1e6 * modelTariff) / 1e9;
  const volumeRevenueImpactIdrBillion =
    revenueAtActualVolumeModelTariff - input.modelRevenueIdrBillion;
  const tariffMixRevenueImpactIdrBillion =
    input.actualRevenueIdrBillion - revenueAtActualVolumeModelTariff;

  return {
    ...input,
    energySalesVarianceGWh: input.actualEnergySalesGWh - input.modelEnergySalesGWh,
    energySalesVariancePct:
      input.modelEnergySalesGWh > 0
        ? ((input.actualEnergySalesGWh - input.modelEnergySalesGWh) / input.modelEnergySalesGWh) * 100
        : null,
    modelEffectiveTariffIdrPerKWh: modelTariff,
    actualEffectiveTariffIdrPerKWh: actualTariff,
    volumeRevenueImpactIdrBillion,
    tariffMixRevenueImpactIdrBillion,
    revenueVarianceIdrBillion: input.actualRevenueIdrBillion - input.modelRevenueIdrBillion,
    opexVarianceIdrBillion:
      input.modelOpexIdrBillion === undefined || input.actualOpexIdrBillion === undefined
        ? null
        : input.actualOpexIdrBillion - input.modelOpexIdrBillion,
    cfadsVarianceIdrBillion:
      input.modelCfadsIdrBillion === undefined || input.actualCfadsIdrBillion === undefined
        ? null
        : input.actualCfadsIdrBillion - input.modelCfadsIdrBillion,
    dscrVariance:
      input.modelDscr === null ||
      input.actualDscr === null ||
      input.modelDscr === undefined ||
      input.actualDscr === undefined
        ? null
        : input.actualDscr - input.modelDscr,
  };
}

export interface PirLifeToDateSummary {
  periods: number;
  modelEnergySalesGWh: number;
  actualEnergySalesGWh: number;
  energySalesVarianceGWh: number;
  modelRevenueIdrBillion: number;
  actualRevenueIdrBillion: number;
  revenueVarianceIdrBillion: number;
  volumeRevenueImpactIdrBillion: number;
  tariffMixRevenueImpactIdrBillion: number;
}

export function summarizePirLifeToDate(
  periods: PirOperatingPeriodResult[]
): PirLifeToDateSummary {
  return periods.reduce<PirLifeToDateSummary>(
    (summary, row) => ({
      periods: summary.periods + 1,
      modelEnergySalesGWh: summary.modelEnergySalesGWh + row.modelEnergySalesGWh,
      actualEnergySalesGWh: summary.actualEnergySalesGWh + row.actualEnergySalesGWh,
      energySalesVarianceGWh: summary.energySalesVarianceGWh + row.energySalesVarianceGWh,
      modelRevenueIdrBillion: summary.modelRevenueIdrBillion + row.modelRevenueIdrBillion,
      actualRevenueIdrBillion: summary.actualRevenueIdrBillion + row.actualRevenueIdrBillion,
      revenueVarianceIdrBillion: summary.revenueVarianceIdrBillion + row.revenueVarianceIdrBillion,
      volumeRevenueImpactIdrBillion:
        summary.volumeRevenueImpactIdrBillion + row.volumeRevenueImpactIdrBillion,
      tariffMixRevenueImpactIdrBillion:
        summary.tariffMixRevenueImpactIdrBillion + row.tariffMixRevenueImpactIdrBillion,
    }),
    {
      periods: 0,
      modelEnergySalesGWh: 0,
      actualEnergySalesGWh: 0,
      energySalesVarianceGWh: 0,
      modelRevenueIdrBillion: 0,
      actualRevenueIdrBillion: 0,
      revenueVarianceIdrBillion: 0,
      volumeRevenueImpactIdrBillion: 0,
      tariffMixRevenueImpactIdrBillion: 0,
    }
  );
}
