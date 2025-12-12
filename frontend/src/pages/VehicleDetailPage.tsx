// frontend/src/pages/VehicleDetailPage.tsx
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchVehicleById } from "../api/vehicles";

type Vehicle = {
  _id: string;
  year?: number;
  make?: string;
  model?: string;
  licensePlate?: string;
  vin?: string;
  customerId?: string;
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchVehicleById(id);
        setVehicle((data?.vehicle ?? data) as Vehicle);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load vehicle");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div style={{ padding: "1rem" }}>Loading vehicle…</div>;
  if (error) return <div style={{ padding: "1rem" }}>{error}</div>;
  if (!vehicle) return <div style={{ padding: "1rem" }}>Vehicle not found.</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="..">&larr; Back</Link>
      </div>

      <h1 style={{ marginBottom: "0.25rem" }}>
        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
          "Vehicle"}
      </h1>

      <div style={{ opacity: 0.85, marginBottom: "1rem" }}>
        {vehicle.licensePlate ? `Plate: ${vehicle.licensePlate}` : ""}
        {vehicle.licensePlate && vehicle.vin ? " • " : ""}
        {vehicle.vin ? `VIN: ${vehicle.vin}` : ""}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => navigate(`/work-orders/new?vehicleId=${vehicle._id}`)}
          style={{
            padding: "0.6rem 0.9rem",
            borderRadius: "10px",
            border: "1px solid #374151",
          }}
        >
          New Work Order
        </button>

        {vehicle.customerId && (
          <Link to={`/customers/${vehicle.customerId}`} style={{ alignSelf: "center" }}>
            View Owner
          </Link>
        )}
      </div>
    </div>
  );
}
