// src/pages/WorkOrdersPage.tsx
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";

type WorkOrderStatus = "open" | "in_progress" | "completed" | "invoiced";

type Customer = {
    _id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    phone?: string;
    email?: string;
};

type WorkOrder = {
    _id: string;
    status: WorkOrderStatus;
    total?: number;
    createdAt: string;
    date?: string;
    odometer?: number;
    complaint?: string;
    notes?: string;
    customer?: Customer;
    customerId?: Customer | string;
};

function useQuery() {
    const { search } = useLocation();
    return new URLSearchParams(search);
}

export default function WorkOrdersPage() {
    const query = useQuery();
    const customerId = query.get("customerId");

    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Helper: format customer name safely
    const formatCustomerName = (customer?: Customer) => {
        if (!customer) return "—";
        return (
            customer.name ||                                 // 👈 prefer this
            customer.fullName ||
            `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
            "(No name)"
        );
    };

    useEffect(() => {
        const fetchWorkOrders = async () => {
            try {
                setLoading(true);
                setError(null);

                const url = new URL("http://localhost:4000/api/work-orders");
                if (customerId) {
                    url.searchParams.set("customerId", customerId);
                }

                const res = await fetch(url.toString());
                if (!res.ok) {
                    throw new Error(`Request failed with status ${res.status}`);
                }

                const raw = await res.json();

                // Normalize customer field so we can always use wo.customer
                const normalized: WorkOrder[] = raw.map((wo: any) => ({
                    ...wo,
                    customer:
                        wo.customer ??
                        (typeof wo.customerId === "object" ? wo.customerId : undefined),
                }));

                setWorkOrders(normalized);
            } catch (err: any) {
                console.error("Error fetching work orders:", err);
                setError(err.message || "Failed to load work orders");
            } finally {
                setLoading(false);
            }
        };

        fetchWorkOrders();
    }, [customerId]);

    const title = customerId
        ? "Work Orders for Selected Customer"
        : "All Work Orders";

    if (loading) {
        return <div className="p-6">Loading work orders...</div>;
    }

    if (error) {
        return (
            <div className="p-6 text-red-600">
                There was a problem loading work orders: {error}
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Title + New Work Order button */}
            <div
                className="mb-4"
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                }}
            >
                <h1 className="text-2xl font-semibold">{title}</h1>

                <Link
                    to="/work-orders/new"
                    className="inline-block font-medium text-sm px-4 py-2 rounded"
                    style={{
                        backgroundColor: "#2563eb",
                        color: "white",
                        display: "inline-block",
                        whiteSpace: "nowrap",
                    }}
                >
                    + New Work Order
        </Link>
            </div>

            <div className="mt-6"></div>
            {workOrders.length === 0 ? (
                <p className="text-sm text-slate-500">
                    {customerId
                        ? "No work orders found for this customer yet."
                        : "No work orders found yet."}
                </p>
            ) : (
                    <div className="overflow-x-auto bg-white shadow-sm rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        ID
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Customer
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        View
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Status
                </th>
                                    <th className="text-right px-4 py-2 font-medium text-slate-600">
                                        Total
                </th>
                                    <th className="text-left px-4 py-2 font-medium text-slate-600">
                                        Created
                </th>
                                </tr>
                            </thead>

                            <tbody>
                                {workOrders.map((wo) => (
                                    <tr
                                        key={wo._id}
                                        className="border-b border-slate-100 hover:bg-slate-50"
                                    >
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500 font-mono">
                                            {wo._id}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {formatCustomerName(wo.customer)}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <Link
                                                to={`/work-orders/${wo._id}`}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                View
                    </Link>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    wo.status === "completed"
                                                        ? "bg-green-100 text-green-700"
                                                        : wo.status === "in_progress"
                                                            ? "bg-yellow-100 text-yellow-700"
                                                            : wo.status === "invoiced"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : "bg-blue-100 text-blue-700"
                                                    }`}
                                            >
                                                {wo.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                            {(wo.total ?? 0).toLocaleString("en-CA", {
                                                style: "currency",
                                                currency: "CAD",
                                            })}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                                            {new Date(wo.createdAt).toLocaleDateString("en-CA")}
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
