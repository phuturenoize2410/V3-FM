import { FullModelAssumptions } from '../types';
import {
  OpexLineItemDefinition,
  buildLegacyStructureCandidate,
} from './projectFinanceStructureRegistry';

export interface OpexEvaluationContext {
  yearIndex: number;
  outputKWh: number;
  capacityMW: number;
  capexIdrBillion: number;
  revenueIdrBillion: number;
  date?: string;
}

export interface OpexLineItemResult {
  id: string;
  description: string;
  amountIdrBillion: number;
  active: boolean;
  blockedReason?: string;
}

export interface OpexScheduleResult {
  lineItems: OpexLineItemResult[];
  totalOpexIdrBillion: number;
  blocked: boolean;
  blockers: string[];
}

function inEffectivePeriod(item: OpexLineItemDefinition, date?: string): boolean {
  if (!date) return true;
  const current = Date.parse(date);
  if (!Number.isFinite(current)) return false;
  if (item.startDate && current < Date.parse(item.startDate)) return false;
  if (item.endDate && current > Date.parse(item.endDate)) return false;
  return true;
}

function escalationFactor(item: OpexLineItemDefinition, yearIndex: number): number {
  const treatment = item.escalationTreatment ?? 'NONE';
  if (treatment === 'NONE') return 1;
  const escalationPct = item.escalationPct;
  if (escalationPct === undefined || !Number.isFinite(escalationPct) || escalationPct < 0) {
    return Number.NaN;
  }
  return Math.pow(1 + escalationPct / 100, Math.max(0, yearIndex));
}

export function evaluateOpexLineItems(
  items: OpexLineItemDefinition[],
  context: OpexEvaluationContext
): OpexScheduleResult {
  const blockers: string[] = [];
  const lineItems = items.map((item): OpexLineItemResult => {
    if (!item.active || !inEffectivePeriod(item, context.date)) {
      return { id: item.id, description: item.description, amountIdrBillion: 0, active: false };
    }
    if (!Number.isFinite(item.baseAmount) || item.baseAmount < 0) {
      const blockedReason = `OPEX line ${item.id} has an invalid base amount.`;
      blockers.push(blockedReason);
      return { id: item.id, description: item.description, amountIdrBillion: 0, active: true, blockedReason };
    }

    const escalation = escalationFactor(item, context.yearIndex);
    if (!Number.isFinite(escalation) || escalation < 0) {
      const blockedReason = `OPEX line ${item.id} has an invalid or unresolved escalation treatment.`;
      blockers.push(blockedReason);
      return { id: item.id, description: item.description, amountIdrBillion: 0, active: true, blockedReason };
    }

    let amount: number;
    switch (item.costDriver) {
      case 'FIXED_AMOUNT':
        amount = item.baseAmount * escalation;
        break;
      case 'PERCENT_OF_CAPEX':
        amount = context.capexIdrBillion * (item.baseAmount / 100) * escalation;
        break;
      case 'PERCENT_OF_REVENUE':
        amount = context.revenueIdrBillion * (item.baseAmount / 100) * escalation;
        break;
      case 'PER_OUTPUT_UNIT':
        amount = (context.outputKWh * item.baseAmount / 1e9) * escalation;
        break;
      case 'PER_CAPACITY_UNIT':
        amount = context.capacityMW * item.baseAmount * escalation;
        break;
      case 'CUSTOM': {
        const blockedReason = `OPEX line ${item.id} uses CUSTOM driver and requires an explicit calculation rule.`;
        blockers.push(blockedReason);
        return { id: item.id, description: item.description, amountIdrBillion: 0, active: true, blockedReason };
      }
    }
    if (!Number.isFinite(amount) || amount < 0) {
      const blockedReason = `OPEX line ${item.id} produced an invalid amount.`;
      blockers.push(blockedReason);
      return { id: item.id, description: item.description, amountIdrBillion: 0, active: true, blockedReason };
    }
    return { id: item.id, description: item.description, amountIdrBillion: amount, active: true };
  });

  return {
    lineItems,
    totalOpexIdrBillion: lineItems.reduce((sum, row) => sum + row.amountIdrBillion, 0),
    blocked: blockers.length > 0,
    blockers,
  };
}

/**
 * Backward-compatible reconciliation helper. It converts only economics that
 * already exist in FullModelAssumptions into line items, then evaluates them.
 * No new OPEX category, escalation, unit price or project term is invented.
 */
export function evaluateLegacyOpexThroughLineItems(
  assumptions: FullModelAssumptions,
  context: OpexEvaluationContext
): OpexScheduleResult {
  return evaluateOpexLineItems(buildLegacyStructureCandidate(assumptions).opexLineItems, context);
}
