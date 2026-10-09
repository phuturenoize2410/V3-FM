import { FullModelAssumptions } from '../types';
import { evaluateLegacyOpexThroughLineItems, OpexEvaluationContext } from './opexLineItemEngine';

export interface LegacyOpexReference {
  fixedOpexIdrBillion: number;
  variableOpexIdrBillion: number;
  insuranceIdrBillion: number;
  landWaterChargesIdrBillion: number;
  adminEmployeesIdrBillion: number;
  maintenanceReserveIdrBillion: number;
}

export interface OpexReconciliationDiagnostic {
  passed: boolean;
  legacyTotalIdrBillion: number;
  lineItemTotalIdrBillion: number;
  differenceIdrBillion: number;
  toleranceIdrBillion: number;
  blockers: string[];
}

export function reconcileLegacyOpexToLineItems(
  assumptions: FullModelAssumptions,
  context: OpexEvaluationContext,
  legacy: LegacyOpexReference,
  toleranceIdrBillion = 1e-8
): OpexReconciliationDiagnostic {
  const evaluated = evaluateLegacyOpexThroughLineItems(assumptions, context);
  const legacyTotal =
    legacy.fixedOpexIdrBillion +
    legacy.variableOpexIdrBillion +
    legacy.insuranceIdrBillion +
    legacy.landWaterChargesIdrBillion +
    legacy.adminEmployeesIdrBillion +
    legacy.maintenanceReserveIdrBillion;
  const difference = evaluated.totalOpexIdrBillion - legacyTotal;

  return {
    passed: !evaluated.blocked && Math.abs(difference) <= toleranceIdrBillion,
    legacyTotalIdrBillion: legacyTotal,
    lineItemTotalIdrBillion: evaluated.totalOpexIdrBillion,
    differenceIdrBillion: difference,
    toleranceIdrBillion,
    blockers: evaluated.blockers,
  };
}
