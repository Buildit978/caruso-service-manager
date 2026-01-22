// frontend/src/pages/VehiclesPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccess } from "../contexts/AccessContext";
import type { HttpError } from "../api/http";
import { http } from "../api/http";

export default function VehiclesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setVehiclesAccess, vehiclesAccess } = useAccess();

  useEffect(() => {
    // Try to load vehicles to detect access
    // GET /api/vehicles requires customerId query param, but endpoint access check happens first
    // Will get 403 if technician, 400 if owner/manager (missing customerId is expected)
    const checkAccess = async () => {
      try {
        setLoading(true);
        setError(null);
        // Try fetching without customerId - will fail with 400 for owners/managers
        // or 403 for technicians (requireRole middleware runs first)
        await http("/vehicles");
        // If we get here, access is granted (unlikely without customerId, but handle it)
        setVehiclesAccess(true);
        setError(null);
      } catch (err: any) {
        const httpError = err as HttpError;
        
        // Server denied access (403 Forbidden)
        if (httpError?.status === 403) {
          setVehiclesAccess(false);
          setError(null); // Don't show generic error, we'll show Access Restricted card
        } else if (httpError?.status === 400) {
          // 400 means endpoint exists but we need a valid customerId (access granted)
          setVehiclesAccess(true);
          setError(null);
        } else {
          setError("Could not load vehicles.");
        }
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "1rem" }}>
        <p>Loading vehicles…</p>
      </div>
    );
  }

  // Server confirmed access denied (403)
  if (vehiclesAccess === false) {
    return (
      <div style={{ padding: "1rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Vehicles</h1>
        <div
          style={{
            maxWidth: "500px",
            margin: "2rem auto",
            padding: "1.5rem",
            border: "1px solid #fbbf24",
            borderRadius: "0.5rem",
            background: "rgba(251, 191, 36, 0.1)",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#fbbf24", fontSize: "1.2rem" }}>
            Access Restricted
          </h2>
          <p style={{ color: "#e5e7eb", lineHeight: 1.6 }}>
            Vehicle browsing is available only to owners and managers.
            If you need access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "1rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Vehicles</h1>
        <p style={{ color: "#fca5a5" }}>{error}</p>
      </div>
    );
  }

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
