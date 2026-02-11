import { http } from "./http";

export async function createCheckoutSession(): Promise<{ url: string }> {
  return http<{ url: string }>("/billing/checkout-session", { method: "POST" });
}

export async function createPortalSession(): Promise<{ url: string }> {
  return http<{ url: string }>("/billing/portal-session", { method: "POST" });
}


