import { useState } from "react";

type Props = {
  open: boolean;
  tempPassword: string | null;
  onClose: () => void;
};

export default function TempPasswordModal({ open, tempPassword, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open || !tempPassword) return null;

  const pw = tempPassword ?? "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        // Silent fail
      }
      document.body.removeChild(textarea);
    }
  }

  function handleClose() {
    setCopied(false);
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
          Temporary Password Generated
        </div>
        <div style={{ marginBottom: "1rem", color: "#9ca3af", lineHeight: 1.5, fontSize: "0.9rem" }}>
          Temporary password generated. Copy now — it won't be shown again.
        </div>

        <div
          style={{
            padding: "1rem",
            borderRadius: "0.5rem",
            background: "#111827",
            border: "1px solid #1f2937",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#e5e7eb",
              textAlign: "center",
              letterSpacing: "0.05em",
              wordBreak: "break-all",
            }}
          >
            {pw}
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

          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: "0.5rem",
              border: "1px solid #3b82f6",
              background: copied ? "#10b981" : "#3b82f6",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
