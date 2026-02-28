// backend/src/lib/ga.ts
type GaParams = Record<string, string | number | boolean | undefined | null>;

export async function gaEvent(opts: {
  clientId: string;                // use accountId (string)
  name: string;                    // event name
  params?: GaParams;               // optional metadata (no PII)
}) {
  const measurementId = process.env.GA4_APP_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_APP_API_SECRET;

  // Safe no-op if not configured (dev, preview, etc.)
  if (!measurementId || !apiSecret) return;

  // Optional: don’t send from local/dev unless you want to
  if (process.env.NODE_ENV !== "production") return;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    measurementId
  )}&api_secret=${encodeURIComponent(apiSecret)}`;

  const body = {
    client_id: opts.clientId,
    events: [
      {
        name: opts.name,
        params: {
          ...opts.params,
          // nice to have for filtering
          env: process.env.NODE_ENV,
        },
      },
    ],
  };

  // Fire-and-forget: never block your API response on GA
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}