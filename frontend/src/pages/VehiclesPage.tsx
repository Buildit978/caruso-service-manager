// frontend/src/pages/VehiclesPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccess } from "../contexts/AccessContext";
import type { HttpError } from "../api/http";
import { fetchAllVehicles, type Vehicle } from "../api/vehicles";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { setVehiclesAccess, vehiclesAccess } = useAccess();

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllVehicles({ search });
        setVehicles(data);
        setVehiclesAccess(true); // Server confirmed access
      } catch (err: unknown) {
        console.error("[VehiclesPage] load error", err);
        const httpError = err as HttpError;
        
        // Server denied access (403 Forbidden)
        if (httpError?.status === 403) {
          setVehiclesAccess(false);
          setError(null); // Don't show generic error, we'll show Access Restricted card
        } else {
          setError("Could not load vehicles.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadVehicles();
  }, [search, setVehiclesAccess]);

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
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Vehicles</h1>
        <p style={{ color: "#fca5a5" }}>{error}</p>
      </div>
    );
  }

  // Helper to truncate VIN for display
  const truncateVIN = (vin: string | undefined): string => {
    if (!vin) return "-";
    return vin.length > 8 ? `${vin.substring(0, 8)}...` : vin;
  };

  // Copy VIN to clipboard
  const handleCopyVIN = async (vin: string) => {
    try {
      await navigator.clipboard.writeText(vin);
      // Optional: could show a toast here, but keeping it simple per spec
    } catch (err) {
      console.error("Failed to copy VIN", err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div
          style={{
            maxWidth: "1100px",
            marginLeft: "auto",
            marginRight: "auto",
            paddingRight: "100px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Left: Title */}
          <h1 className="text-2xl font-semibold">Vehicles</h1>

          {/* Right: Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <input
              type="text"
              placeholder="Search vehicles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                height: "32px",
                padding: "0 10px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "white",
                color: "#111827",
                minWidth: "220px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {vehicles.length === 0 ? (
        <p>No vehicles found.</p>
      ) : (
        <div className="table-scroll customers-table-scroll">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  Make
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  Model
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  Year
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  License Plate
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  Odometer
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  VIN
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  Colour
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  Notes
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  View
                </th>
              </tr>
            </thead>

            <tbody>
              {vehicles.map((v) => (
                <tr key={v._id}>
                  <td style={{ padding: "0.5rem 0", paddingLeft: "20px" }}>
                    {v.make || "-"}
                  </td>
                  <td>{v.model || "-"}</td>
                  <td>{v.year || "-"}</td>
                  <td>{v.licensePlate || "-"}</td>
                  <td className="num">
                    {v.currentOdometer != null
                      ? v.currentOdometer.toLocaleString()
                      : "-"}
                  </td>
                  <td>
                    {v.vin ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span title={v.vin}>{truncateVIN(v.vin)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyVIN(v.vin!)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.125rem 0.375rem",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            backgroundColor: "white",
                            cursor: "pointer",
                          }}
                          title="Copy VIN"
                        >
                          Copy
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{v.color || "-"}</td>
                  <td>{v.notes || "-"}</td>
                  <td>
                    <Link to={`/customers/${v.customerId}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
