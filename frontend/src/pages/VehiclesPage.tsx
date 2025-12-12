// frontend/src/pages/VehiclesPage.tsx
import { Link } from "react-router-dom";

export default function VehiclesPage() {
  return (
    <div style={{ padding: "1rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Vehicles</h1>

      <p style={{ marginBottom: "1rem", opacity: 0.85 }}>
        Vehicle management hub. Search and filters coming next.
      </p>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Link
          to="/customers"
          style={{
            padding: "0.6rem 0.9rem",
            borderRadius: "10px",
            border: "1px solid #374151",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          View Customers
        </Link>

        {/* Later:
        <Link to="/vehicles/new">Add Vehicle</Link>
        */}
      </div>
    </div>
  );
}
