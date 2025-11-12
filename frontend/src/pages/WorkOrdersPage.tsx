import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createInvoiceFromWorkOrder } from "../api/invoices";

type WorkOrderStatus = "open" | "in-progress" | "completed";

type Customer = {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
};

type WorkOrder = {
    _id: string;
    status: WorkOrderStatus;
    total: number;
    createdAt: string;
    date?: string;
    odometer?: number;
    complaint?: string;
    notes?: string;
    customer?: Customer;
    customerId?: Customer | string;
};

export default function WorkOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creatingInvoice, setCreatingInvoice] = useState(false);

    // ----------------------
    // Load single work order
    // ----------------------
    useEffect(() => {
        if (!id) return;

        const fetchWorkOrder = async () => {
            try {
                setLoading(true);
                setError(null);

                // ⬇️ Match the list endpoint: http://localhost:4000/api/work-orders
                const res = await fetch(
                    `http://localhost:4000/api/work-orders/${id}`
                );

                if (!res.ok) {
                    const text = await res.text();
                    console.error(
                        "Failed to load work order:",
                        res.status,
                        text
                    );
                    throw new Error(
                        `Failed to load work order (status ${res.status})`
                    );
                }

                const raw = await res.json();

                // Normalize customer like in WorkOrdersPage
                const normalized: WorkOrder = {
                    ...raw,
                    customer:
                        raw.customer ??
                        (typeof raw.customerId === "object" ? raw.customerId : undefined),
                };

                setWorkOrder(normalized);
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Error loading work order.");
            } finally {
                setLoading(false);
            }
        };

        fetchWorkOrder();
    }, [id]);

    // ----------------------
    // Navigation
    // ----------------------
    const handleBack = () => {
        navigate("/work-orders");
    };

    // ----------------------
    // Generate Invoice
    // ----------------------
    const handleGenerateInvoice = async () => {
        if (!workOrder?._id) return;

        try {
            setCreatingInvoice(true);

            const invoice = await createInvoiceFromWorkOrder(workOrder._id);

            alert(
                `✅ Invoice #${invoice._id.slice(-6)} created for ${
                workOrder.customer?.name ?? "customer"
                }.`
            );

            navigate(`/invoices/${invoice._id}`);
        } catch (err: any) {
            console.error(err);
            alert(`❌ ${err.message || "Failed to create invoice."}`);
        } finally {
            setCreatingInvoice(false);
        }
    };

    // ----------------------
    // States: loading / error / not found
    // ----------------------
    if (loading) {
        return <div className="p-6">Loading work order…</div>;
    }

    if (error) {
        return (
            <div className="p-6">
                <p className="text-red-600 mb-3">{error}</p>
                <button
                    onClick={handleBack}
                    className="px-3 py-1 border border-slate-400 rounded hover:bg-slate-100"
                >
                    Back to Work Orders
        </button>
            </div>
        );
    }

    if (!workOrder) {
        return (
            <div className="p-6">
                <p className="mb-3">Work order not found.</p>
                <button
                    onClick={handleBack}
                    className="px-3 py-1 border border-slate-400 rounded hover:bg-slate-100"
                >
                    Back to Work Orders
        </button>
            </div>
        );
    }

    // ----------------------
    // MAIN RENDER
    // ----------------------
    return (
        <div className="p-6 max-w-4xl mx-auto flex flex-col gap-4">
            {/* Header + Actions */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Work Order #{workOrder._id}
                    </h1>
                    <p className="text-sm text-slate-500">
                        Status: <span className="capitalize">{workOrder.status}</span>
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleBack}
                        className="px-3 py-1 border border-slate-400 rounded hover:bg-slate-100 text-sm"
                    >
                        Back
          </button>

                    <button
                        onClick={handleGenerateInvoice}
                        disabled={creatingInvoice}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 text-sm"
                    >
                        {creatingInvoice ? "Creating…" : "Generate Invoice"}
                    </button>
                </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <h2 className="text-lg font-medium mb-2">Customer</h2>
                {workOrder.customer ? (
                    <>
                        <p className="font-medium">{workOrder.customer.name}</p>
                        {workOrder.customer.phone && (
                            <p className="text-sm text-slate-600">
                                Phone: {workOrder.customer.phone}
                            </p>
                        )}
                        {workOrder.customer.email && (
                            <p className="text-sm text-slate-600">
                                Email: {workOrder.customer.email}
                            </p>
                        )}
                    </>
                ) : (
                        <p className="text-sm text-slate-500">No customer data available.</p>
                    )}
            </div>

            {/* Work Order Details */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <h2 className="text-lg font-medium mb-2">Work Order Details</h2>

                {workOrder.complaint && (
                    <p className="mb-2">
                        <span className="font-medium">Complaint:</span>{" "}
                        {workOrder.complaint}
                    </p>
                )}

                {workOrder.notes && (
                    <p className="mb-2">
                        <span className="font-medium">Notes:</span> {workOrder.notes}
                    </p>
                )}

                {workOrder.odometer !== undefined && (
                    <p className="mb-2 text-sm text-slate-600">
                        Odometer: {workOrder.odometer} km
                    </p>
                )}

                <p className="mt-2 text-sm text-slate-600">
                    Created:{" "}
                    {new Date(workOrder.createdAt).toLocaleString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </p>

                <p className="mt-2 font-semibold">
                    Total:{" "}
                    {workOrder.total.toLocaleString("en-CA", {
                        style: "currency",
                        currency: "CAD",
                    })}
                </p>
            </div>
        </div>
    );
}
