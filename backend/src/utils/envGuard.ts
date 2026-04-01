// backend/src/utils/envGuard.ts

function present(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function assertStripeEnvIsolation() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  const sk = process.env.STRIPE_SECRET_KEY;
  const whsecLive = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  const whsecTest = process.env.STRIPE_WEBHOOK_SECRET_TEST;

  const PRICE_KEYS_LIVE = [
    "STRIPE_PRICE_FOUNDING_MONTHLY_LIVE",
    "STRIPE_PRICE_FOUNDING_ANNUAL_LIVE",
    "STRIPE_PRICE_REGULAR_MONTHLY_LIVE",
    "STRIPE_PRICE_REGULAR_ANNUAL_LIVE",
  ] as const;

  const PRICE_KEYS_TEST = [
    "STRIPE_PRICE_FOUNDING_MONTHLY_TEST",
    "STRIPE_PRICE_FOUNDING_ANNUAL_TEST",
    "STRIPE_PRICE_REGULAR_MONTHLY_TEST",
    "STRIPE_PRICE_REGULAR_ANNUAL_TEST",
  ] as const;

  const problems: string[] = [];

  // required vars
  if (!present(sk)) problems.push("Missing STRIPE_SECRET_KEY");

  if (isProd) {
    if (!present(whsecLive)) problems.push("PROD missing STRIPE_WEBHOOK_SECRET_LIVE");
    if (present(whsecTest)) problems.push("PROD must NOT set STRIPE_WEBHOOK_SECRET_TEST");
    for (const k of PRICE_KEYS_LIVE) {
      if (!present(process.env[k])) problems.push(`PROD missing ${k}`);
    }
    for (const k of PRICE_KEYS_TEST) {
      if (present(process.env[k])) problems.push(`PROD must NOT set ${k}`);
    }
  } else {
    if (!present(whsecTest)) problems.push("NON-PROD missing STRIPE_WEBHOOK_SECRET_TEST");
    if (present(whsecLive)) problems.push("NON-PROD must NOT set STRIPE_WEBHOOK_SECRET_LIVE");
    for (const k of PRICE_KEYS_TEST) {
      if (!present(process.env[k])) problems.push(`NON-PROD missing ${k}`);
    }
    for (const k of PRICE_KEYS_LIVE) {
      if (present(process.env[k])) problems.push(`NON-PROD must NOT set ${k}`);
    }
  }

  // hard isolation for secret key
  if (present(sk)) {
    if (isProd && sk.startsWith("sk_test_")) problems.push("PROD has sk_test_ STRIPE_SECRET_KEY");
    if (!isProd && sk.startsWith("sk_live_")) problems.push("NON-PROD has sk_live_ STRIPE_SECRET_KEY");
  }

  if (problems.length) {
    console.error("❌ Stripe env isolation check failed:");
    for (const p of problems) console.error(" - " + p);
    process.exit(1);
  }

  console.log(`✅ Stripe env isolation ok (NODE_ENV=${nodeEnv})`);
}
