// frontend/src/pages/LoginPage.tsx
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, reactivate } from "../api/auth";
import { setToken } from "../api/http";
import type { HttpError } from "../api/http";
import "./LoginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopCode, setShopCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReactivate, setShowReactivate] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [showReactivatePassword, setShowReactivatePassword] = useState(false);
  const shopCodeInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login({
        email,
        password,
        shopCode: shopCode.trim() || undefined,
      });
      
      // Store token in localStorage (same key as TokenPanel uses)
      setToken(response.token);
      
      // Redirect to dashboardƒ
      navigate("/", { replace: true });
    } catch (err) {
      setLoading(false);
      if (err instanceof Error && "status" in err) {
        const httpError = err as HttpError;
        const data = httpError.data as any;
        if (httpError.status === 401) {
          setError("Invalid email or password");
        } else if (
          httpError.status === 403 &&
          (data as any)?.message === "Account inactive"
        ) {
          setError(null);
          setShowReactivate(true);
        } else if (
          httpError.status === 409 &&
          data &&
          (data as any).code === "SHOP_CODE_REQUIRED"
        ) {
          setError("This email is used in multiple shops. Enter your Shop Code.");
          // Gently guide the user to the Shop Code field
          if (shopCodeInputRef.current) {
            shopCodeInputRef.current.focus();
          }
        } else {
          setError((data as any)?.message || httpError.message || "Login failed");
        }
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  async function handleReactivate(e: FormEvent) {
    e.preventDefault();
    setReactivating(true);
    setError(null);

    try {
      const response = await reactivate({ email, password });
      
      // Store token in localStorage
      setToken(response.token);
      
      // Redirect to dashboard
      navigate("/", { replace: true });
    } catch (err) {
      setReactivating(false);
      if (err instanceof Error && "status" in err) {
        const httpError = err as HttpError;
        if (httpError.status === 401) {
          setError("Invalid email or password");
        } else {
          setError(httpError.message || "Reactivation failed");
        }
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
          Shop Service Manager
        </h1>

        {showReactivate ? (
          <div>
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
              Your account has been deactivated. Please reactivate it to continue.
            </div>

            <form onSubmit={handleReactivate}>
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
                  htmlFor="reactivate-email"
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
                  id="reactivate-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={reactivating}
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
                  htmlFor="reactivate-password"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color: "#e5e7eb",
                  }}
                >
                  Password
                </label>
                <div className="password-field">
                  <input
                    id="reactivate-password"
                    type={showReactivatePassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={reactivating}
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
                    onClick={() => setShowReactivatePassword((s) => !s)}
                    aria-label={showReactivatePassword ? "Hide password" : "Show password"}
                    disabled={reactivating}
                    className="password-toggle"
                  >
                    {showReactivatePassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={reactivating}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  background: reactivating ? "#4b5563" : "#22c55e",
                  color: "#ffffff",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: reactivating ? "not-allowed" : "pointer",
                  opacity: reactivating ? 0.6 : 1,
                }}
              >
                {reactivating ? "Reactivating..." : "Reactivate Account"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setShowReactivate(false);
                setError(null);
                setEmail("");
                setPassword("");
              }}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid #4b5563",
                background: "transparent",
                color: "#9ca3af",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Back to Login
            </button>
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
              disabled={loading}
              autoComplete="off"
              ref={shopCodeInputRef}
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
            <p
              style={{
                marginTop: "0.25rem",
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              Ask your shop owner for this code.
            </p>
          </div>

          <div style={{ marginBottom: "1rem" }}>
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
              autoComplete="email"
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
          </div>

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
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Password
            </label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
