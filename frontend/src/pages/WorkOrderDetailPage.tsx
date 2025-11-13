import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    getWorkOrderById,
    markWorkOrderComplete,
    createInvoiceForWorkOrder,

} from "../types/api";
import type { WorkOrder } from "../types/workOrder";

export const INVOICE_ENABLED =
    import.meta.env.VITE_INVOICE_ENABLED === "true";

export default function WorkOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const customer = (workOrder as any)?.customerId;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

    // 🔁 Shared loader so we can call it from useEffect AND after Mark Complete
    async function loadWorkOrder() {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const data = await getWorkOrderById(id);
            console.log("[WO Detail] Loaded work order:", data);
            setWorkOrder(data);
        } catch (err) {
            console.error("[WO Detail] Failed to load work order", err);
            setError("Failed to load work order.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadWorkOrder();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // ✏️ Edit button (this you already have working)
    function handleEdit() {
        if (!workOrder) return;
        navigate(`/work-orders/${workOrder._id}/edit`);
    }

    // ✅ Mark Complete
    async function handleMarkComplete() {
        if (!workOrder || !workOrder._id) return;
        try {
            setIsMarkingComplete(true);
            setError(null);

            console.log("[WO Detail] Marking complete for:", workOrder._id);
            const updated = await markWorkOrderComplete(workOrder._id);

            // Option A: trust the API to return the updated work order
            if (updated && updated.status) {
                console.log("[WO Detail] Updated from API:", updated);
                setWorkOrder(updated);
            } else {
                // Option B: be super-safe and reload from backend
                await loadWorkOrder();
            }

            alert("✅ Work order marked complete!");
        } catch (err) {
            console.error("[WO Detail] Error marking complete", err);
            setError("Failed to mark work order complete.");
            alert("❌ Failed to mark work order complete.");
        } finally {
            setIsMarkingComplete(false);
        }
    }

    // 💸 Create Invoice (feature-flagged)
    async function handleCreateInvoice() {
        if (!workOrder || !workOrder._id) return;
        try {
            setIsCreatingInvoice(true);
            setError(null);

            console.log("[WO Detail] Creating invoice for:", workOrder._id);
            const invoice = await createInvoiceForWorkOrder(workOrder._id);
            console.log("[WO Detail] Invoice created:", invoice);

            alert(`✅ Invoice #${invoice.invoiceNumber} created for ${workOrder.customer?.name}.`);
            // optional: navigate(`/invoices/${invoice._id}`);
        } catch (err) {
            console.error("[WO Detail] Error creating invoice", err);
            setError("Failed to create invoice.");
            alert("❌ Failed to create invoice.");
        } finally {
            setIsCreatingInvoice(false);
        }
    }

    if (loading) return <p>Loading work order…</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (!workOrder) return <p>Work order not found.</p>;

    const isCompleted = workOrder.status === "completed";
    const canCreateInvoice =
        INVOICE_ENABLED && isCompleted && !isCreatingInvoice;
    
    console.log("[WO Detail] workOrder object:", workOrder);


    return (
        <div className="page">
            <header className="page-header">
                <h1>Work Order Detail</h1>
                <p>
                    <strong>Status:</strong> {workOrder.status}
                </p>
            </header>

            <section className="page-body">
                <p>
                    <strong>Customer:</strong> {customer?.name}
                </p>
                <p>
                    <strong>Phone:</strong> {customer?.phone}
                </p>
                <p>
                    <strong>Email:</strong> {customer?.email}
                </p>
                <p>
                    <strong>Address:</strong> {customer?.address}
                </p>

                <p>
                    <strong>Date:</strong>{" "}
                    {workOrder.date ? new Date(workOrder.date).toLocaleDateString() : ""}
                </p>
                <p>
                    <strong>Odometer:</strong>{" "}
                    {workOrder.odometer != null
                        ? workOrder.odometer.toLocaleString()
                        : ""}
                </p>

                <p>
                    <strong>Complaint:</strong> {workOrder.complaint}
                </p>
                <p>
                    <strong>Diagnosis:</strong> {workOrder.diagnosis || "—"}
                </p>
                <p>
                    <strong>Notes:</strong> {workOrder.notes || "—"}
                </p>

                <p>
                    <strong>Total:</strong>{" "}
                    {workOrder.total != null ? `$${workOrder.total.toFixed(2)}` : ""}
                </p>
            </section>


            <footer className="page-actions">
                <button type="button" onClick={handleEdit}>
                    Edit
        </button>

                <button
                    type="button"
                    onClick={handleMarkComplete}
                    disabled={isMarkingComplete || isCompleted}
                >
                    {isCompleted
                        ? "Completed"
                        : isMarkingComplete
                            ? "Marking…"
                            : "Mark Complete"}
                </button>

                <button
                    type="button"
                    onClick={handleCreateInvoice}
                    disabled={!canCreateInvoice}
                    title={
                        INVOICE_ENABLED
                            ? isCompleted
                                ? "Create invoice for this work order"
                                : "Complete the work order before invoicing"
                            : "Invoice feature is disabled"
                    }
                >
                    {INVOICE_ENABLED ? "Create Invoice" : "Invoice (Disabled)"}
                </button>
            </footer>
        </div>
    );
}
