import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../api/auth";
import { setMustChangePassword } from "../api/http";
import type { HttpError } from "../api/http";
import { validateNewPassword } from "../utils/passwordValidation";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const validationErrors = validateNewPassword(newPassword);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    setLoading(true);

    try {
      await changePassword({ newPassword });
      
      // Clear mustChangePassword flag
      setMustChangePassword(false);
      
      // Redirect to dashboard
      navigate("/", { replace: true });
    } catch (err) {
      setLoading(false);
      if (err instanceof Error && "status" in err) {
        const httpError = err as HttpError;
        const data = httpError.data as any;
        setError((data as any)?.message || httpError.message || "Failed to change password");
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.5rem",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "#e5e7eb",
            textAlign: "center",
          }}
        >
          Change Password
        </h1>

        <div
          style={{
            marginBottom: "1.5rem",
            padding: "0.75rem",
            background: "#1e3a5f",
            border: "1px solid #3b82f6",
            borderRadius: "0.375rem",
            color: "#93c5fd",
            fontSize: "0.9rem",
          }}
        >
          Your temporary password has expired or requires a change. Please set a new password to continue.
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                background: "#7f1d1d",
                border: "1px solid #991b1b",
                borderRadius: "0.375rem",
                color: "#fca5a5",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="new-password"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              New Password
            </label>
            <div className="password-field">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #4b5563",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
                className="password-toggle"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p
              style={{
                marginTop: "0.25rem",
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              Use 12+ characters. A passphrase like &quot;BlueTruck!Wrench2026&quot; works great.
            </p>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="confirm-password"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Confirm Password
            </label>
            <div className="password-field">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #4b5563",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                disabled={loading}
                className="password-toggle"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              border: "none",
              background: loading ? "#4b5563" : "#2563eb",
              color: "#ffffff",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Changing Password..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
