export type FinancialValue =
  | { state: 'VALUE' | 'EXPLICIT_ZERO'; value: number; source: string }
  | { state: 'MISSING' | 'BLOCKED' | 'NOT_APPLICABLE'; value: null; source: string; reason: string };
export function financialValue(value: unknown, source: string): FinancialValue {
  if (value === null || value === undefined) return { state: 'MISSING', value: null, source, reason: 'Required input is missing.' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { state: 'BLOCKED', value: null, source, reason: 'Required input is not finite.' };
  return { state: value === 0 ? 'EXPLICIT_ZERO' : 'VALUE', value, source };
}
export function dependentValue(value: unknown, source: string, dependencies: FinancialValue[]): FinancialValue {
  const unavailable = dependencies.filter(d => d.value === null);
  return unavailable.length ? { state: 'BLOCKED', value: null, source, reason: unavailable.map(d => `${d.source}: ${'reason' in d ? d.reason : d.state}`).join(' ') } : financialValue(value, source);
}
export function displayFinancialValue(v: FinancialValue, factor = 1, decimals = 1): string {
  if (v.value === null) return { MISSING: 'Missing', BLOCKED: 'Blocked', NOT_APPLICABLE: 'Not Applicable' }[v.state];
  const amount = v.value * factor;
  return Number.isFinite(amount) ? amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : 'Blocked';
}
