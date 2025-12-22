import React from "react";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmLeaveModal({
  open,
  title = "Unsaved changes",
  message = "You have unsaved changes. If you leave now, your work will be lost.",
  confirmText = "Leave without saving",
  cancelText = "Stay",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

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
      onClick={onCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          borderRadius: "0.75rem",
          background: "#0b1220",
          border: "1px solid #1f2937",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
          padding: "1rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
          {title}
        </div>
        <div style={{ marginTop: "0.5rem", color: "#cbd5e1", lineHeight: 1.4 }}>
          {message}
        </div>

        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
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
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: "0.5rem",
              border: "1px solid #ef4444",
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
