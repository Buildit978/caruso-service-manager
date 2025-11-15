// frontend/src/pages/CustomersPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Customer = {
    _id: string;
    firstName: string;
    lastName: string;
    fullName?: string; // from Mongoose virtual
    phone?: string;
    email?: string;
    openWorkOrdersCount?: number;
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);

            const [custRes, woRes] = await Promise.all([
                fetch("http://localhost:4000/api/customers"),
                fetch("http://localhost:4000/api/work-orders"),
            ]);

            const customersData = await custRes.json();
            const workOrdersData = await woRes.json();

            // build lookup count per customer
            const counts: Record<string, number> = {};

            workOrdersData.forEach((wo: any) => {
                if (!wo.customerId) return;
                const id =
                    typeof wo.customerId === "string" ? wo.customerId : wo.customerId._id;
                if (!counts[id]) counts[id] = 0;
                if (wo.status === "open" || wo.status === "in_progress") {
                    counts[id] += 1;
                }
            });

            // attach count to each customer
            const customersWithCounts = customersData.map((c: any) => ({
                ...c,
                openWorkOrdersCount: counts[c._id] ?? 0,
            }));

            setCustomers(customersWithCounts);
            setLoading(false);
        };

        load();
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

    const formatName = (customer: Customer) =>
        customer.fullName ||
        `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
        "(No name)";

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Customers</h1>

                <Link
                    to="/customers/new?returnTo=/customers"
                    className="px-3 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800"
                >
                    Add Customer
        </Link>
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
                                            {formatName(customer)}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {customer.phone || "—"}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {customer.email || "—"}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {customer.openWorkOrdersCount}
                                        </td>

                                        <td className="px-4 py-2 text-right space-x-3">
                                            <Link
                                                to={`/work-orders?customerId=${customer._id}`}
                                                className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
                                            >
                                                View Work Orders →
                    </Link>
                                            {/* Optional: quick edit link */}
                                            {/* <Link
                      to={`/customers/${customer._id}/edit?returnTo=/customers`}
                      className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-800"
                    >
                      Edit
                    </Link> */}
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
