// frontend/src/pages/CustomerDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import CustomerVehiclesSection from "../components/CustomerVehiclesSection";
import type { Customer } from "../types/customer";
import { fetchCustomer } from "../api/customers";


export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        <div>
            <div style={{ marginBottom: "1rem" }}>
                <Link to="/customers">&larr; Back to Customers</Link>
            </div>

            <h2 style={{ marginBottom: "0.5rem" }}>{name}</h2>

            <div style={{ marginBottom: "1rem" }}>
                {customer.phone && <p>Phone: {customer.phone}</p>}
                {customer.email && <p>Email: {customer.email}</p>}
                {customer.address && <p>Address: {customer.address}</p>}
                {customer.notes && <p>Notes: {customer.notes}</p>}
            </div>

            {/* Vehicles for this customer */}
            <CustomerVehiclesSection customerId={customer._id} />
        </div>
    );
}
