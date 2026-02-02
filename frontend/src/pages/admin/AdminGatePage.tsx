import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  setAdminToken,
  setAdminRole,
  clearAdminToken,
  adminLogin,
  fetchAdminOverview,
  type AdminRole,
  type HttpError,
} from "../../api/admin";
import "./Admin.css";

const ALLOWED_ADMIN_ROLES: AdminRole[] = ["admin", "superadmin"];

function isAllowedRole(role: string): role is AdminRole {
  return ALLOWED_ADMIN_ROLES.includes(role as AdminRole);
}

export default function AdminGatePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const res = await adminLogin({ email: email.trim(), password });
      const role = res.adminUser?.role;
      if (!role || !isAllowedRole(role)) {
        setError("Access denied. Admin or Superadmin role required.");
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
        if (he.status === 401) setError("Invalid email or password.");
        else setError(he.message || "Login failed.");
      } else {
        setError("Login failed.");
      }
    }
  }

  async function handleTokenSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const t = token.trim();
    if (!t) {
      setError("Enter a token");
      return;
    }
    setLoading(true);
    setAdminToken(t);
    try {
      await fetchAdminOverview({ days: 7 });
      setAdminRole("admin");
      navigate("/admin/accounts", { replace: true });
    } catch (err) {
      clearAdminToken();
      setLoading(false);
      if (err && typeof err === "object" && "status" in err) {
        const he = err as HttpError;
        setError(he.status === 401 ? "Invalid or expired token." : "Token not authorized.");
      } else {
        setError("Token validation failed.");
      }
    }
  }

  return (
    <div className="admin-root">
      <header className="admin-topbar">
        <h1 className="admin-topbar-title">Admin</h1>
      </header>
      <main className="admin-main">
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
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
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
            {tokenSectionOpen ? "▼" : "▶"} Use token instead
          </button>
          {tokenSectionOpen && (
            <form className="admin-gate-form admin-gate-token-form" onSubmit={handleTokenSubmit}>
              <div className="admin-form-group">
                <label htmlFor="admin-token">Admin token (emergency)</label>
                <input
                  id="admin-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste JWT token"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="admin-btn admin-btn-secondary" style={{ width: "100%" }} disabled={loading}>
                Validate token & continue
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
