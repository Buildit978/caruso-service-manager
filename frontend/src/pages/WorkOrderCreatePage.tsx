// src/pages/WorkOrderCreatePage.tsx
import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCustomerVehicles, type Vehicle } from "../api/vehicles";
import { fetchCustomers } from "../api/customers";
import { createWorkOrder } from "../api/workOrders";
import type { Customer } from "../types/customer";



export default function WorkOrderCreatePage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
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
        vehicleId: "",   // 👈 NEW
    });

    // Helper to format customer name safely
    // Helper to format customer name safely
    const formatCustomerName = (c: Customer) =>
        c.name ||                    // ← use name FIRST since that's what exists now
        c.fullName ||                // virtual, if you add it later
        `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() ||
        "(No name)";



    // Load customers for the dropdown
    useEffect(() => {
        const loadCustomers = async () => {
            try {
                setLoadingCustomers(true);
                setError(null);

                const data = await fetchCustomers();
                console.log("[Create WO] customers:", data); // 👈 add this
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
            return;
        }

        let cancelled = false;
        setVehiclesLoading(true);
        setVehiclesError(null);

        getCustomerVehicles(form.customerId)
            .then((data) => {
                if (!cancelled) {
                    setVehicles(data);
                    // Reset selected vehicle when customer changes
                    setForm((prev) => ({
                        ...prev,
                        vehicleId: "",
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
    }, [form.customerId, setForm]);


    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };



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

        // Prepare payload to match backend route: { customerId, complaint, odometer, notes }
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

            // Go straight to the detail page for the new work order
            navigate(`/work-orders/${created._id}`);
        } catch (err: any) {
            console.error("[Create WO] Failed to save work order", err);
            setError(err.message || "Something went wrong saving the work order.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}>
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
                        background: "#020617", // matches your dark theme; change to "#fff" for white card
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
                        {/* Customer */}
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

                                <div style={{ marginTop: "1rem" }}>
                                    <label>
                                        Vehicle
        {vehiclesLoading && <p>Loading vehicles…</p>}
                                        {vehiclesError && (
                                            <p style={{ color: "red" }}>{vehiclesError}</p>
                                        )}

                                        {!vehiclesLoading && !vehiclesError && form.customerId && (
                                            <>
                                                {vehicles.length === 0 ? (
                                                    <p style={{ fontSize: "0.9rem" }}>
                                                        No vehicles on file for this customer yet.
                                                        You can add vehicles from the customer page.
                                                    </p>
                                                ) : (
                                                        <select
                                                            name="vehicleId"
                                                            value={form.vehicleId}
                                                            onChange={handleChange}
                                                        >
                                                            <option value="">Select vehicle…</option>
                                                            {vehicles.map((v) => (
                                                                <option key={v._id} value={v._id}>
                                                                    {v.year && `${v.year} `}
                                                                    {v.make} {v.model}
                                                                    {v.licensePlate && ` (${v.licensePlate})`}
                                                                </option>
                                                            ))}
                                                        </select>
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
                            style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}
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
                                    cursor: saving || loadingCustomers ? "default" : "pointer",
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
