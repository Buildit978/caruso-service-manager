// frontend/src/pages/VehicleDetailPage.tsx
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchVehicleById } from "../api/vehicles";
import { fetchWorkOrders } from "../api/workOrders";
import type { WorkOrder } from "../types/workOrder";
import { isBillingLockedError } from "../state/billingLock";


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
    
   const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
   const [woLoading, setWoLoading] = useState(false);
   const [woError, setWoError] = useState<string | null>(null);
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
        setVehicle(data as Vehicle);
      } catch (e: any) {
        setError(isBillingLockedError(e) ? "Billing is inactive. Update billing to continue." : e?.message ?? "Failed to load vehicle");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);
    
       useEffect(() => {
            if (!id) return;

            (async () => {
                try {
                setWoLoading(true);
                setWoError(null);

                const items = await fetchWorkOrders({
                    vehicleId: id,
                    sortBy: "createdAt",
                    sortDir: "desc",
                });

                setWorkOrders(items);
                } catch (e: any) {
                setWoError(isBillingLockedError(e) ? "Billing is inactive. Update billing to continue." : e?.message ?? "Failed to load work orders");
                } finally {
                setWoLoading(false);
                }
            })();
            }, [id]);

  if (loading) return <div style={{ padding: "1rem" }}>Loading vehicle…</div>;
  if (error) return <div style={{ padding: "1rem" }}>{error}</div>;
  if (!vehicle) return <div style={{ padding: "1rem" }}>Vehicle not found.</div>;

    
    
  return (
    <div className="vehicle-detail" style={{ padding: "1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#93c5fd",
            cursor: "pointer",
            fontSize: "1rem",
            fontFamily: "inherit",
          }}
        >
          &larr; Back
        </button>
      </div>

      <h1 className="vehicle-detail__title" style={{ marginBottom: "0.25rem" }}>
        {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
          "Vehicle"}
      </h1>

      <div className="vehicle-detail__meta" style={{ opacity: 0.9, marginBottom: "1rem" }}>
        {vehicle.licensePlate ? `Plate: ${vehicle.licensePlate}` : ""}
        {vehicle.licensePlate && vehicle.vin ? " • " : ""}
        {vehicle.vin ? `VIN: ${vehicle.vin}` : ""}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => {
                      const qs = new URLSearchParams();
                      if (vehicle.customerId) qs.set("customerId", vehicle.customerId);
                      qs.set("vehicleId", vehicle._id);
                      navigate(`/work-orders/new?${qs.toString()}`);
                    }}
          style={{
            padding: "0.6rem 0.9rem",
            borderRadius: "10px",
            border: "1px solid #374151",
          }}
        >
          New Work Order
              </button>
          </div>    
              <section className="vehicle-detail__section" style={{ marginTop: "1.5rem" }}>
                    <h2 className="vehicle-detail__section-title" style={{ marginBottom: "0.5rem" }}>Work Orders</h2>

                    {woLoading ? (
                        <p className="vehicle-detail__text">Loading work orders…</p>
                    ) : woError ? (
                        <p className="vehicle-detail__text">{woError}</p>
                    ) : workOrders.length === 0 ? (
                        <p className="vehicle-detail__text">No work orders for this vehicle.</p>
                    ) : (
                        <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                        {workOrders.map((wo) => (
                            <li key={wo._id} style={{ marginBottom: "0.5rem" }}>
                            <Link to={`/work-orders/${wo._id}`} className="vehicle-detail__wo-link">
                                {(wo.status || "open").toUpperCase()} — {wo.complaint || "Work Order"}
                            </Link>
                            </li>
                        ))}
                        </ul>
                    )}
              </section>


        {vehicle.customerId && (
          <Link to={`/customers/${vehicle.customerId}`} className="vehicle-detail__owner-link" style={{ alignSelf: "center", display: "inline-block", marginTop: "1rem" }}>
            View Owner
          </Link>
        )}
      </div>
  );
    
    
     

}
