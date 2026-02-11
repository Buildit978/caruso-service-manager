import { useState, useEffect } from "react";
import { getBillingLockState, subscribe } from "../../state/billingLock";
import { useMe } from "../../auth/useMe";
import { createCheckoutSession, createPortalSession } from "../../api/billing";

function formatGraceEndsAt(graceEndsAt: string | null | undefined): string {
  if (!graceEndsAt) return "";
  try {
    const d = new Date(graceEndsAt);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "long" });
  } catch {
    return "";
  }
}

function isGraceInFuture(graceEndsAt: string | null | undefined): boolean {
  if (!graceEndsAt) return false;
  try {
    const d = new Date(graceEndsAt);
    return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
  } catch {
    return false;
  }
}

export default function BillingLockBanner() {
  const [state, setState] = useState(getBillingLockState);
  const { me } = useMe();

  useEffect(() => {
    return subscribe(setState);
  }, []);

  if (!state.billingLocked) return null;

  const isOwner = me?.role === "owner";
  const { details } = state;
  const graceEndsAt = details.graceEndsAt ?? undefined;
  const inGrace = isGraceInFuture(graceEndsAt);
  const formattedDate = formatGraceEndsAt(graceEndsAt);
  const trialEndsAtRaw = (details as any).trialEndsAt as string | null | undefined;
  let trialEnded = false;
  if (trialEndsAtRaw) {
    try {
      const d = new Date(trialEndsAtRaw);
      if (!Number.isNaN(d.getTime())) {
        const now = new Date();
        const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const utcEndDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        trialEnded = utcEndDay <= utcToday;
      }
    } catch {
      trialEnded = false;
    }
  }

  const message = isOwner
    ? trialEnded
      ? "Your trial has ended. Activate a plan to continue."
      : inGrace && formattedDate
        ? `Payment failed. You have until ${formattedDate} to update billing to avoid interruption.`
        : "Billing is inactive. Update billing to continue."
    : trialEnded
      ? "Trial has ended. Please contact the account owner to activate billing."
      : "Billing is inactive. Please contact the account owner.";

  async function handleBillingClick() {
    try {
      const { url } = await createPortalSession();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      if (err?.status === 400) {
        const { url } = await createCheckoutSession();
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      console.error("Billing action failed", err);
      alert("Could not open billing. Please try again.");
    }
  }

  return (
    <div
      className="billing-lock-banner"
      role="alert"
      style={{
        padding: "0.6rem 1rem",
        background: "#451a1a",
        color: "#fecaca",
        borderBottom: "1px solid #7f1d1d",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}
    >
      <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{message}</span>
      {isOwner && (
        <button
          type="button"
          onClick={() => {
            void handleBillingClick();
          }}
          style={{
            padding: "0.35rem 0.75rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#fff",
            background: "#b91c1c",
            border: "none",
            borderRadius: "0.375rem",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Update billing
        </button>
      )}
    </div>
  );
}
