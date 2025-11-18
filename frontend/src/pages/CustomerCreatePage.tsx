// src/pages/CustomerCreatePage.tsx
import { useState, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createCustomer } from "../api/customers";
import type { CustomerPayload } from "../api/customers";

type CustomerForm = {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
};


export default function CustomerCreatePage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [form, setForm] = useState<CustomerForm>({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        address: "",
    });


    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.firstName.trim() && !form.lastName.trim()) {
            setError("Customer name is required.");
            return;
        }

        try {
            setSaving(true);

            const payload: CustomerPayload = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                phone: form.phone.trim() || undefined,
                email: form.email.trim() || undefined,
                address: form.address.trim() || undefined,
            };

            const created = await createCustomer(payload);

            // Check if we came from "Create Work Order"
            const params = new URLSearchParams(location.search);
            const returnTo = params.get("returnTo");

            if (returnTo === "create-work-order") {
                // Send back to Create Work Order with this customer preselected
                navigate(`/work-orders/new?customerId=${created._id}`);
            } else {
                // Default: go back to customer list (or home for now)
                navigate("/customers");
            }
        } catch (err: any) {
            console.error("[Create Customer] Failed to save customer", err);
            setError(err.message || "Something went wrong saving the customer.");
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
                    <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>Add New Customer</h1>

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
                        background: "#020617", // dark card; change to "#fff" for light
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
                        {/* First Name */}
                        <label
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            <span>First Name</span>
                            <input
                                name="firstName"
                                value={form.firstName}
                                onChange={handleChange}
                                required
                                style={{
                                    width: "100%",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #475569",
                                    fontSize: "1rem",
                                }}
                            />
                        </label>

                        {/* Last Name */}
                        <label
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            <span>Last Name</span>
                            <input
                                name="lastName"
                                value={form.lastName}
                                onChange={handleChange}
                                required
                                style={{
                                    width: "100%",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #475569",
                                    fontSize: "1rem",
                                }}
                            />
                        </label>

                        {/* Phone */}
                        <label
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            <span>Phone (optional)</span>
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                style={{
                                    width: "100%",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #475569",
                                    fontSize: "1rem",
                                }}
                            />
                        </label>

                        {/* Email */}
                        <label
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            <span>Email (optional)</span>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                style={{
                                    width: "100%",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #475569",
                                    fontSize: "1rem",
                                }}
                            />
                        </label>

                        {/* Address */}
                        <label
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                fontSize: "0.9rem",
                            }}
                        >
                            <span>Address (optional)</span>
                            <textarea
                                name="address"
                                value={form.address}
                                onChange={handleChange}
                                rows={3}
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
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                            <button
                                type="submit"
                                disabled={saving}
                                style={{
                                    padding: "0.5rem 1.25rem",
                                    borderRadius: "0.5rem",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#fff",
                                    fontWeight: 500,
                                    fontSize: "0.95rem",
                                    opacity: saving ? 0.6 : 1,
                                    cursor: saving ? "default" : "pointer",
                                }}
                            >
                                {saving ? "Saving…" : "Save Customer"}
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
