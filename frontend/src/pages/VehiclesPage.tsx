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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedVinId, setExpandedVinId] = useState<string | null>(null);
  const [copiedVinId, setCopiedVinId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const { setVehiclesAccess, vehiclesAccess } = useAccess();

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch vehicles based on debounced search
  useEffect(() => {
    const loadVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllVehicles({ search: debouncedSearch });
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
  }, [debouncedSearch, setVehiclesAccess]);

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

  // Helper to truncate VIN for display
  const truncateVIN = (vin: string | undefined): string => {
    if (!vin) return "-";
    return vin.length > 8 ? `${vin.substring(0, 8)}...` : vin;
  };

  // Copy VIN to clipboard with iOS Safari fallback
  const handleCopyVIN = async (vin: string, vehicleId: string) => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(vin);
      setCopiedVinId(vehicleId);
      setTimeout(() => setCopiedVinId(null), 1000);
    } catch (err) {
      // Fallback for iOS Safari
      try {
        const textarea = document.createElement("textarea");
        textarea.value = vin;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedVinId(vehicleId);
        setTimeout(() => setCopiedVinId(null), 1000);
      } catch (fallbackErr) {
        console.error("Failed to copy VIN", fallbackErr);
      }
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header - Always rendered */}
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

          {/* Right: Search - Always rendered */}
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

      {/* Loading indicator - Below input, doesn't replace it */}
      {loading && (
        <p style={{ marginBottom: "1rem" }}>Loading vehicles…</p>
      )}

      {/* Error display */}
      {error && (
        <p style={{ color: "#fca5a5", marginBottom: "1rem" }}>{error}</p>
      )}

      {/* Table */}
      {!loading && vehicles.length === 0 ? (
        <p>No vehicles found.</p>
      ) : !loading ? (
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
                        <button
                          type="button"
                          onClick={() => setExpandedVinId(expandedVinId === v._id ? null : v._id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            margin: 0,
                            cursor: "pointer",
                            textAlign: "left",
                            color: "inherit",
                            fontSize: "inherit",
                            fontFamily: "inherit",
                            appearance: "none",
                            WebkitAppearance: "none",
                          }}
                        >
                          {expandedVinId === v._id ? v.vin : truncateVIN(v.vin)}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyVIN(v.vin!, v._id)}
                          aria-label="Copy VIN"
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.5rem",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            backgroundColor: "#f8f9fa",
                            color: "#374151",
                            cursor: "pointer",
                            margin: 0,
                            appearance: "none",
                            WebkitAppearance: "none",
                            fontWeight: 500,
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#e9ecef";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#f8f9fa";
                          }}
                        >
                          {copiedVinId === v._id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{v.color || "-"}</td>
                  <td>
                    {v.notes ? (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.25rem", flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                          {expandedNotesId === v._id ? (
                            v.notes
                          ) : (
                            v.notes.length > 60 ? `${v.notes.slice(0, 60)}…` : v.notes
                          )}
                        </span>
                        {v.notes.length > 60 && (
                          <button
                            type="button"
                            onClick={() => setExpandedNotesId(expandedNotesId === v._id ? null : v._id)}
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.125rem 0.375rem",
                              border: "1px solid #cbd5e1",
                              borderRadius: "4px",
                              backgroundColor: "#f8f9fa",
                              color: "#374151",
                              cursor: "pointer",
                              margin: 0,
                              appearance: "none",
                              WebkitAppearance: "none",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {expandedNotesId === v._id ? "Less" : "More"}
                          </button>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <Link to={`/customers/${v.customerId}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
