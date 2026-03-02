import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { setToken, setMustChangePassword } from "../api/http";
import type { HttpError } from "../api/http";
import { validateNewPassword } from "../utils/passwordValidation";
import "./LoginPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const shopCode = searchParams.get("shopCode") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token || !shopCode) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token, shopCode]);

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
      const response = await resetPassword({
        token,
        shopCode,
        newPassword,
      });

      setToken(response.token);
      setMustChangePassword(false);
      navigate("/", { replace: true });
    } catch (err) {
      setLoading(false);
      if (err instanceof Error && "status" in err) {
        const httpError = err as HttpError;
        const data = httpError.data as { message?: string };
        setError(data?.message || httpError.message || "Failed to reset password");
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  if (!token || !shopCode) {
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
              marginBottom: "1rem",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#e5e7eb",
              textAlign: "center",
            }}
          >
            Reset Password
          </h1>
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
          <Link
            to="/forgot-password"
            style={{
              display: "block",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
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
          Reset Password
        </h1>

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
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
