import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  getPartnerToken,
  partnerApiErrorMessage,
  partnerLogin,
  setPartnerPasswordSetupToken,
  setPartnerPasswordSetupEmail,
  setPartnerToken,
  type HttpError,
} from "../../api/partner";
import "./partnerPortal.css";

function normalizeEmail(value: string): string {
  return value.replace(/\u00A0/g, " ").trim().toLowerCase();
}

export default function PartnerLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (getPartnerToken()) {
    return <Navigate to="/partner" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await partnerLogin({
        email: normalizeEmail(email),
        password,
      });
      if (res.mustChangePassword === true && res.passwordSetupToken) {
        setPartnerPasswordSetupToken(res.passwordSetupToken);
        setPartnerPasswordSetupEmail(res.partner.email);
        navigate("/partner/set-password", { replace: true });
        return;
      }
      if (!res.token) {
        setError("Sign in failed");
        return;
      }
      setPartnerToken(res.token);
      navigate("/partner", { replace: true });
    } catch (err) {
      if (err && typeof err === "object" && "status" in err) {
        const he = err as HttpError;
        if (he.status === 401) {
          setError("Invalid email or password");
        } else if (he.status === 403) {
          setError("Partner access unavailable");
        } else {
          setError(partnerApiErrorMessage(err, "Sign in failed"));
        }
      } else {
        setError("Sign in failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="partner-portal-login-page">
      <div className="partner-portal-login-card">
        <h1 className="partner-portal-login-title">Shop Service Manager</h1>
        <p className="partner-portal-login-kicker">Partner Portal</p>
        <p className="partner-portal-login-subtitle label-muted-readable">Access is by invitation only. Sign in with your invite credentials.</p>

        {error && <p className="partner-portal-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label className="partner-portal-form-label">
            Email
            <input
              type="email"
              className="partner-portal-form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="partner-portal-form-label">
            Password
            <input
              type="password"
              className="partner-portal-form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="partner-portal-btn partner-portal-btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
