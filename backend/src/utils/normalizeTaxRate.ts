/**
 * Normalizes tax rate input to a percent number (0–100).
 *
 * - null/undefined/NaN → null
 * - input <= 1 → treat as decimal (e.g. 0.13 → 13)
 * - input > 1 → treat as percent (e.g. 13 → 13)
 * - Clamped to 0..100, rounded to 2 decimals
 */
export function normalizeTaxRatePercent(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;

  const percent = n <= 1 ? n * 100 : n;
  const clamped = Math.max(0, Math.min(100, percent));
  return Math.round(clamped * 100) / 100;
}
