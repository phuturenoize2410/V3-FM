import { FullModelAssumptions } from '../types';

/**
 * Central registry for economically meaningful model drivers that are currently
 * supported by the live sensitivity engine.
 *
 * Design rule:
 * - code defines how a driver is applied;
 * - model assumptions supply the base economic value;
 * - sensitivity metadata belongs here rather than being duplicated in UI/components.
 *
 * This registry intentionally does NOT invent missing project terms. Structural
 * items such as multiple debt facilities, sponsor registries, BOO/BOOT transfer
 * economics and dynamic OPEX line items require explicit model structures before
 * they can become live drivers.
 */

export type EconomicDriverId =
  | 'tariff'
  | 'capacityFactor'
  | 'interestRate'
  | 'capex'
  | 'fx'
  | 'debtGearing'
  | 'fixedOpex';

export type DriverShockMode = 'relative_pct' | 'absolute';

export interface EconomicDriverDefinition {
  id: EconomicDriverId;
  label: string;
  category: 'revenue' | 'operations' | 'funding' | 'capex' | 'market' | 'opex';
  sourcePath: string;
  unit: string;
  shockMode: DriverShockMode;
  defaultSteps: number[];
  sensitivityEligible: true;
  applyShock: (assumptions: FullModelAssumptions, shock: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const ECONOMIC_DRIVER_REGISTRY: readonly EconomicDriverDefinition[] = [
  {
    id: 'tariff',
    label: 'PPA Tariff',
    category: 'revenue',
    sourcePath: 'revenue.baseTariffIdrPerKWh',
    unit: '%',
    shockMode: 'relative_pct',
    defaultSteps: [-10, -5, 0, 5, 10],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      a.revenue.baseTariffIdrPerKWh = Math.max(0, a.revenue.baseTariffIdrPerKWh * (1 + shock / 100));
      if (a.revenue.tariffComponents) {
        const factor = 1 + shock / 100;
        a.revenue.tariffComponents.componentA_CapitalRecoveryIdrPerKWh = Math.max(0, a.revenue.tariffComponents.componentA_CapitalRecoveryIdrPerKWh * factor);
        a.revenue.tariffComponents.componentB_FixedOpexIdrPerKWh = Math.max(0, a.revenue.tariffComponents.componentB_FixedOpexIdrPerKWh * factor);
        a.revenue.tariffComponents.componentC_WaterLevyIdrPerKWh = Math.max(0, a.revenue.tariffComponents.componentC_WaterLevyIdrPerKWh * factor);
        a.revenue.tariffComponents.componentD_VariableOpexIdrPerKWh = Math.max(0, a.revenue.tariffComponents.componentD_VariableOpexIdrPerKWh * factor);
      }
    },
  },
  {
    id: 'capacityFactor',
    label: 'Capacity Factor',
    category: 'operations',
    sourcePath: 'operating.capacityFactorPct',
    unit: '%',
    shockMode: 'relative_pct',
    defaultSteps: [-10, -5, 0, 5, 10],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      a.operating.capacityFactorPct = clamp(a.operating.capacityFactorPct * (1 + shock / 100), 0, 100);
    },
  },
  {
    id: 'interestRate',
    label: 'Senior Debt Interest Rate',
    category: 'funding',
    sourcePath: 'funding.bankInterestRatePct',
    unit: 'pp',
    shockMode: 'absolute',
    defaultSteps: [-1, -0.5, 0, 0.5, 1],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      a.funding.bankInterestRatePct = Math.max(0, a.funding.bankInterestRatePct + shock);
      // Preserve the current live-model convention until facility-level WACC inputs exist.
      a.valuation.costOfDebtPreTaxPct = a.funding.bankInterestRatePct;
    },
  },
  {
    id: 'capex',
    label: 'Base CAPEX',
    category: 'capex',
    sourcePath: 'capexItems[*].amountIdrBillion',
    unit: '%',
    shockMode: 'relative_pct',
    defaultSteps: [-20, -10, 0, 10, 20],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      a.capexItems = a.capexItems.map((item) => ({
        ...item,
        amountIdrBillion: Math.max(0, item.amountIdrBillion * (1 + shock / 100)),
      }));
    },
  },
  {
    id: 'fx',
    label: 'FX IDR/USD',
    category: 'market',
    sourcePath: 'revenue.fxIdrPerUsd',
    unit: '%',
    shockMode: 'relative_pct',
    defaultSteps: [-10, -5, 0, 5, 10],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      a.revenue.fxIdrPerUsd = Math.max(1, a.revenue.fxIdrPerUsd * (1 + shock / 100));
    },
  },
  {
    id: 'debtGearing',
    label: 'Senior Debt Gearing',
    category: 'funding',
    sourcePath: 'funding.bankDebtPct',
    unit: 'pp',
    shockMode: 'absolute',
    defaultSteps: [-10, -5, 0, 5, 10],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      const newDebt = clamp(a.funding.bankDebtPct + shock, 0, 100);
      const nonDebtShare = Math.max(0, 100 - newDebt);
      const originalSponsorFunding = a.funding.equityPct + a.funding.shareholderLoanPct;
      const equityMix = originalSponsorFunding > 0 ? a.funding.equityPct / originalSponsorFunding : 1;
      a.funding.bankDebtPct = newDebt;
      a.funding.equityPct = nonDebtShare * equityMix;
      a.funding.shareholderLoanPct = nonDebtShare * (1 - equityMix);
    },
  },
  {
    id: 'fixedOpex',
    label: 'Legacy Fixed OPEX',
    category: 'opex',
    sourcePath: 'opex.fixedOpexIdrBillion',
    unit: '%',
    shockMode: 'relative_pct',
    defaultSteps: [-20, -10, 0, 10, 20],
    sensitivityEligible: true,
    applyShock: (a, shock) => {
      a.opex.fixedOpexIdrBillion = Math.max(0, a.opex.fixedOpexIdrBillion * (1 + shock / 100));
      if (a.opex.customOpexItems) {
        a.opex.customOpexItems = a.opex.customOpexItems.map((item) => ({
          ...item,
          amountIdrBillion: Math.max(0, item.amountIdrBillion * (1 + shock / 100)),
        }));
      }
    },
  },
] as const;

export function getEconomicDriver(id: EconomicDriverId): EconomicDriverDefinition {
  const driver = ECONOMIC_DRIVER_REGISTRY.find((item) => item.id === id);
  if (!driver) throw new Error(`Unknown economic driver: ${id}`);
  return driver;
}

export function cloneAssumptions(input: FullModelAssumptions): FullModelAssumptions {
  return JSON.parse(JSON.stringify(input));
}

export function applyEconomicDriverShock(
  baseAssumptions: FullModelAssumptions,
  driverId: EconomicDriverId,
  shock: number
): FullModelAssumptions {
  if (!Number.isFinite(shock)) throw new Error(`Invalid sensitivity shock for ${driverId}`);
  const copy = cloneAssumptions(baseAssumptions);
  getEconomicDriver(driverId).applyShock(copy, shock);
  return copy;
}

export interface DriverArchitectureBlocker {
  id: string;
  area: 'funding' | 'opex' | 'ownership' | 'contract' | 'sensitivity';
  severity: 'BLOCKER' | 'MIGRATION';
  description: string;
}

/**
 * Explicitly records known structural limitations in the current legacy assumptions
 * schema. These are not guessed economics and they are not automatically repaired.
 */
export const LEGACY_DRIVER_ARCHITECTURE_BLOCKERS: readonly DriverArchitectureBlocker[] = [
  {
    id: 'single-debt-facility-schema',
    area: 'funding',
    severity: 'BLOCKER',
    description: 'FundingAssumptions represents one senior bank facility. Multi-facility debt economics must not be inferred until a facility registry is wired to the engine.',
  },
  {
    id: 'fixed-opex-schema',
    area: 'opex',
    severity: 'BLOCKER',
    description: 'OPEX is currently represented by fixed named fields rather than editable line items. Additional project-specific OPEX must not be hidden in code.',
  },
  {
    id: 'two-party-ownership-schema',
    area: 'ownership',
    severity: 'BLOCKER',
    description: 'Project ownership is currently limited to EPN participation plus one aggregate other-sponsor share. Sponsor-level economics require an explicit participant registry.',
  },
  {
    id: 'contract-structure-not-modeled',
    area: 'contract',
    severity: 'BLOCKER',
    description: 'BOO/BOOT/concession transfer economics are not represented as governed assumptions. Terminal or transfer value must remain unresolved until explicit contract inputs exist.',
  },
  {
    id: 'sensitivity-registry-migration',
    area: 'sensitivity',
    severity: 'MIGRATION',
    description: 'Only drivers registered in ECONOMIC_DRIVER_REGISTRY are sensitivity-enabled. New economic drivers must be registered explicitly rather than added as component-local hardcodes.',
  },
] as const;
