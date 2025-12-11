// src/pages/WorkOrderCreatePage.tsx
import { useEffect, useState, type FormEvent, type ChangeEvent,} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCustomerVehicles, createVehicle, type Vehicle, type NewVehiclePayload, } from "../api/vehicles";
import { fetchCustomers } from "../api/customers";
import { createWorkOrder } from "../api/workOrders";
import type { Customer } from "../types/customer";

// If this already exists elsewhere in the file, keep that one and remove this.
// I'm adding it here in case it was missing.
type NewWorkOrderForm = {
  customerId: string;
  complaint: string;
  odometer: string;
  notes: string;
  vehicleId: string;
};

export default function WorkOrderCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<NewWorkOrderForm>({
    customerId: "",
    complaint: "",
    odometer: "",
    notes: "",
    vehicleId: "",
  });

  // Inline "new vehicle" mini form
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    year: "",
    make: "",
    model: "",
    vin: "",
    licensePlate: "",
    color: "",
    notes: "",
    odometer: "",
  });

  // Helper to format customer name safely
  const formatCustomerName = (c: Customer) =>
    c.name || // current primary
    c.fullName ||
    `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() ||
    "(No name)";

  // Load customers for the dropdown
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoadingCustomers(true);
        setError(null);

        const data = await fetchCustomers();
        console.log("[Create WO] customers:", data);
        setCustomers(data);
      } catch (err: any) {
        console.error("[Create WO] Failed to load customers", err);
        setError("Could not load customers. Please try again.");
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, []);

  // If a customerId is passed in the URL (e.g. after creating a new customer),
  // preselect it in the form.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const customerIdFromUrl = params.get("customerId");

    if (customerIdFromUrl) {
      setForm((prev) => ({
        ...prev,
        customerId: customerIdFromUrl,
      }));
    }
  }, [location.search]);

  // Whenever the selected customer changes, load their vehicles
  useEffect(() => {
    if (!form.customerId) {
      setVehicles([]);
      setVehiclesError(null);
      setForm((prev) => ({ ...prev, vehicleId: "" }));
      return;
    }

    let cancelled = false;
    setVehiclesLoading(true);
    setVehiclesError(null);

    getCustomerVehicles(form.customerId)
      .then((data) => {
        if (cancelled) return;

        setVehicles(data);

        // Clear previous selection by default
        setForm((prev) => ({
          ...prev,
          vehicleId: "",
        }));

        // Optional: if the customer has exactly one vehicle, auto-select it
        if (data.length === 1) {
          const v = data[0];
          setForm((prev) => ({
            ...prev,
            vehicleId: v._id,
            odometer:
              v.currentOdometer != null
                ? String(v.currentOdometer)
                : prev.odometer,
          }));
        }
      })
      .catch((err) => {
        console.error("[Create WO] getCustomerVehicles error", err);
        if (!cancelled) {
          setVehicles([]);
          setVehiclesError("Could not load vehicles for this customer.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVehiclesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.customerId]);

  const handleChange = (
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const vehicleId = e.target.value;
    setForm((prev) => ({
      ...prev,
      vehicleId,
    }));

    const v = vehicles.find((veh) => veh._id === vehicleId);
    if (v && v.currentOdometer != null) {
      setForm((prev) => ({
        ...prev,
        odometer: String(v.currentOdometer),
      }));
    }
  };

  async function handleCreateVehicle() {
    if (!form.customerId) {
      alert("Please select a customer first.");
      return;
    }

    if (!newVehicle.make.trim() || !newVehicle.model.trim()) {
      alert("Make and model are required.");
      return;
    }

    try {
      setVehicleSaving(true);

      const payload: NewVehiclePayload = {
        customerId: form.customerId,
        vin: newVehicle.vin || undefined,
        year: newVehicle.year ? Number(newVehicle.year) : undefined,
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        licensePlate: newVehicle.licensePlate || undefined,
        color: newVehicle.color || undefined,
        notes: newVehicle.notes || undefined,
        odometer: newVehicle.odometer
          ? Number(newVehicle.odometer)
          : undefined,
      };

      const created = await createVehicle(payload);

      // Refresh vehicles list
      const refreshed = await getCustomerVehicles(form.customerId);
      setVehicles(refreshed);

      // Auto-select the new vehicle and update form vehicleId + odometer
      setForm((prev) => ({
        ...prev,
        vehicleId: created._id,
        odometer:
          created.currentOdometer != null
            ? String(created.currentOdometer)
            : prev.odometer,
      }));

      // Reset mini form and close it
      setNewVehicle({
        year: "",
        make: "",
        model: "",
        vin: "",
        licensePlate: "",
        color: "",
        notes: "",
        odometer: "",
      });
      setShowNewVehicleForm(false);

      console.log("[Create WO] Vehicle created and selected:", created._id);
    } catch (err) {
      console.error("[Create WO] Failed to create vehicle", err);
      alert("Could not save vehicle. Please try again.");
    } finally {
      setVehicleSaving(false);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.customerId) {
      setError("Please select a customer.");
      return;
    }

    if (!form.complaint.trim()) {
      setError("Please enter the customer's complaint.");
      return;
    }

    if (!form.vehicleId) {
      setError("Please select a vehicle for this work order.");
      return;
    }

    const payload: any = {
      customerId: form.customerId,
      complaint: form.complaint.trim(),
      notes: form.notes.trim() || undefined,
    };

    if (form.odometer.trim() !== "") {
      const od = Number(form.odometer.trim());
      if (!Number.isNaN(od)) {
        payload.odometer = od;
      }
    }

    if (form.vehicleId) {
      const v = vehicles.find((veh) => veh._id === form.vehicleId);
      if (v) {
        payload.vehicle = {
          vehicleId: v._id,
          year: v.year,
          make: v.make,
          model: v.model,
          vin: v.vin,
          licensePlate: v.licensePlate,
          color: v.color,
        };
      }
    }

    try {
      setSaving(true);

      console.log("[Create WO] payload:", payload);
      const created = await createWorkOrder(payload);

      alert("✅ Work order created.");

      navigate(`/work-orders/${created._id}`);
    } catch (err: any) {
      console.error("[Create WO] Failed to save work order", err);
      setError(err.message || "Something went wrong saving the work order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        padding: "2rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "720px" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>
            Create Work Order
          </h1>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              fontSize: "0.9rem",
              padding: "0.4rem 0.9rem",
              borderRadius: "0.4rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
            }}
            disabled={saving}
          >
            Back
          </button>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#020617",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          }}
        >
          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #fecaca",
                background: "#fee2e2",
                color: "#7f1d1d",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Customer + Vehicle */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Customer</span>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <select
                  name="customerId"
                  value={form.customerId}
                  onChange={handleChange}
                  required
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #475569",
                    fontSize: "1rem",
                  }}
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {formatCustomerName(c)}
                      {c.phone ? ` — ${c.phone}` : ""}
                    </option>
                  ))}
                </select>

                {/* VEHICLE SECTION */}
                <div style={{ marginTop: "1rem" }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span>Vehicle</span>

                    {vehiclesLoading && <p>Loading vehicles…</p>}
                    {vehiclesError && (
                      <p style={{ color: "red" }}>{vehiclesError}</p>
                    )}

                    {!vehiclesLoading &&
                      !vehiclesError &&
                      form.customerId && (
                        <>
                          {vehicles.length === 0 ? (
                            <p style={{ fontSize: "0.9rem" }}>
                              No vehicles on file for this customer yet.
                            </p>
                          ) : (
                            <select
                              name="vehicleId"
                              value={form.vehicleId}
                              onChange={handleVehicleChange}
                              style={{
                                marginTop: "0.25rem",
                                width: "100%",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #475569",
                                fontSize: "0.95rem",
                              }}
                            >
                              <option value="">Select vehicle…</option>
                              {vehicles.map((v) => (
                                <option key={v._id} value={v._id}>
                                  {v.year && `${v.year} `}
                                  {v.make} {v.model}
                                  {v.licensePlate &&
                                    ` (${v.licensePlate})`}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Toggle inline "Add Vehicle" form */}
                          <div
                            style={{
                              marginTop: "0.5rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.8rem",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setShowNewVehicleForm((prev) => !prev)
                              }
                              disabled={!form.customerId}
                              style={{
                                border: "none",
                                background: "none",
                                color: form.customerId
                                  ? "#60a5fa"
                                  : "#6b7280",
                                textDecoration: "underline",
                                cursor: form.customerId
                                  ? "pointer"
                                  : "default",
                                padding: 0,
                              }}
                            >
                              {showNewVehicleForm
                                ? "Cancel new vehicle"
                                : "Add a new vehicle for this customer"}
                            </button>
                          </div>

                          {/* INLINE NEW VEHICLE FORM */}
                          {showNewVehicleForm && form.customerId && (
                            <div
                              style={{
                                marginTop: "0.75rem",
                                border: "1px solid #e5e7eb",
                                borderRadius: "0.5rem",
                                padding: "0.75rem",
                                background: "#020617",
                              }}
                            >
                              <h3
                                style={{
                                  fontSize: "0.85rem",
                                  fontWeight: 600,
                                  marginBottom: "0.5rem",
                                }}
                              >
                                New vehicle details
                              </h3>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                  gap: "0.5rem",
                                }}
                              >
                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Year
                                  </label>
                                  <input
                                    type="text"
                                    value={newVehicle.year}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        year: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Make *
                                  </label>
                                  <input
                                    type="text"
                                    value={newVehicle.make}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        make: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Model *
                                  </label>
                                  <input
                                    type="text"
                                    value={newVehicle.model}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        model: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Plate
                                  </label>
                                  <input
                                    type="text"
                                    value={newVehicle.licensePlate}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        licensePlate: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    VIN
                                  </label>
                                  <input
                                    type="text"
                                    value={newVehicle.vin}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        vin: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Color
                                  </label>
                                  <input
                                    type="text"
                                    value={newVehicle.color}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        color: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Odometer (km)
                                  </label>
                                  <input
                                    type="number"
                                    value={newVehicle.odometer}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        odometer: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                </div>

                                <div style={{ gridColumn: "1 / -1" }}>
                                  <label
                                    style={{
                                      display: "block",
                                      fontSize: "0.75rem",
                                      marginBottom: "0.15rem",
                                    }}
                                  >
                                    Notes
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={newVehicle.notes}
                                    onChange={(e) =>
                                      setNewVehicle((prev) => ({
                                        ...prev,
                                        notes: e.target.value,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem 0.5rem",
                                      borderRadius: "0.35rem",
                                      border: "1px solid #475569",
                                      fontSize: "0.8rem",
                                      resize: "vertical",
                                    }}
                                  />
                                </div>
                              </div>

                              <div
                                style={{
                                  marginTop: "0.75rem",
                                  display: "flex",
                                  gap: "0.5rem",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={handleCreateVehicle}
                                  disabled={vehicleSaving}
                                  style={{
                                    padding: "0.4rem 0.9rem",
                                    borderRadius: "0.4rem",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#fff",
                                    fontSize: "0.8rem",
                                    cursor: vehicleSaving
                                      ? "default"
                                      : "pointer",
                                    opacity: vehicleSaving ? 0.6 : 1,
                                  }}
                                >
                                  {vehicleSaving
                                    ? "Saving..."
                                    : "Save & use for this work order"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowNewVehicleForm(false)
                                  }
                                  style={{
                                    padding: "0.4rem 0.9rem",
                                    borderRadius: "0.4rem",
                                    border: "1px solid #475569",
                                    background: "transparent",
                                    color: "#e5e7eb",
                                    fontSize: "0.8rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/customers/new?returnTo=create-work-order")
                  }
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.85rem",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.4rem",
                    border: "1px solid #475569",
                    background: "transparent",
                    color: "#e5e7eb",
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  + Add New Customer
                </button>
              </div>
            </label>

            {/* Complaint */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Complaint</span>
              <textarea
                name="complaint"
                value={form.complaint}
                onChange={handleChange}
                rows={5}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                  lineHeight: "1.4",
                  resize: "vertical",
                }}
              />
            </label>

            {/* Odometer */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Odometer (optional)</span>
              <input
                name="odometer"
                value={form.odometer}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
                placeholder="e.g. 127000"
              />
            </label>

            {/* Notes */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <span>Notes (optional)</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={5}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                  lineHeight: "1.4",
                  resize: "vertical",
                }}
              />
            </label>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="submit"
                disabled={saving || loadingCustomers}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 500,
                  fontSize: "0.95rem",
                  opacity: saving || loadingCustomers ? 0.6 : 1,
                  cursor:
                    saving || loadingCustomers ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Create Work Order"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
