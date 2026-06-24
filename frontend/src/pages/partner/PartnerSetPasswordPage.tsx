import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  clearPartnerPasswordSetupToken,
  getPartnerPasswordSetupToken,
  getPartnerPasswordSetupEmail,
  getPartnerToken,
  partnerApiErrorMessage,
  partnerSetPassword,
  setPartnerToken,
  type HttpError,
} from "../../api/partner";
import {
  PARTNER_PASSWORD_RULES,
  validatePartnerPortalPassword,
} from "../../utils/partnerPasswordValidation";
import "./partnerPortal.css";

export default function PartnerSetPasswordPage() {
  const navigate = useNavigate();
  const setupToken = getPartnerPasswordSetupToken();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (getPartnerToken()) {
    return <Navigate to="/partner" replace />;
  }

  if (!setupToken) {
    return <Navigate to="/partner/login" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const validationErrors = validatePartnerPortalPassword(
      newPassword,
      getPartnerPasswordSetupEmail() ?? ""
    );
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    setLoading(true);
    try {
      const res = await partnerSetPassword({ newPassword });
      clearPartnerPasswordSetupToken();
      setPartnerToken(res.token);
      navigate("/partner", { replace: true });
    } catch (err) {
      if (err && typeof err === "object" && "status" in err) {
        const he = err as HttpError;
        if (he.status === 401) {
          clearPartnerPasswordSetupToken();
          navigate("/partner/login", { replace: true });
          return;
        }
        setError(partnerApiErrorMessage(err, "Failed to set password"));
      } else {
        setError("Failed to set password");
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
        <p className="partner-portal-login-subtitle">Access is by invitation only.</p>
        <p className="partner-portal-login-subtitle partner-portal-login-subtitle-tight">
          Create a secure password to activate your partner portal access.
        </p>

        <ul className="partner-portal-password-rules" aria-label="Password requirements">
          {PARTNER_PASSWORD_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        {error && <p className="partner-portal-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label className="partner-portal-form-label">
            New password
            <input
              type="password"
              className="partner-portal-form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="partner-portal-form-label">
            Confirm password
            <input
              type="password"
              className="partner-portal-form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className="partner-portal-btn partner-portal-btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Activate access"}
          </button>
        </form>
      </div>
    </div>
  );
}
