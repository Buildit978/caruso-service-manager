import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  setAdminToken,
  setAdminRole,
  clearAdminToken,
  adminLogin,
  fetchAdminMe,
  type AdminRole,
  type HttpError,
} from "../../api/admin";
import "./Admin.css";

const ALLOWED_ADMIN_ROLES: AdminRole[] = ["admin", "superadmin"];

function isAllowedRole(role: string): role is AdminRole {
  return ALLOWED_ADMIN_ROLES.includes(role as AdminRole);
}

function normalizeEmail(value: string): string {
  return value.replace(/\u00A0/g, " ").trim().toLowerCase();
}

export default function AdminGatePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenSectionOpen, setTokenSectionOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await adminLogin({ email: normalizeEmail(email), password });
      const role = res.adminUser?.role;
      if (!role || !isAllowedRole(role)) {
        setError("Access restricted.");
        setLoading(false);
        return;
      }
      setAdminToken(res.token);
      setAdminRole(role);
      navigate("/admin/accounts", { replace: true });
    } catch (err) {
      setLoading(false);
      if (err && typeof err === "object" && "status" in err) {
        const he = err as HttpError;
        if (he.status === 401) setError("Access restricted.");
        else setError(he.message || "Access restricted.");
      } else {
        setError("Access restricted.");
      }
    }
  }

  async function handleTokenSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const t = token.trim();
    if (!t) {
      setError("Access restricted.");
      return;
    }
    setLoading(true);
    setAdminToken(t);
    try {
      const me = await fetchAdminMe();
      const role = me?.role;
      if (!role || !isAllowedRole(role)) {
        clearAdminToken();
        setLoading(false);
        setError("Access restricted.");
        return;
      }
      setAdminRole(role);
      navigate("/admin/accounts", { replace: true });
    } catch (err) {
      clearAdminToken();
      setLoading(false);
      if (err && typeof err === "object" && "status" in err) {
        setError("Access restricted.");
      } else {
        setError("Access restricted.");
      }
    }
  }

  return (
    <div className="admin-root">
      <header className="admin-topbar">
        <h1 className="admin-topbar-title">Admin Access</h1>
      </header>
      <main className="admin-main">
        <p className="admin-gate-message" style={{ color: "var(--admin-muted, #94a3b8)", marginBottom: "1rem", fontSize: "0.95rem" }}>
          Sign in to continue.
        </p>
        <form className="admin-gate-form" onSubmit={handleLoginSubmit}>
          <div className="admin-form-group">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="admin-password">Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  color: "var(--admin-muted, #94a3b8)",
                  fontSize: "0.875rem",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {error && <p className="admin-gate-error">{error}</p>}
          <button type="submit" className="admin-btn admin-btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="admin-gate-token-section">
          <button
            type="button"
            className="admin-gate-token-toggle"
            onClick={() => setTokenSectionOpen((o) => !o)}
            aria-expanded={tokenSectionOpen}
          >
            {tokenSectionOpen ? "▼" : "▶"} Alternate sign-in
          </button>
          {tokenSectionOpen && (
            <form className="admin-gate-form admin-gate-token-form" onSubmit={handleTokenSubmit}>
              <div className="admin-form-group">
                <label htmlFor="admin-token">Access credentials</label>
                <input
                  id="admin-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter credentials"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="admin-btn admin-btn-secondary" style={{ width: "100%" }} disabled={loading}>
                Continue
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
