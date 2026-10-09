import { FullModelAssumptions } from '../types';

/**
 * Asset-generic configuration primitives for the next migration step away from
 * fixed project-finance business structures. These schemas are intentionally
 * not wired into live economics yet; doing so requires explicit project inputs
 * and reconciliation to the existing model before replacing legacy fields.
 */

export type ProjectOwnershipModel = 'BOO' | 'BOOT' | 'CONCESSION' | 'OTHER';
export type DebtRepaymentMode = 'SCULPTED' | 'ANNUITY' | 'STRAIGHT_LINE' | 'BULLET' | 'CUSTOM';
export type OpexCostDriver =
  | 'FIXED_AMOUNT'
  | 'PERCENT_OF_CAPEX'
  | 'PERCENT_OF_REVENUE'
  | 'PER_OUTPUT_UNIT'
  | 'PER_CAPACITY_UNIT'
  | 'CUSTOM';
export type OpexEscalationTreatment = 'NONE' | 'FIXED_RATE';

export interface SponsorParticipant {
  id: string;
  name: string;
  role?: string;
  equityPct: number;
  shareholderLoanPct?: number;
  fundingCommitmentIdrBillion?: number;
  currency?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  active: boolean;
}

export interface DebtFacilityDefinition {
  id: string;
  name: string;
  type: string;
  currency: string;
  active: boolean;
  commitmentAmount?: number;
  commitmentAmountUnit?: 'IDR_BILLION' | 'USD_MILLION' | 'PERCENT_OF_ELIGIBLE_USES';
  availabilityStartDate?: string;
  availabilityEndDate?: string;
  baseRatePct?: number;
  marginPct?: number;
  fixedInterestRatePct?: number;
  upfrontFeePct?: number;
  commitmentFeePct?: number;
  gracePeriodMonths?: number;
  maturityDate?: string;
  repaymentMode: DebtRepaymentMode;
  repaymentPeriodYears?: number;
  targetDscr?: number;
  balloonPct?: number;
  cashSweepPct?: number;
  dsraMonths?: number;
  ranking?: 'SENIOR' | 'SUBORDINATED' | 'SHAREHOLDER' | 'OTHER';
  refinanceOfFacilityId?: string;
  notes?: string;
}

export interface OpexLineItemDefinition {
  id: string;
  category: string;
  description: string;
  active: boolean;
  costDriver: OpexCostDriver;
  baseAmount: number;
  unit: string;
  escalationTreatment?: OpexEscalationTreatment;
  escalationPct?: number;
  startDate?: string;
  endDate?: string;
  sensitivityEligible?: boolean;
  notes?: string;
}

export interface ProjectContractStructure {
  ownershipModel: ProjectOwnershipModel;
  concessionStartDate?: string;
  concessionEndDate?: string;
  assetTransferRequired?: boolean;
  transferValueMethod?: 'ZERO' | 'FIXED_AMOUNT' | 'FORMULA' | 'UNRESOLVED';
  transferValue?: number;
  transferValueUnit?: string;
  terminalValueAllowed?: boolean;
  terminalValueMethod?: 'FIXED_AMOUNT' | 'FORMULA' | 'UNRESOLVED';
  terminalValue?: number;
  notes?: string;
}

export interface ProjectFinanceStructureRegistry {
  sponsors: SponsorParticipant[];
  debtFacilities: DebtFacilityDefinition[];
  opexLineItems: OpexLineItemDefinition[];
  contract: ProjectContractStructure;
}

export interface StructureValidationIssue {
  id: string;
  severity: 'ERROR' | 'WARNING';
  area: 'ownership' | 'debt' | 'opex' | 'contract';
  message: string;
}

function finiteNonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

export function validateProjectFinanceStructure(
  registry: ProjectFinanceStructureRegistry
): StructureValidationIssue[] {
  const issues: StructureValidationIssue[] = [];

  const activeSponsors = registry.sponsors.filter((s) => s.active);
  const equityTotal = activeSponsors.reduce((sum, s) => sum + (Number.isFinite(s.equityPct) ? s.equityPct : 0), 0);
  if (activeSponsors.length === 0) {
    issues.push({ id: 'ownership-no-active-sponsor', severity: 'ERROR', area: 'ownership', message: 'At least one active sponsor is required before sponsor-level economics can be released.' });
  }
  if (Math.abs(equityTotal - 100) > 1e-6) {
    issues.push({ id: 'ownership-equity-total', severity: 'ERROR', area: 'ownership', message: `Active sponsor equity percentages total ${equityTotal.toFixed(6)}%, not 100%.` });
  }

  const sponsorIds = new Set<string>();
  for (const sponsor of activeSponsors) {
    if (!sponsor.id.trim() || sponsorIds.has(sponsor.id)) {
      issues.push({ id: `ownership-sponsor-id-${sponsor.id || 'blank'}`, severity: 'ERROR', area: 'ownership', message: 'Sponsor IDs must be non-empty and unique.' });
    }
    sponsorIds.add(sponsor.id);
    if (!finiteNonNegative(sponsor.equityPct) || !finiteNonNegative(sponsor.shareholderLoanPct)) {
      issues.push({ id: `ownership-negative-${sponsor.id}`, severity: 'ERROR', area: 'ownership', message: `Sponsor ${sponsor.id} contains an invalid negative/non-finite participation value.` });
    }
  }

  const facilityIds = new Set<string>();
  for (const facility of registry.debtFacilities.filter((f) => f.active)) {
    if (!facility.id.trim() || facilityIds.has(facility.id)) {
      issues.push({ id: `debt-facility-id-${facility.id || 'blank'}`, severity: 'ERROR', area: 'debt', message: 'Debt facility IDs must be non-empty and unique.' });
    }
    facilityIds.add(facility.id);
    if (!finiteNonNegative(facility.commitmentAmount) || !finiteNonNegative(facility.baseRatePct) || !finiteNonNegative(facility.marginPct) || !finiteNonNegative(facility.fixedInterestRatePct) || !finiteNonNegative(facility.balloonPct) || !finiteNonNegative(facility.cashSweepPct)) {
      issues.push({ id: `debt-invalid-value-${facility.id}`, severity: 'ERROR', area: 'debt', message: `Debt facility ${facility.id} contains an invalid negative/non-finite economic input.` });
    }
    if (facility.repaymentMode === 'SCULPTED' && !(facility.targetDscr && facility.targetDscr > 0)) {
      issues.push({ id: `debt-sculpt-target-${facility.id}`, severity: 'ERROR', area: 'debt', message: `Sculpted facility ${facility.id} requires an explicit positive target DSCR.` });
    }
    if (facility.balloonPct !== undefined && facility.balloonPct > 100) {
      issues.push({ id: `debt-balloon-${facility.id}`, severity: 'ERROR', area: 'debt', message: `Facility ${facility.id} balloon percentage cannot exceed 100%.` });
    }
    if (facility.cashSweepPct !== undefined && facility.cashSweepPct > 100) {
      issues.push({ id: `debt-cash-sweep-${facility.id}`, severity: 'ERROR', area: 'debt', message: `Facility ${facility.id} cash-sweep percentage cannot exceed 100%.` });
    }
  }

  const opexIds = new Set<string>();
  for (const item of registry.opexLineItems.filter((o) => o.active)) {
    if (!item.id.trim() || opexIds.has(item.id)) {
      issues.push({ id: `opex-line-id-${item.id || 'blank'}`, severity: 'ERROR', area: 'opex', message: 'OPEX line-item IDs must be non-empty and unique.' });
    }
    opexIds.add(item.id);
    if (!Number.isFinite(item.baseAmount) || item.baseAmount < 0) {
      issues.push({ id: `opex-invalid-base-${item.id}`, severity: 'ERROR', area: 'opex', message: `OPEX line ${item.id} requires a finite non-negative base amount.` });
    }
    const escalationTreatment = item.escalationTreatment ?? 'NONE';
    if (escalationTreatment === 'FIXED_RATE' && !finiteNonNegative(item.escalationPct)) {
      issues.push({ id: `opex-invalid-escalation-${item.id}`, severity: 'ERROR', area: 'opex', message: `OPEX line ${item.id} requires a finite non-negative escalation rate when FIXED_RATE is selected.` });
    }
    if (escalationTreatment === 'FIXED_RATE' && item.escalationPct === undefined) {
      issues.push({ id: `opex-missing-escalation-${item.id}`, severity: 'ERROR', area: 'opex', message: `OPEX line ${item.id} requires an explicit escalation rate when FIXED_RATE is selected.` });
    }
  }

  const contract = registry.contract;
  if (contract.assetTransferRequired) {
    if (!contract.transferValueMethod || contract.transferValueMethod === 'UNRESOLVED') {
      issues.push({ id: 'contract-transfer-unresolved', severity: 'ERROR', area: 'contract', message: 'Asset transfer is required but transfer-value treatment is unresolved.' });
    }
    if (contract.transferValueMethod === 'FIXED_AMOUNT' && !finiteNonNegative(contract.transferValue)) {
      issues.push({ id: 'contract-transfer-invalid', severity: 'ERROR', area: 'contract', message: 'Fixed transfer value must be finite and non-negative.' });
    }
  }
  if (contract.terminalValueAllowed && (!contract.terminalValueMethod || contract.terminalValueMethod === 'UNRESOLVED')) {
    issues.push({ id: 'contract-terminal-unresolved', severity: 'ERROR', area: 'contract', message: 'Terminal value is enabled but its calculation method remains unresolved.' });
  }

  return issues;
}

/**
 * Non-destructive adapter from the current legacy assumptions into the new
 * structure registry. It preserves only economics explicitly present today and
 * marks missing contractual detail as unresolved. It must not be interpreted as
 * a migration of the live engine yet.
 */
export function buildLegacyStructureCandidate(
  assumptions: FullModelAssumptions
): ProjectFinanceStructureRegistry {
  const otherSponsorPct = assumptions.project.otherSponsorParticipationPct;
  const sponsors: SponsorParticipant[] = [
    {
      id: 'legacy-primary-sponsor',
      name: assumptions.project.sponsorName || 'Primary Sponsor',
      equityPct: assumptions.project.epnParticipationPct,
      active: true,
    },
  ];

  if (otherSponsorPct > 0) {
    sponsors.push({
      id: 'legacy-other-sponsors-aggregate',
      name: 'Other Sponsors (Aggregate)',
      equityPct: otherSponsorPct,
      active: true,
    });
  }

  const debtFacilities: DebtFacilityDefinition[] = assumptions.funding.bankDebtPct > 0
    ? [{
        id: 'legacy-senior-bank-facility',
        name: 'Legacy Senior Bank Facility',
        type: 'TERM_LOAN',
        currency: 'IDR',
        active: true,
        commitmentAmount: assumptions.funding.bankDebtPct,
        commitmentAmountUnit: 'PERCENT_OF_ELIGIBLE_USES',
        fixedInterestRatePct: assumptions.funding.bankInterestRatePct,
        upfrontFeePct: assumptions.funding.upfrontFeePct,
        commitmentFeePct: assumptions.funding.commitmentFeePct,
        gracePeriodMonths: assumptions.funding.gracePeriodMonths,
        repaymentMode: assumptions.funding.amortizationType === 'sculpted'
          ? 'SCULPTED'
          : assumptions.funding.amortizationType === 'annuity'
            ? 'ANNUITY'
            : 'STRAIGHT_LINE',
        repaymentPeriodYears: assumptions.funding.repaymentPeriodYears,
        targetDscr: assumptions.funding.targetDscrForSculpting,
        dsraMonths: assumptions.funding.dsraRequirementMonths,
        ranking: 'SENIOR',
      }]
    : [];

  const generalOpexEscalationPct = assumptions.operating.annualOpexEscalationPct;
  const opexLineItems: OpexLineItemDefinition[] = [
    { id: 'legacy-fixed-opex', category: 'operations', description: 'Legacy Fixed OPEX', active: true, costDriver: 'FIXED_AMOUNT', baseAmount: assumptions.opex.fixedOpexIdrBillion, unit: 'IDR_BILLION_PER_YEAR', escalationTreatment: 'FIXED_RATE', escalationPct: generalOpexEscalationPct, sensitivityEligible: true },
    { id: 'legacy-variable-opex', category: 'operations', description: 'Legacy Variable OPEX', active: true, costDriver: 'PER_OUTPUT_UNIT', baseAmount: assumptions.opex.variableOpexIdrPerKWh, unit: 'IDR_PER_KWH', escalationTreatment: 'FIXED_RATE', escalationPct: generalOpexEscalationPct, sensitivityEligible: true },
    {
      id: 'legacy-insurance',
      category: 'insurance',
      description: 'Legacy Insurance',
      active: true,
      costDriver: 'PERCENT_OF_CAPEX',
      baseAmount: assumptions.opex.insurancePctOfCapex,
      unit: 'PERCENT_OF_CAPEX',
      escalationTreatment: 'NONE',
      sensitivityEligible: true,
      notes: 'Legacy reference economics calculate insurance as a constant percentage of initial capitalized PPE with no annual escalation. Future project-specific insurance escalation must be supplied explicitly rather than inferred from general OPEX escalation.',
    },
    { id: 'legacy-land-water', category: 'land_water', description: 'Legacy Land / Water Charges', active: true, costDriver: 'FIXED_AMOUNT', baseAmount: assumptions.opex.landWaterChargesIdrBillion, unit: 'IDR_BILLION_PER_YEAR', escalationTreatment: 'FIXED_RATE', escalationPct: generalOpexEscalationPct, sensitivityEligible: true },
    { id: 'legacy-admin-employees', category: 'admin', description: 'Legacy Admin / Employees', active: true, costDriver: 'FIXED_AMOUNT', baseAmount: assumptions.opex.adminEmployeesIdrBillion, unit: 'IDR_BILLION_PER_YEAR', escalationTreatment: 'FIXED_RATE', escalationPct: generalOpexEscalationPct, sensitivityEligible: true },
    { id: 'legacy-maintenance-reserve', category: 'maintenance', description: 'Legacy Maintenance Reserve', active: true, costDriver: 'FIXED_AMOUNT', baseAmount: assumptions.opex.maintenanceReserveIdrBillion, unit: 'IDR_BILLION_PER_YEAR', escalationTreatment: 'FIXED_RATE', escalationPct: generalOpexEscalationPct, sensitivityEligible: true },
  ];

  return {
    sponsors,
    debtFacilities,
    opexLineItems,
    contract: {
      ownershipModel: 'OTHER',
      concessionEndDate: assumptions.project.codDate && assumptions.project.operatingPeriodYears
        ? undefined
        : undefined,
      assetTransferRequired: undefined,
      transferValueMethod: 'UNRESOLVED',
      terminalValueAllowed: false,
      terminalValueMethod: 'UNRESOLVED',
      notes: 'Legacy assumptions do not encode BOO/BOOT/transfer economics; no contractual treatment has been inferred.',
    },
  };
}
