// frontend/src/pages/CustomerDetailPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import CustomerVehiclesSection from "../components/CustomerVehiclesSection";
import CustomerEstimatesSection from "../components/CustomerEstimatesSection";
import type { Customer } from "../types/customer";
import { fetchCustomer } from "../api/customers";
import { createEstimate } from "../api/estimates";


export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [estimateError, setEstimateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();

    async function handleNewEstimate() {
        if (!customer?._id) return;
        setCreating(true);
        setEstimateError(null);
        try {
            const estimate = await createEstimate({ customerId: customer._id });
            navigate(`/estimates/${estimate._id}`);
        } catch (err) {
            setEstimateError((err as Error)?.message ?? "Could not create estimate.");
        } finally {
            setCreating(false);
        }
    }

    useEffect(() => {
        if (!id) {
            setError("No customer ID provided.");
            setLoading(false);
            return;
        }

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const data = await fetchCustomer(id);
                setCustomer(data);
            } catch (err) {
                console.error("[CustomerDetailPage] load error", err);
                setError("Could not load customer.");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    if (loading) {
        return <p>Loading customer…</p>;
    }

    if (error) {
        return <p style={{ color: "red" }}>{error}</p>;
    }

    if (!customer) {
        return <p>Customer not found.</p>;
    }

    const name = customer.fullName
        ? customer.fullName
        : `${customer.firstName} ${customer.lastName}`.trim();

    return (
        <div style={{ padding: "2rem" }}>
            {/* Header row: Back + Name + Edit button */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.5rem",
                }}
            >
                <div>
                    <div style={{ marginBottom: "0.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                        <Link to="/customers">&larr; Back to Customers</Link>
                        <button
                            type="button"
                            onClick={() => navigate("/vehicles")}
                            style={{
                                fontSize: "0.9rem",
                                padding: "0.4rem 0.9rem",
                                borderRadius: "0.4rem",
                                border: "1px solid #cbd5e1",
                                background: "#0f172a",
                                color: "#e5e7eb",
                                cursor: "pointer",
                            }}
                        >
                            Back to Vehicles
                        </button>
                    </div>
                    <h2 style={{ marginBottom: "0.5rem", fontSize: "1.6rem", fontWeight: 600, color: "#ffffff" }}>
                        {name}
                    </h2>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                        type="button"
                        onClick={handleNewEstimate}
                        disabled={creating}
                        style={{
                            fontSize: "0.9rem",
                            padding: "0.4rem 0.9rem",
                            borderRadius: "0.4rem",
                            border: "1px solid #cbd5e1",
                            background: "#1d4ed8",
                            color: "#e5e7eb",
                            cursor: creating ? "not-allowed" : "pointer",
                        }}
                    >
                        {creating ? "Creating…" : "New Estimate"}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                `/customers/${customer._id}/edit?returnTo=/customers/${customer._id}`
                            )
                        }
                        style={{
                            fontSize: "0.9rem",
                            padding: "0.4rem 0.9rem",
                            borderRadius: "0.4rem",
                            border: "1px solid #cbd5e1",
                            background: "#0f172a",
                            color: "#e5e7eb",
                            cursor: "pointer",
                        }}
                    >
                        Edit Customer
                    </button>
                </div>
            </div>

            {estimateError && (
                <p style={{ color: "red", marginBottom: "1rem" }}>{estimateError}</p>
            )}

            {/* Contact info */}
            <div style={{ marginBottom: "1rem" }}>
                {customer.phone && <p>Phone: {customer.phone}</p>}
                {customer.email && <p>Email: {customer.email}</p>}
                {customer.address && <p>Address: {customer.address}</p>}
                {customer.notes && <p>Notes: {customer.notes}</p>}
            </div>

            {/* Vehicles for this customer */}
            <CustomerVehiclesSection customerId={customer._id} />

            {/* Estimates for this customer */}
            <CustomerEstimatesSection customerId={customer._id} />
        </div>
    );
}
