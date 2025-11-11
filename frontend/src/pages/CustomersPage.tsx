// frontend/src/pages/CustomersPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Customer = {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    openWorkOrdersCount?: number; // optional – handy later if you add it to the API
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                setLoading(true);
                setError(null);

                const res = await fetch("http://localhost:4000/api/customers");
                if (!res.ok) {
                    throw new Error(`Request failed with status ${res.status}`);
                }

                const data = await res.json();
                setCustomers(data);
            } catch (err: any) {
                console.error("Error fetching customers:", err);
                setError(err.message || "Failed to load customers");
            } finally {
                setLoading(false);
            }
        };

        fetchCustomers();
    }, []);

    if (loading) {
        return <div className="p-6">Loading customers...</div>;
    }

    if (error) {
        return (
            <div className="p-6 text-red-600">
                There was a problem loading customers: {error}
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Customers</h1>
                {/* Placeholder for “Add Customer” later */}
                {/* <button className="px-3 py-2 rounded bg-slate-900 text-white text-sm">
          Add Customer
        </button> */}
            </div>

            {customers.length === 0 ? (
                <p className="text-sm text-slate-500">
                    No customers found yet. You can start by adding your first customer.
                </p>
            ) : (
                    <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Name
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Phone
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Email
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Open WOs
                </th>
                                    <th className="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((customer) => (
                                    <tr
                                        key={customer._id}
                                        className="border-b border-slate-100 hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {customer.name}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {customer.phone || "—"}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {customer.email || "—"}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {customer.openWorkOrdersCount ?? "—"}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Link
                                                to={`/work-orders?customerId=${customer._id}`}
                                                className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
                                            >
                                                View Work Orders →
                    </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
        </div>
    );
}
