// frontend/src/pages/CustomersPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Customer } from "../types/customer";
import { fetchCustomers } from "../api/customers";



export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const customersData = await fetchCustomers();

                setCustomers(customersData);
            } catch (err) {
                console.error("[CustomersPage] load error", err);
                setError("Could not load customers.");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    if (loading) {
        return <p>Loading customers…</p>;
    }

    if (error) {
        return <p style={{ color: "red" }}>{error}</p>;
    }

    return (
        <div>
            <h2>Customers</h2>

            {customers.length === 0 ? (
                <p>No customers yet.</p>
            ) : (
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            marginTop: "1rem",
                        }}
                    >
                        <thead>
                            <tr>
                                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                                    Name
              </th>
                                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                                    Phone
              </th>
                                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                                    Email
              </th>
                                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                                    Open WOs
              </th>
                                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                                    Actions
              </th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((c) => (
                                <tr key={c._id}>
                                    <td style={{ padding: "0.5rem 0", paddingLeft: "20px" }}>
                                        {c.fullName || `${c.firstName} ${c.lastName}`}
                                    </td>
                                    <td>{c.phone || "-"}</td>
                                    <td>{c.email || "-"}</td>
                                    <td>{c.openWorkOrders ?? c.openWorkOrdersCount ?? 0}</td>
                                    <td>
                                        <Link to={`/customers/${c._id}`}>View</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
        </div>
    );
}
