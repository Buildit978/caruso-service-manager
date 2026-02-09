import { useState } from "react";

type Props = {
  open: boolean;
  tempPassword: string | null;
  shopCode: string | null;
  emailSent?: boolean;
  emailError?: string;
  expiresAt?: string | null;
  onClose: () => void;
};

export default function TempPasswordModal({ open, tempPassword, shopCode, emailSent = true, emailError, expiresAt, onClose }: Props) {
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedShopCode, setCopiedShopCode] = useState(false);

  if (!open || !tempPassword) return null;

  const pw = tempPassword ?? "";
  const code = shopCode ?? null;

  async function handleCopyPassword() {
    try {
      await navigator.clipboard.writeText(pw);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = pw;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      } catch (fallbackErr) {
        // Silent fail
      }
      document.body.removeChild(textarea);
    }
  }

  async function handleCopyShopCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedShopCode(true);
      setTimeout(() => setCopiedShopCode(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopiedShopCode(true);
        setTimeout(() => setCopiedShopCode(false), 2000);
      } catch (fallbackErr) {
        // Silent fail
      }
      document.body.removeChild(textarea);
    }
  }

  function handleClose() {
    setCopiedPassword(false);
    setCopiedShopCode(false);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          borderRadius: "0.75rem",
          background: "#0b1220",
          border: "1px solid #1f2937",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
          padding: "1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>
          Team Member Credentials
        </div>
        <div style={{ marginBottom: "1rem", color: "#9ca3af", lineHeight: 1.5, fontSize: "0.9rem" }}>
          Tech will need Shop Code + email + temporary password to log in. Copy these now — they won't be shown again.
        </div>

        {emailSent === true && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid #22c55e",
              borderRadius: "0.375rem",
              color: "#86efac",
              fontSize: "0.9rem",
            }}
          >
            Email sent ✅
          </div>
        )}

        {emailSent === false && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "rgba(234, 179, 8, 0.15)",
              border: "1px solid #eab308",
              borderRadius: "0.375rem",
              color: "#fde047",
              fontSize: "0.9rem",
            }}
          >
            Email failed ⚠️ {emailError || "Email could not be sent. Please share these credentials with the team member manually."}
          </div>
        )}

        {expiresAt && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              background: "#1e3a5f",
              border: "1px solid #3b82f6",
              borderRadius: "0.375rem",
              color: "#93c5fd",
              fontSize: "0.85rem",
            }}
          >
            Time sensitive — use this password soon.
          </div>
        )}

        {code && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "0.5rem" }}>
              Shop Code
            </div>
            <div
              style={{
                padding: "1rem",
                borderRadius: "0.5rem",
                background: "#111827",
                border: "1px solid #1f2937",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#e5e7eb",
                  letterSpacing: "0.05em",
                  flex: 1,
                }}
              >
                {code}
              </div>
              <button
                type="button"
                onClick={handleCopyShopCode}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #3b82f6",
                  background: copiedShopCode ? "#10b981" : "#3b82f6",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {copiedShopCode ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "0.5rem" }}>
            Temporary Password
          </div>
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "#111827",
              border: "1px solid #1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#e5e7eb",
                textAlign: "left",
                letterSpacing: "0.05em",
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              {pw}
            </div>
            <button
              type="button"
              onClick={handleCopyPassword}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #3b82f6",
                background: copiedPassword ? "#10b981" : "#3b82f6",
                color: "#fff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {copiedPassword ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: "0.5rem",
              border: "1px solid #475569",
              background: "transparent",
              color: "#e5e7eb",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Close
          </button>

        </div>
      </div>
    </div>
  );
}
