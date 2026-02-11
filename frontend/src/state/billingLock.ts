/**
 * Global billing lock state (no external store lib).
 * Set when API returns 402 with code "BILLING_LOCKED"; cleared only explicitly or on refresh.
 */

export type BillingLockDetails = {
  billingStatus?: string;
  graceEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  message?: string;
};

export type BillingLockState = {
  billingLocked: boolean;
  details: BillingLockDetails;
};

let state: BillingLockState = {
  billingLocked: false,
  details: {},
};

type Listener = (s: BillingLockState) => void;
const listeners: Listener[] = [];

function notify(): void {
  const snapshot = { ...state, details: { ...state.details } };
  listeners.forEach((fn) => fn(snapshot));
}

export function setBillingLocked(details: BillingLockDetails): void {
  state = {
    billingLocked: true,
    details: {
      billingStatus: details.billingStatus,
      graceEndsAt: details.graceEndsAt ?? null,
      currentPeriodEnd: details.currentPeriodEnd ?? null,
      message: details.message,
    },
  };
  notify();
}

export function clearBillingLocked(): void {
  state = { billingLocked: false, details: {} };
  notify();
}

export function getBillingLockState(): BillingLockState {
  return { ...state, details: { ...state.details } };
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i !== -1) listeners.splice(i, 1);
  };
}

// --- Helpers for 402 BILLING_LOCKED detection ---

export function isBillingLockedResponse(status: number, data: unknown): boolean {
  return status === 402 && (data as { code?: string } | null)?.code === "BILLING_LOCKED";
}

export function isBillingLockedError(err: unknown): boolean {
  const e = err as { status?: number; data?: unknown };
  return e?.status === 402 && (e.data as { code?: string } | null)?.code === "BILLING_LOCKED";
}
