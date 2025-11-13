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

    const formattedDate = workOrder.date
        ? new Date(workOrder.date).toLocaleDateString()
        : "";

    return (
        <div className="page" style={{ padding: "16px" }}>
            {/* HEADER */}
            <header
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    marginBottom: "16px",
                }}
            >
                <h1 style={{ margin: 0 }}>Work Order Detail</h1>

                <p
                    style={{
                        margin: 0,
                        fontSize: "0.9rem",
                        color: "#555",
                    }}
                >
                    Work Order #{workOrder._id.slice(-6)}
                    {formattedDate && <> • {formattedDate}</>}
                </p>
            </header>

            {/* TWO-COLUMN MAIN SECTION */}
            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                    marginTop: "20px",
                }}
            >
                {/* LEFT COLUMN — CUSTOMER INFORMATION */}
                <div>
                    <h2 style={{ marginBottom: "8px" }}>Customer Information</h2>

                    <p><strong>Name:</strong> {customer?.name}</p>
                    <p><strong>Phone:</strong> {customer?.phone}</p>
                    <p><strong>Email:</strong> {customer?.email}</p>
                    <p><strong>Address:</strong> {customer?.address}</p>
                </div>

                {/* RIGHT COLUMN — WORK ORDER DETAILS */}
                <div>
                    {/* Work Order Details Header + COMPLETE Badge */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "50px",        // distance between title and COMPLETE
                            marginBottom: "8px",
                        }}
                    >

                
                        <h2 style={{ margin: 0 }}>Work Order Details</h2>

                        <span
                            style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontWeight: 600,
                                backgroundColor:
                                    workOrder.status === "completed" ? "#ffffff" : "#f9731622",
                                color:
                                    workOrder.status === "completed" ? "#059669" : "#9a3412",
                                border:
                                    workOrder.status === "completed"
                                        ? "1px solid #05966933"
                                        : "1px solid transparent",
                                marginLeft: "12px",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {workOrder.status.toUpperCase()}
                        </span>
                    </div>

                    <p>
                        <strong>Date:</strong>{" "}
                        {formattedDate}
                    </p>
                    <p><strong>Odometer:</strong> {workOrder.odometer?.toLocaleString()}</p>
                    <p><strong>Complaint:</strong> {workOrder.complaint}</p>
                    <p><strong>Diagnosis:</strong> {workOrder.diagnosis || "—"}</p>
                    <p><strong>Notes:</strong> {workOrder.notes || "—"}</p>
                    <p><strong>Total:</strong> ${workOrder.total?.toFixed(2)}</p>
                </div>
            </section>

            {/* FOOTER BUTTONS */}
            <footer
                style={{
                    marginTop: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                }}
            >
                {/* Back Link */}
                <button
                    type="button"
                    onClick={() => navigate("/work-orders")}
                    style={{ alignSelf: "flex-start" }}
                >
                    ← Back to Work Orders
      </button>

                {/* Action Buttons Row */}
                <div
                    style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                    }}
                >
                    <button type="button" onClick={handleEdit}>
                        Edit
        </button>

                    {!isCompleted && (
                        <button
                            type="button"
                            onClick={handleMarkComplete}
                            disabled={isMarkingComplete}
                        >
                            {isMarkingComplete ? "Marking…" : "Mark Complete"}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleCreateInvoice}
                        disabled={!canCreateInvoice}
                        title={
                            !INVOICE_ENABLED
                                ? "Invoice feature is disabled"
                                : !isCompleted
                                    ? "Complete the work order before invoicing"
                                    : "Create invoice for this work order"
                        }
                    >
                        {INVOICE_ENABLED ? "Create Invoice" : "Invoice (Disabled)"}
                    </button>
                </div>
            </footer>
        </div>
    );

}
