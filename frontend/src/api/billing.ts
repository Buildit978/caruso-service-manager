import { http } from "./http";

export type CheckoutTier = "founding" | "regular";
export type CheckoutInterval = "monthly" | "annual";

export interface CreateCheckoutSessionBody {
  interval: CheckoutInterval;
  tier: CheckoutTier;
}

/**
 * Checkout args for nav / lock-banner flows that have no plan picker.
 * Call sites pass this explicitly (server does not default tier or interval).
 */
export const CHECKOUT_SELECTION_QUICK_CTA: CreateCheckoutSessionBody = {
  tier: "regular",
  interval: "monthly",
};

export async function createCheckoutSession(
  body: CreateCheckoutSessionBody
): Promise<{ url: string }> {
  return http<{ url: string }>("/billing/checkout-session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createPortalSession(): Promise<{ url: string }> {
  return http<{ url: string }>("/billing/portal-session", { method: "POST" });
}

export type BillingStatusWarning = "grace" | "urgent" | "warning" | null;

export type BillingLockedContext = "trial_ended" | "payment_required" | "past_due_ended";

export interface BillingStatusResponse {
  locked: boolean;
  reason: "active" | "trial" | "grace" | "locked";
  lockDate: string | null;
  daysUntilLock: number | null;
  daysRemaining: number | null;
  warning: BillingStatusWarning;
  showBillingCta: boolean;
  lockedContext: BillingLockedContext | null;
  billingStatus: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export async function getBillingStatus(): Promise<BillingStatusResponse> {
  return http<BillingStatusResponse>("/billing/status", { method: "GET" });
}
