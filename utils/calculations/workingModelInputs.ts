import type { FullModelAssumptions } from '../types';

/** Session working inputs. Source declarations are retained, never authenticated or approved here. */
export interface WorkingInputMetadata {
  projectId: string;
  modelProjectName: string;
  sourceReference: string;
  version: string;
  effectiveDate: string;
  changeReason: string;
  status: 'DRAFT';
}
export interface WorkingTimeline extends WorkingInputMetadata {
  constructionStartDate: string;
  codDate: string;
  constructionPeriodMonths: number;
  operatingPeriodYears: number;
  repaymentPeriodYears: number;
  milestones: Array<{ id: string; type: string; plannedDate: string | null; currentDate: string | null; actualDate: string | null; sourceReference: string }>;
}
export interface WorkingOpexAnnualQuantity { year: number; quantity: number }
export interface WorkingOpexLine {
  id: string;
  description: string;
  enabled: boolean;
  kind: 'FIXED_ANNUAL' | 'PER_UNIT' | 'PERCENT_OF_DRIVER';
  amount: number;
  currency: 'IDR';
  amountScale: 1000000000;
  unit: string;
  driver: 'NONE' | 'EXPLICIT_QUANTITY' | 'MODEL_REVENUE' | 'MODEL_CAPITALIZED_BASIS';
  /** Explicit year-keyed quantities are preferred; numeric arrays remain compatibility input for existing admitted/test payloads. */
  quantities: Array<number | WorkingOpexAnnualQuantity>;
  escalationPct: number;
  firstOperatingYear: number;
  lastOperatingYear: number;
  sourceReference: string;
}
export interface WorkingOpex extends WorkingInputMetadata {
  populationComplete: true;
  lines: WorkingOpexLine[];
}
export interface WorkingModelInputs { timeline?: WorkingTimeline; opex?: WorkingOpex }
export const exactDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const identity = (v: unknown) => typeof v === 'string' && v.length > 0 && v.trim() === v;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown): v is number => finite(v) && Number.isInteger(v) && v > 0;

function validateAnnualQuantities(quantities: unknown, operatingPeriodYears: number): string | null {
  if (!Array.isArray(quantities)) return 'quantities must be an explicit array.';
  if (quantities.length !== operatingPeriodYears) return 'per-unit costs require an explicit complete annual quantity population in the stated unit.';
  if (quantities.every(q => finite(q))) return quantities.some(q => (q as number) < 0) ? 'annual quantities must be finite and non-negative.' : null;
  const years = new Set<number>();
  for (const row of quantities) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return 'annual quantities must use one consistent numeric or year-keyed representation.';
    const { year, quantity } = row as { year?: unknown; quantity?: unknown };
    if (!integer(year) || year > operatingPeriodYears || years.has(year)) return 'year-keyed annual quantities require each operating year exactly once.';
    if (!finite(quantity) || quantity < 0) return 'annual quantities must be finite and non-negative.';
    years.add(year);
  }
  for (let year = 1; year <= operatingPeriodYears; year += 1) if (!years.has(year)) return 'year-keyed annual quantities require each operating year exactly once.';
  return null;
}

function quantityForYear(quantities: WorkingOpexLine['quantities'], year: number): number {
  const first = quantities[0];
  if (typeof first === 'number') return quantities[year - 1] as number;
  const row = quantities.find(q => typeof q === 'object' && q !== null && q.year === year);
  if (!row || typeof row === 'number') throw new Error(`OPEX annual quantity for operating year ${year} is missing.`);
  return row.quantity;
}

export function validateWorkingInput(kind: 'timeline' | 'opex', value: unknown, assumptions: FullModelAssumptions): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['An explicit input object is required.'];
  const v = value as any;
  const blockers: string[] = [];
  for (const key of ['projectId', 'modelProjectName', 'sourceReference', 'version', 'changeReason']) if (!identity(v[key])) blockers.push(`${key} must be explicit and non-empty.`);
  if (v.modelProjectName !== assumptions.project.projectName) blockers.push('modelProjectName must match the current model exactly.');
  if (v.status !== 'DRAFT') blockers.push('Only DRAFT working inputs are admitted; this is not an approval or persistence boundary.');
  if (!exactDate(v.effectiveDate)) blockers.push('effectiveDate must be a real calendar date.');
  const other = assumptions.workingInputs?.[kind === 'timeline' ? 'opex' : 'timeline'];
  if (other && other.projectId !== v.projectId) blockers.push('Project identity must match the other active working input.');
  if (kind === 'timeline') {
    if (!exactDate(v.constructionStartDate) || !exactDate(v.codDate) || v.codDate <= v.constructionStartDate) blockers.push('Construction start and COD must be valid ordered dates.');
    for (const k of ['constructionPeriodMonths', 'operatingPeriodYears', 'repaymentPeriodYears']) if (!integer(v[k])) blockers.push(`${k} must be an explicit positive whole number.`);
    if (v.operatingPeriodYears > 100 || v.constructionPeriodMonths > 1200) blockers.push('Timeline exceeds the supported calculation horizon.');
    if (v.repaymentPeriodYears > v.operatingPeriodYears) blockers.push('Debt repayment cannot extend beyond the modeled operating horizon.');
    if (exactDate(v.constructionStartDate) && exactDate(v.codDate) && integer(v.constructionPeriodMonths)) {
      const start = new Date(v.constructionStartDate + 'T00:00:00Z');
      start.setUTCMonth(start.getUTCMonth() + v.constructionPeriodMonths);
      if (start.toISOString().slice(0, 10) !== v.codDate) blockers.push('COD must equal construction start plus the stated whole-month duration; partial-period phasing is not supported.');
    }
    if (assumptions.capexItems.some(i => i.endMonth > v.constructionPeriodMonths)) blockers.push('CAPEX timing extends beyond construction. Edit CAPEX explicitly before shortening the schedule.');
    if (!Array.isArray(v.milestones)) blockers.push('milestones must be an explicit array (empty is allowed).');
    else {
      const ids = new Set();
      for (const m of v.milestones) {
        if (!m || !identity(m.id) || ids.has(m.id) || !identity(m.type) || !identity(m.sourceReference)) { blockers.push('Milestones require unique identity, type and source.'); continue; }
        ids.add(m.id);
        for (const k of ['plannedDate', 'currentDate', 'actualDate']) if (m[k] !== null && !exactDate(m[k])) blockers.push(`Milestone ${m.id}: ${k} must be a real date or explicit null.`);
      }
    }
    const opex = assumptions.workingInputs?.opex;
    if (opex) blockers.push(...validateWorkingInput('opex', opex, { ...assumptions, project: { ...assumptions.project, operatingPeriodYears: v.operatingPeriodYears } }));
  } else {
    if (v.populationComplete !== true || !Array.isArray(v.lines)) return [...blockers, 'An explicitly complete OPEX line population is required.'];
    const ids = new Set();
    for (const line of v.lines) {
      if (!line || typeof line !== 'object') { blockers.push('Malformed OPEX line.'); continue; }
      if (!identity(line.id) || ids.has(line.id) || !identity(line.description) || !identity(line.sourceReference) || !identity(line.unit)) blockers.push('Each OPEX line needs unique identity, description, unit and source.');
      ids.add(line.id);
      if (typeof line.enabled !== 'boolean') blockers.push(`${line.id}: enabled must be explicit.`);
      if (!finite(line.amount) || line.amount < 0 || !finite(line.escalationPct) || line.escalationPct < 0) blockers.push(`${line.id}: amount and escalation must be finite, explicit and non-negative.`);
      if (line.currency !== 'IDR' || line.amountScale !== 1e9) blockers.push(`${line.id}: this adapter accepts IDR billion only; no FX or scale inference.`);
      if (!integer(line.firstOperatingYear) || !integer(line.lastOperatingYear) || line.firstOperatingYear > line.lastOperatingYear || line.lastOperatingYear > assumptions.project.operatingPeriodYears) blockers.push(`${line.id}: effective years must lie within the model horizon.`);
      if (line.kind === 'FIXED_ANNUAL') {
        if (line.driver !== 'NONE' || line.unit !== 'IDR_BILLION_PER_YEAR') blockers.push(`${line.id}: fixed cost requires NONE driver and IDR_BILLION_PER_YEAR unit.`);
      } else if (line.kind === 'PER_UNIT') {
        if (line.driver !== 'EXPLICIT_QUANTITY') blockers.push(`${line.id}: per-unit costs require EXPLICIT_QUANTITY driver.`);
        const quantityBlocker = validateAnnualQuantities(line.quantities, assumptions.project.operatingPeriodYears);
        if (quantityBlocker) blockers.push(`${line.id}: ${quantityBlocker}`);
      } else if (line.kind === 'PERCENT_OF_DRIVER') {
        if (!['MODEL_REVENUE', 'MODEL_CAPITALIZED_BASIS'].includes(line.driver) || line.unit !== 'PERCENT') blockers.push(`${line.id}: percentage cost requires an explicit model driver and PERCENT unit.`);
      } else blockers.push(`${line.id}: unsupported cost kind.`);
      if (!Array.isArray(line.quantities)) blockers.push(`${line.id}: quantities must be explicit (empty for non-unit costs).`);
      if (finite(line.amount) && finite(line.escalationPct) && !Number.isFinite(line.amount * Math.pow(1 + line.escalationPct / 100, assumptions.project.operatingPeriodYears - 1))) blockers.push(`${line.id}: escalation overflows the modeled horizon.`);
    }
  }
  return blockers;
}

export function applyWorkingInput(assumptions: FullModelAssumptions, kind: 'timeline' | 'opex', value: unknown): FullModelAssumptions {
  const blockers = validateWorkingInput(kind, value, assumptions);
  if (blockers.length) throw new Error(blockers.join(' '));
  const input = JSON.parse(JSON.stringify(value));
  return {
    ...assumptions,
    ...(kind === 'timeline' ? {
      project: { ...assumptions.project, constructionStartDate: input.constructionStartDate, codDate: input.codDate, constructionPeriodMonths: input.constructionPeriodMonths, operatingPeriodYears: input.operatingPeriodYears },
      funding: { ...assumptions.funding, repaymentPeriodYears: input.repaymentPeriodYears },
    } : {}),
    workingInputs: { ...assumptions.workingInputs, [kind]: input },
  };
}

/** Generic annual cost engine. Electricity output/levies are not implied drivers. */
export function evaluateWorkingOpex(master: WorkingOpex, year: number, revenue: number, capitalizedBasis: number) {
  const lines = master.lines.map(line => {
    if (!line.enabled || year < line.firstOperatingYear || year > line.lastOperatingYear) return { id: line.id, amount: 0, state: 'NOT_APPLICABLE' as const };
    const basis = line.kind === 'FIXED_ANNUAL' ? 1 : line.kind === 'PER_UNIT' ? quantityForYear(line.quantities, year) : (line.driver === 'MODEL_REVENUE' ? revenue : capitalizedBasis) / 100;
    const amount = line.amount * basis * Math.pow(1 + line.escalationPct / 100, year - 1);
    if (!Number.isFinite(amount)) throw new Error(`OPEX ${line.id} is blocked: non-finite driver or result.`);
    return { id: line.id, amount, state: amount === 0 ? 'EXPLICIT_ZERO' as const : 'VALUE' as const };
  });
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  if (!Number.isFinite(total)) throw new Error('OPEX total is blocked: numeric overflow.');
  return { lines, total };
}
