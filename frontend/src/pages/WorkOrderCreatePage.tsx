// src/pages/WorkOrderCreatePage.tsx
import { useEffect, useState, type FormEvent, type ChangeEvent} from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { getCustomerVehicles, createVehicle, type Vehicle, type NewVehiclePayload } from "../api/vehicles";
import { fetchVehicleById } from "../api/vehicles"; // <-- add this
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
  const [searchParams] = useSearchParams();


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


  const [customerSearch, setCustomerSearch] = useState("");





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


  // Hydrate from URL params: ?customerId=...&vehicleId=...
  // Also supports vehicle-only links: ?vehicleId=... (we fetch the vehicle to discover customerId)
  useEffect(() => {
    const urlCustomerId = searchParams.get("customerId") || "";
    const urlVehicleId = searchParams.get("vehicleId") || "";

    // Nothing to hydrate
    if (!urlCustomerId && !urlVehicleId) return;

    // If customerId is present, set both (vehicleId may be empty, that's ok)
    if (urlCustomerId) {
      setForm((prev) => ({
        ...prev,
        customerId: urlCustomerId,
        vehicleId: urlVehicleId || prev.vehicleId,
      }));
      return;
    }

    // If only vehicleId is present, fetch vehicle -> get customerId
    if (urlVehicleId) {
      (async () => {
        try {
          const data = await fetchVehicleById(urlVehicleId);
          const v = (data?.vehicle ?? data) as { _id: string; customerId?: string; currentOdometer?: number };

          if (!v?.customerId) return;

          setForm((prev) => ({
            ...prev,
            customerId: v.customerId!,
            vehicleId: urlVehicleId,
            odometer:
              v.currentOdometer != null ? String(v.currentOdometer) : prev.odometer,
          }));
        } catch (err) {
          console.error("[Create WO] hydrateFromVehicleId failed", err);
        }
      })();
    }
    // IMPORTANT: depends on location.search changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);


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

        // ✅ KEY CHANGE:
        // If a vehicleId is already set (from URL preselect), keep it *if it exists* in this list.
        if (form.vehicleId) {
          const match = data.find((v) => v._id === form.vehicleId);
          if (match) {
            // optionally hydrate odometer from the matched vehicle
            if (match.currentOdometer != null) {
              setForm((prev) => ({
                ...prev,
                odometer: String(match.currentOdometer),
              }));
            }
            return; // keep vehicleId intact
          }

          // If vehicleId doesn't belong to this customer, clear it
          setForm((prev) => ({ ...prev, vehicleId: "" }));
          return;
        }

        // If no vehicle preselected, keep your old convenience behavior:
        // auto-select if exactly one vehicle
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
        if (!cancelled) setVehiclesLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // IMPORTANT: include form.vehicleId so the “keep preselected” logic works if hydrate happens after customerId sets
  }, [form.customerId, form.vehicleId]);




  const handleChange = (
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (!name) return;

    // 🔒 If user unlocks and changes customer, clear vehicle to avoid mismatch
    if (name === "customerId") {
      setForm((prev) => ({ ...prev, customerId: value, vehicleId: "" }));
      return;
    }


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

  const filteredCustomers = (customers ?? []).filter((c) => {
    if (!c) return false;

    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;

    const name = String(
      c.name ?? c.fullName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
    ).toLowerCase();

    const phone = String(c.phone ?? "").toLowerCase();
    const email = String((c as any).email ?? "").toLowerCase();

    return name.includes(q) || phone.includes(q) || email.includes(q);
  });

// 👇 if this line runs, it proves the component is still “inside” the function
// console.log("[Create WO] filtered customers:", filteredCustomers.length);




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
          <h1 style={{ fontSize: "2rem", fontWeight: 600, margin: 0 }}>
            Create Work Order
          </h1>

          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving}
            style={{
              fontSize: "0.9rem",
              padding: "0.4rem 0.9rem",
              borderRadius: "0.4rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
            }}
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

          {/* ✅ SINGLE FORM (no nesting) */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* ===================================================== */}
            {/* SLOT 1: CUSTOMER + SEARCH + CUSTOMER SELECT (NO <form>) */}
            {/* ===================================================== */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="customerSearch" style={{ fontSize: "0.9rem" }}>
                Customer
              </label>

              <input
                id="customerSearch"
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customer (name, phone, email)…"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              />

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
                  boxSizing: "border-box",
                }}
              >
                <option value="">
                  {customerSearch.trim()
                    ? `Select a customer (${filteredCustomers.length} match${filteredCustomers.length === 1 ? "" : "es"
                    })`
                    : "Select a customer"}
                </option>

                {filteredCustomers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {String(formatCustomerName(c) ?? "(No name)")}
                    {c.phone ? ` — ${c.phone}` : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => navigate("/customers/new?returnTo=create-work-order")}
                style={{
                  marginTop: "0.25rem",
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

            {/* ================================== */}
            {/* SLOT 2: VEHICLE SELECT + ADD VEHICLE */}
            {/* ================================== */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.9rem" }}>Vehicle</label>

              {vehiclesLoading && <p>Loading vehicles…</p>}
              {vehiclesError && <p style={{ color: "red" }}>{vehiclesError}</p>}

              {!vehiclesLoading && !vehiclesError && form.customerId && (
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
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1px solid #475569",
                        fontSize: "0.95rem",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="">Select vehicle…</option>
                      {vehicles.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.year ? `${v.year} ` : ""}
                          {v.make} {v.model}
                          {v.licensePlate ? ` (${v.licensePlate})` : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowNewVehicleForm((prev) => !prev)}
                    disabled={!form.customerId}
                    style={{
                      border: "none",
                      background: "none",
                      color: form.customerId ? "#60a5fa" : "#6b7280",
                      textDecoration: "underline",
                      cursor: form.customerId ? "pointer" : "default",
                      padding: 0,
                      width: "fit-content",
                      fontSize: "0.85rem",
                    }}
                  >
                    {showNewVehicleForm
                      ? "Cancel new vehicle"
                      : "Add a new vehicle for this customer"}
                  </button>

                  {/* SLOT 2A: INLINE NEW VEHICLE FORM (keep it as a <div>, never a <form>) */}
                  {showNewVehicleForm && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        border: "1px solid #475569",
                        borderRadius: "0.5rem",
                        padding: "0.75rem",
                        background: "#020617",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                        New vehicle details (placeholder)
                      </div>

                      {/* Add your newVehicle inputs here later */}

                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button type="button" onClick={handleCreateVehicle} disabled={vehicleSaving}>
                          Save vehicle
                        </button>
                        <button type="button" onClick={() => setShowNewVehicleForm(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ===================== */}
            {/* SLOT 3: COMPLAINT */}
            {/* ===================== */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem" }}>
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

            {/* ===================== */}
            {/* SLOT 4: ODOMETER */}
            {/* ===================== */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem" }}>
              <span>Odometer (optional)</span>
              <input
                name="odometer"
                value={form.odometer}
                onChange={handleChange}
                placeholder="e.g. 127000"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  fontSize: "1rem",
                }}
              />
            </label>

            {/* ===================== */}
            {/* SLOT 5: NOTES */}
            {/* ===================== */}
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.9rem" }}>
              <span>Notes (optional)</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
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

            {/* ===================== */}
            {/* ACTIONS */}
            {/* ===================== */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
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
                  cursor: saving || loadingCustomers ? "default" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Create Work Order"}
              </button>

              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={saving}
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #475569",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
          {/* ✅ END SINGLE FORM */}
        </div>
      </div>
    </div>
  );
}