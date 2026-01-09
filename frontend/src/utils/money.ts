// utils/money.ts

export function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Formats money without hard-coding CAD.
 * Uses the browser/user locale and defaults currency to USD unless provided.
 */
export function formatMoney(amount: number, currency = "USD", locale?: string) {
  const value = round2(Number(amount) || 0);

  return new Intl.NumberFormat(locale || undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
