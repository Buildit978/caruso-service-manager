// frontend/src/components/auth/TokenPanel.tsx
// Dev-only token panel for manual JWT entry (v1)

import { useState, useEffect } from "react";
import { setToken, getToken, clearToken } from "../../api/http";

export default function TokenPanel() {
  const [token, setTokenValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getToken();
    if (stored) {
      setTokenValue(stored);
    }
  }, []);

  function handleSave() {
    if (!token.trim()) {
      alert("Token cannot be empty");
      return;
    }
    setToken(token.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    clearToken();
    setTokenValue("");
    setSaved(false);
  }

  return (
    <div
      style={{
        border: "1px solid #4b5563",
        borderRadius: "0.5rem",
        padding: "1rem",
        marginTop: "1.5rem",
        background: "rgba(17, 24, 39, 0.6)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 600 }}>
        🔐 Auth Token (Dev Only)
      </h3>
      <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "0.75rem" }}>
        Paste your JWT token here for development. This is temporary and will be replaced with
        proper login in a future version.
      </p>

      <textarea
        value={token}
        onChange={(e) => setTokenValue(e.target.value)}
        placeholder="Paste JWT token here..."
        style={{
          width: "100%",
          minHeight: "80px",
          padding: "0.5rem 0.6rem",
          borderRadius: "0.375rem",
          border: "1px solid #4b5563",
          background: "#020617",
          color: "#e5e7eb",
          fontFamily: "monospace",
          fontSize: "0.8rem",
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: "0.375rem",
            border: "1px solid #1d4ed8",
            background: "#1d4ed8",
            color: "#e5e7eb",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save Token
        </button>

        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: "0.375rem",
            border: "1px solid #4b5563",
            background: "transparent",
            color: "#e5e7eb",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Clear
        </button>

        {saved && (
          <span style={{ color: "#22c55e", fontSize: "0.85rem", alignSelf: "center" }}>
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  );
}
