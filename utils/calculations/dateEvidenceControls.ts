/*
 * Shared date-evidence controls for governed finance workflows.
 *
 * Boundary:
 * - This module validates parseability and catches impossible calendar dates for
 *   canonical YYYY-MM-DD tokens.
 * - It deliberately does not require ISO-only input because the current import
 *   contract does not yet define one canonical external date serialization.
 * - Runtime evidence may arrive from serialized/external sources, so non-string
 *   date values fail closed instead of throwing while attempting string methods.
 * - Callers must not infer timezone, business-day, cutoff or commercial semantics here.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateEvidence(value?: unknown): boolean {
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  if (!normalized) return false;

  const parsed = new Date(normalized).getTime();
  if (!Number.isFinite(parsed)) return false;

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(normalized);
  if (!dateOnlyMatch) return true;

  const year = Number(dateOnlyMatch[1]);
  const month = Number(dateOnlyMatch[2]);
  const day = Number(dateOnlyMatch[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
  );
}
