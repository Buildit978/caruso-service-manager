// src/components/CustomerVehiclesSection.tsx
import { useEffect, useState } from "react";
import {
    getCustomerVehicles,
    addCustomerVehicle,
    updateCustomerVehicle,
    deleteCustomerVehicle,
    type NewVehiclePayload,
    type Vehicle,
} from "../api/vehicles";

interface CustomerVehiclesSectionProps {
    customerId: string;
}

export default function CustomerVehiclesSection({
    customerId,
}: CustomerVehiclesSectionProps) {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

    const [form, setForm] = useState<NewVehiclePayload>({
        year: undefined,
        make: "",
        model: "",
        vin: "",
        licensePlate: "",
        color: "",
        notes: "",
    });

    useEffect(() => {
        if (!customerId) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        getCustomerVehicles(customerId)
            .then((data) => {
                if (!cancelled) {
                    setVehicles(data);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError("Could not load vehicles.");
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [customerId]);

    const resetForm = () => {
        setForm({
            year: undefined,
            make: "",
            model: "",
            vin: "",
            licensePlate: "",
            color: "",
            notes: "",
        });
        setEditingVehicleId(null);
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;

        if (name === "year") {
            setForm((prev) => ({
                ...prev,
                year: value ? Number(value) : undefined,
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleEditClick = (vehicle: Vehicle) => {
        setEditingVehicleId(vehicle._id);
        setForm({
            year: vehicle.year,
            make: vehicle.make || "",
            model: vehicle.model || "",
            vin: vehicle.vin || "",
            licensePlate: vehicle.licensePlate || "",
            color: vehicle.color || "",
            notes: vehicle.notes || "",
        });
    };

    const handleDeleteClick = async (vehicleId: string) => {
        const confirmed = window.confirm(
            "Delete this vehicle? This cannot be undone."
        );
        if (!confirmed) return;

        try {
            await deleteCustomerVehicle(customerId, vehicleId);
            setVehicles((prev) => prev.filter((v) => v._id !== vehicleId));

            if (editingVehicleId === vehicleId) {
                resetForm();
            }
        } catch (err) {
            console.error("[CustomerVehiclesSection] delete error", err);
            setError("Could not delete vehicle.");
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId) return;

        setSaving(true);
        setError(null);

        try {
            if (editingVehicleId) {
                // Update existing vehicle
                const updated = await updateCustomerVehicle(
                    customerId,
                    editingVehicleId,
                    form
                );

                setVehicles((prev) =>
                    prev.map((v) => (v._id === editingVehicleId ? updated : v))
                );
            } else {
                // Create new vehicle
                const created = await addCustomerVehicle(customerId, form);
                setVehicles((prev) => [...prev, created]);
            }

            resetForm();
        } catch (err) {
            console.error("[CustomerVehiclesSection] save error", err);
            setError("Could not save vehicle.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section style={{ marginTop: "2rem" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Vehicles</h3>

            {loading ? (
                <p>Loading vehicles…</p>
            ) : error ? (
                <p style={{ color: "red" }}>{error}</p>
            ) : vehicles.length === 0 ? (
                <p>No vehicles on file for this customer yet.</p>
            ) : (
                            <ul style={{ paddingLeft: "1.25rem", marginBottom: "1rem" }}>
                                {vehicles.map((v) => (
                                    <li key={v._id} style={{ marginBottom: "0.25rem" }}>
                                        <span>
                                            {v.year && `${v.year} `}
                                            {v.make} {v.model}
                                            {v.licensePlate && ` (${v.licensePlate})`}
                                        </span>{" "}
                                        <button
                                            type="button"
                                            style={{ marginLeft: "0.5rem" }}
                                            onClick={() => handleEditClick(v)}
                                        >
                                            Edit
              </button>
                                        <button
                                            type="button"
                                            style={{ marginLeft: "0.5rem" }}
                                            onClick={() => handleDeleteClick(v._id)}
                                        >
                                            Delete
              </button>
                                    </li>
                                ))}
                            </ul>
                        )}

            <h4 style={{ margin: "1rem 0 0.5rem" }}>
                {editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}
            </h4>
            <form
                onSubmit={handleSubmit}
                style={{
                    display: "grid",
                    gap: "0.5rem",
                    maxWidth: "420px",
                }}
            >
                <div>
                    <input
                        type="number"
                        name="year"
                        placeholder="Year"
                        value={form.year ?? ""}
                        onChange={handleChange}
                        style={{ width: "100%", padding: "0.35rem" }}
                    />
                </div>
                <div>
                    <input
                        type="text"
                        name="make"
                        placeholder="Make (e.g., Honda)"
                        value={form.make || ""}
                        onChange={handleChange}
                        style={{ width: "100%", padding: "0.35rem" }}
                    />
                </div>
                <div>
                    <input
                        type="text"
                        name="model"
                        placeholder="Model (e.g., Civic)"
                        value={form.model || ""}
                        onChange={handleChange}
                        style={{ width: "100%", padding: "0.35rem" }}
                    />
                </div>
                <div>
                    <input
                        type="text"
                        name="licensePlate"
                        placeholder="License Plate"
                        value={form.licensePlate || ""}
                        onChange={handleChange}
                        style={{ width: "100%", padding: "0.35rem" }}
                    />
                </div>
                <div>
                    <input
                        type="text"
                        name="vin"
                        placeholder="VIN"
                        value={form.vin || ""}
                        onChange={handleChange}
                        style={{ width: "100%", padding: "0.35rem" }}
                    />
                </div>
                <div>
                    <input
                        type="text"
                        name="color"
                        placeholder="Color"
                        value={form.color || ""}
                        onChange={handleChange}
                        style={{ width: "100%", padding: "0.35rem" }}
                    />
                </div>
                <div>
                    <textarea
                        name="notes"
                        placeholder="Notes (e.g., “winter tires”, “rust on rocker panel”)"
                        value={form.notes || ""}
                        onChange={handleChange}
                        rows={3}
                        style={{ width: "100%", padding: "0.35rem", resize: "vertical" }}
                    />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button type="submit" disabled={saving}>
                        {saving
                            ? editingVehicleId
                                ? "Saving…"
                                : "Saving…"
                            : editingVehicleId
                                ? "Update Vehicle"
                                : "Save Vehicle"}
                    </button>

                    {editingVehicleId && (
                        <button type="button" onClick={resetForm}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}
