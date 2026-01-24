// frontend/src/pages/StartPage.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";
import { setToken } from "../api/http";
import type { HttpError } from "../api/http";

export default function StartPage() {
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await register({ shopName, ownerName, email, password });
      
      // Store token in localStorage
      setToken(response.token);
      
      // Redirect to dashboard
      navigate("/", { replace: true });
    } catch (err) {
      setLoading(false);
      if (err instanceof Error && "status" in err) {
        const httpError = err as HttpError;
        if (httpError.status === 409) {
          setError("Email already registered. Please sign in instead.");
        } else if (httpError.status === 400) {
          setError((httpError.data as any)?.message || httpError.message || "Invalid input");
        } else {
          setError(httpError.message || "Registration failed");
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
          Create Your Shop
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
              htmlFor="shopName"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Shop Name
            </label>
            <input
              id="shopName"
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
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
              htmlFor="ownerName"
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Your Name
            </label>
            <input
              id="ownerName"
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
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
            <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#9ca3af" }}>
              Minimum 8 characters
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
              marginBottom: "1rem",
            }}
          >
            {loading ? "Creating..." : "Create Shop"}
          </button>

          <div style={{ textAlign: "center", fontSize: "0.9rem", color: "#9ca3af" }}>
            Already have an account?{" "}
            <Link
              to="/login"
              style={{
                color: "#3b82f6",
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
