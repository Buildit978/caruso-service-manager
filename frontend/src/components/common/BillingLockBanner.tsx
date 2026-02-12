import { useState, useEffect } from "react";
import { useMe } from "../../auth/useMe";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  type BillingStatusResponse,
} from "../../api/billing";

function formatGraceEndsAt(graceEndsAt: string | null | undefined): string {
  if (!graceEndsAt) return "";
  try {
    const d = new Date(graceEndsAt);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "long" });
  } catch {
    return "";
  }
}

export default function BillingLockBanner() {
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const { me } = useMe();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await getBillingStatus();
        if (!cancelled) {
          setStatus(s);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  if (!status.locked && !status.warning) return null;

  const isOwner = me?.role === "owner";
  const formattedLockDate = formatGraceEndsAt(status.lockDate);

  let message: string;
  if (status.locked) {
    if (isOwner) {
      message =
        status.reason === "trial"
          ? "Your trial has ended. Activate a plan to continue."
          : "Billing is inactive. Update billing to continue.";
    } else {
      message =
        status.reason === "trial"
          ? "Trial has ended. Please contact the account owner to activate billing."
          : "Billing is inactive. Please contact the account owner.";
    }
  } else if (status.warning) {
    const base =
      status.warning === "3_day"
        ? "Your billing will lock soon."
        : "Your billing will lock in the coming days.";
    if (isOwner) {
      message =
        formattedLockDate && status.daysUntilLock != null
          ? `${base} You have until ${formattedLockDate} (${status.daysUntilLock} days) to update billing to avoid interruption.`
          : `${base} Update billing to avoid interruption.`;
    } else {
      message =
        base +
        " Please contact the account owner to ensure billing is updated to avoid interruption.";
    }
  } else {
    return null;
  }

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
      {isOwner && status.showBillingCta && (
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
