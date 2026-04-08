import { Link } from "react-router-dom";

export default function WelcomePage() {
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
          maxWidth: "640px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.75rem",
          padding: "2rem",
          color: "#e5e7eb",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: "0.75rem",
            fontSize: "1.8rem",
            fontWeight: 700,
          }}
        >
          Welcome to Shop Service Manager 👋
        </h1>

        <p
          style={{
            margin: "0 auto 1.5rem",
            maxWidth: "520px",
            lineHeight: 1.6,
            color: "#cbd5e1",
          }}
        >
          Your free trial is active. Let’s get your first work order into the
          system.
        </p>

        <p
          style={{
            margin: "0 auto 1.25rem",
            maxWidth: "520px",
            lineHeight: 1.5,
            color: "#94a3b8",
            fontSize: "0.95rem",
          }}
        >
          It only takes a minute, and you can update everything later.
        </p>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/work-orders/new"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontWeight: 600,
              background: "#2563eb",
              color: "#fff",
            }}
          >
            Create Your First Work Order
          </Link>

          <Link
            to="/"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.5rem",
              textDecoration: "none",
              border: "1px solid #475569",
              color: "#e5e7eb",
              background: "transparent",
            }}
          >
            Skip for now → Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
