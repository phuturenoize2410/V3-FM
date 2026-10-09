export type PpeDepreciationMethod = 'STRAIGHT_LINE';
export type PpeDepreciationStartConvention = 'PLACED_IN_SERVICE_DATE';

export interface PpeSourcePolicyEvidence {
  evidenceUse: 'source_evidence';
  projectId: string;
  sourceReference: string;
  version: string;
  effectiveDate: string;
  accountingPolicyReference: string;
  depreciationMethod: PpeDepreciationMethod;
  depreciationStartConvention: PpeDepreciationStartConvention;
  usefulLifeYears: number;
  residualValuePercent: number;
  componentization: 'SINGLE_ASSET_POOL';
}

export interface PpeSourcePolicyReview {
  ready: boolean;
  policy: Readonly<PpeSourcePolicyEvidence> | null;
  blockers: readonly string[];
}

const exact = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;

const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/**
 * Admit only source-owned accounting policy mechanics that the current engine can
 * represent exactly. Unsupported policy is blocked rather than translated into a
 * compatibility assumption. This boundary is deliberately asset-generic.
 */
export function reviewPpeSourcePolicyEvidence(input: unknown): PpeSourcePolicyReview {
  const blockers: string[] = [];
  const policy = input as Partial<PpeSourcePolicyEvidence> | null | undefined;

  if (policy?.evidenceUse !== 'source_evidence') {
    blockers.push('Explicit source evidence is required for PPE accounting policy.');
  }
  for (const key of ['projectId', 'sourceReference', 'version', 'accountingPolicyReference'] as const) {
    if (!exact(policy?.[key])) blockers.push(`${key} is missing or malformed.`);
  }
  if (!validDate(policy?.effectiveDate)) blockers.push('A real effective calendar date is required.');

  if (policy?.depreciationMethod !== 'STRAIGHT_LINE') {
    blockers.push('Depreciation method is unsupported by the current governed PPE engine.');
  }
  if (policy?.depreciationStartConvention !== 'PLACED_IN_SERVICE_DATE') {
    blockers.push('Depreciation start convention is unsupported by the current governed PPE engine.');
  }
  if (policy?.componentization !== 'SINGLE_ASSET_POOL') {
    blockers.push('Componentization policy is unsupported by the current governed PPE engine.');
  }
  if (typeof policy?.usefulLifeYears !== 'number' || !Number.isFinite(policy.usefulLifeYears) || policy.usefulLifeYears <= 0) {
    blockers.push('Useful life must be an explicit positive finite number of years.');
  }
  if (
    typeof policy?.residualValuePercent !== 'number' ||
    !Number.isFinite(policy.residualValuePercent) ||
    policy.residualValuePercent < 0 ||
    policy.residualValuePercent >= 100
  ) {
    blockers.push('Residual value percent must be explicit and in the range [0, 100).');
  }

  if (blockers.length || !policy) return { ready: false, policy: null, blockers };

  const retained = JSON.parse(JSON.stringify(policy)) as PpeSourcePolicyEvidence;
  return { ready: true, policy: deepFreeze(retained), blockers: [] };
}
