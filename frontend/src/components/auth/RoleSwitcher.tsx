// frontend/src/components/auth/RoleSwitcher.tsx
// Dev-only component for switching between owner/manager/technician tokens

import { useState, useEffect } from "react";
import { setToken, getToken } from "../../api/http";

const TOKEN_KEYS = {
  owner: "csm_token_owner",
  manager: "csm_token_manager",
  technician: "csm_token_technician",
} as const;

type Role = keyof typeof TOKEN_KEYS;

export default function RoleSwitcher() {
  const [ownerToken, setOwnerToken] = useState("");
  const [managerToken, setManagerToken] = useState("");
  const [technicianToken, setTechnicianToken] = useState("");
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  useEffect(() => {
    // Load stored tokens from localStorage
    const owner = localStorage.getItem(TOKEN_KEYS.owner) || "";
    const manager = localStorage.getItem(TOKEN_KEYS.manager) || "";
    const technician = localStorage.getItem(TOKEN_KEYS.technician) || "";

    setOwnerToken(owner);
    setManagerToken(manager);
    setTechnicianToken(technician);

    // Detect current active role by comparing current token with stored tokens
    const currentToken = getToken();
    if (currentToken === owner && owner) {
      setCurrentRole("owner");
    } else if (currentToken === manager && manager) {
      setCurrentRole("manager");
    } else if (currentToken === technician && technician) {
      setCurrentRole("technician");
    } else {
      setCurrentRole(null);
    }
  }, []);

  function handleSave(role: Role, token: string) {
    if (!token.trim()) {
      alert("Token cannot be empty");
      return;
    }
    localStorage.setItem(TOKEN_KEYS[role], token.trim());
    if (role === "owner") {
      setOwnerToken(token.trim());
    } else if (role === "manager") {
      setManagerToken(token.trim());
    } else {
      setTechnicianToken(token.trim());
    }
  }

  function handleActivate(role: Role) {
    const token = localStorage.getItem(TOKEN_KEYS[role]);
    if (!token) {
      alert(`No ${role} token stored. Please save a token first.`);
      return;
    }

    setToken(token);
    // Reload page to refresh auth state
    window.location.reload();
  }

  function handleClear(role: Role) {
    localStorage.removeItem(TOKEN_KEYS[role]);
    if (role === "owner") {
      setOwnerToken("");
    } else if (role === "manager") {
      setManagerToken("");
    } else {
      setTechnicianToken("");
    }
  }

  // Only render in dev mode
  if (!import.meta.env.DEV) {
    return null;
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
        🔄 Role Switcher (Dev Only)
      </h3>
      <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1rem" }}>
        Store tokens for different roles and quickly switch between them. This helps test
        role-based permissions without manually pasting tokens.
      </p>

      {(["owner", "manager", "technician"] as Role[]).map((role) => {
        const token =
          role === "owner" ? ownerToken : role === "manager" ? managerToken : technicianToken;
        const isActive = currentRole === role;

        return (
          <div
            key={role}
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid #4b5563",
              background: isActive ? "rgba(29, 78, 216, 0.2)" : "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  color: "#e5e7eb",
                }}
              >
                {role}
              </span>
              {isActive && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "4px",
                    background: "#1d4ed8",
                    color: "#ffffff",
                    fontWeight: 600,
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>

            <textarea
              value={token}
              onChange={(e) => {
                if (role === "owner") {
                  setOwnerToken(e.target.value);
                } else if (role === "manager") {
                  setManagerToken(e.target.value);
                } else {
                  setTechnicianToken(e.target.value);
                }
              }}
              placeholder={`Paste ${role} token here...`}
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "0.5rem 0.6rem",
                borderRadius: "0.375rem",
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                resize: "vertical",
                marginBottom: "0.5rem",
              }}
            />

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleSave(role, token)}
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
                Save
              </button>

              <button
                type="button"
                onClick={() => handleActivate(role)}
                disabled={!token.trim() || isActive}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #16a34a",
                  background: !token.trim() || isActive ? "#4b5563" : "#16a34a",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: !token.trim() || isActive ? "default" : "pointer",
                  opacity: !token.trim() || isActive ? 0.6 : 1,
                }}
              >
                {isActive ? "Active" : "Activate"}
              </button>

              <button
                type="button"
                onClick={() => handleClear(role)}
                disabled={!token.trim()}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #4b5563",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: !token.trim() ? "default" : "pointer",
                  opacity: !token.trim() ? 0.5 : 1,
                }}
              >
                Clear
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
