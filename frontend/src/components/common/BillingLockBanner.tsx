import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getBillingLockState, subscribe } from "../../state/billingLock";
import { useMe } from "../../auth/useMe";

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

  const message = isOwner
    ? inGrace && formattedDate
      ? `Payment failed. You have until ${formattedDate} to update billing to avoid interruption.`
      : "Billing is inactive. Update billing to continue."
    : "Billing is inactive. Please contact the account owner.";

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
        <Link
          to="/settings"
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
        </Link>
      )}
    </div>
  );
}
