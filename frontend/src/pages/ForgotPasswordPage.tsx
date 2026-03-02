import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import type { HttpError } from "../api/http";

export default function ForgotPasswordPage() {
  const [shopCode, setShopCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await forgotPassword({
        shopCode: shopCode.trim(),
        email: email.trim().toLowerCase(),
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error && "status" in err) {
        const httpError = err as HttpError;
        const data = httpError.data as { message?: string };
        setError(data?.message || httpError.message || "Request failed");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
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
          Forgot Password
        </h1>

        {success ? (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem",
              background: "#1e3a1e",
              border: "1px solid #22c55e",
              borderRadius: "0.375rem",
              color: "#86efac",
              fontSize: "0.9rem",
            }}
          >
            If that account exists, we emailed you a link.
          </div>
        ) : (
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
                htmlFor="shop-code"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "#e5e7eb",
                }}
              >
                Shop Code
              </label>
              <input
                id="shop-code"
                type="text"
                value={shopCode}
                onChange={(e) => setShopCode(e.target.value)}
                required
                disabled={loading}
                autoComplete="off"
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
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "#e5e7eb",
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
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
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <p
          style={{
            marginTop: "1rem",
            marginBottom: 0,
            fontSize: "0.875rem",
            color: "#9ca3af",
          }}
        >
          Managers and technicians cannot reset passwords by email. Please contact your shop owner for assistance.
        </p>

        <Link
          to="/login"
          style={{
            display: "block",
            marginTop: "1rem",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
