// utils/money.ts

export function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Formats money without hard-coding CAD.
 * Uses the browser/user locale and defaults currency to USD unless provided.
 * For USD, uses narrowSymbol to display "$" instead of "US$".
 */
export function formatMoney(amount: number, currency = "USD", locale?: string) {
  const value = round2(Number(amount) || 0);

  const formatted = new Intl.NumberFormat(locale || undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    // Use narrowSymbol for USD to show "$" instead of "US$"
    ...(currency === "USD" ? { currencyDisplay: "narrowSymbol" as const } : {}),
  }).format(value);

  // Fallback: replace "US$" with "$" if narrowSymbol didn't work or wasn't supported
  return currency === "USD" ? formatted.replace(/^US\$/, "$") : formatted;
}
