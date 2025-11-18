import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    fetchWorkOrder,
    updateWorkOrderStatus,
    createInvoiceFromWorkOrder,
    deleteWorkOrder,
} from "../api/workOrders";
import type { WorkOrder } from "../types/workOrder";

export const INVOICE_ENABLED =
    import.meta.env.VITE_INVOICE_ENABLED === "true";

export default function WorkOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // 🔁 Shared loader so we can call it from useEffect AND after Mark Complete
    async function loadWorkOrder() {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);
            const data = await fetchWorkOrder(id);
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

    // Derive customer + display name from the loaded work order
    const customer =
        (workOrder as any)?.customerId ??
        (workOrder as any)?.customer ??
        null;

    const displayName =
        customer?.name ||                             // 👈 FIRST
        customer?.fullName ||
        `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
        "(No name)";


    // ✏️ Edit button
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
            const updated = await updateWorkOrderStatus(workOrder._id, "completed");

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
            const invoice = await createInvoiceFromWorkOrder(workOrder._id);
            console.log("[WO Detail] Invoice created:", invoice);

            const invoiceLabel = invoice.invoiceNumber ?? invoice.invoiceId ?? "new";
            console.log(`✅ Invoice #${invoiceLabel} created for ${displayName}.`);
            // optional: navigate(`/invoices/${invoice._id}`);
        } catch (err) {
            console.error("[WO Detail] Error creating invoice", err);
            setError("Failed to create invoice.");
        } finally {
            setIsCreatingInvoice(false);
        }
    }

    async function handleDelete() {
        if (!workOrder?._id) return;
        setShowDeleteConfirm(true);
        setDeleteError(null);
    }

    async function confirmDelete() {
        if (!workOrder?._id) return;
        try {
            setIsDeleting(true);
            setDeleteError(null);
            await deleteWorkOrder(workOrder._id);
            navigate("/work-orders");
        } catch (err) {
            console.error("[WO Detail] Error deleting work order", err);
            setDeleteError("Could not delete this work order. Please try again.");
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
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

    // ⬅ from here down, keep your existing JSX, but use:
    // - {displayName} wherever Name should show
    // - customer?.phone / customer?.email / customer?.address
    // in the Customer Information section.


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

                    <p><strong>Name:</strong> {displayName}</p>
                    <p><strong>Phone:</strong> {customer?.phone || "—"}</p>
                    <p><strong>Email:</strong> {customer?.email || "—"}</p>
                    <p><strong>Address:</strong> {customer?.address || "—"}</p>
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

                    {workOrder.vehicle && (
                        <section style={{ marginTop: "1.5rem" }}>
                            <h3 style={{ marginBottom: "0.5rem" }}>Vehicle</h3>

                            <p>
                                {workOrder.vehicle.year && `${workOrder.vehicle.year} `}
                                {workOrder.vehicle.make} {workOrder.vehicle.model}
                            </p>

                            {workOrder.vehicle.licensePlate && (
                                <p>Plate: {workOrder.vehicle.licensePlate}</p>
                            )}
                            {workOrder.vehicle.vin && <p>VIN: {workOrder.vehicle.vin}</p>}
                            {workOrder.vehicle.color && <p>Color: {workOrder.vehicle.color}</p>}
                            {workOrder.vehicle.notes && <p>Notes: {workOrder.vehicle.notes}</p>}
                        </section>
                    )}

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

                    {/* Delete with inline confirmation */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {!showDeleteConfirm ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    style={{ border: "1px solid #b91c1c", color: "#b91c1c" }}
                                >
                                    Delete Work Order
                                </button>
                            ) : (
                                <>
                                    <span style={{ color: "#b91c1c", fontSize: "0.9rem" }}>
                                        Are you sure you want to delete this work order?
                                    </span>
                                    <button
                                        type="button"
                                        onClick={confirmDelete}
                                        disabled={isDeleting}
                                        style={{
                                            border: "1px solid #b91c1c",
                                            color: "#b91c1c",
                                            background: "transparent",
                                            padding: "6px 10px",
                                            borderRadius: "6px",
                                        }}
                                    >
                                        {isDeleting ? "Deleting…" : "Yes, delete"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeleteError(null);
                                        }}
                                        style={{
                                            border: "1px solid #475569",
                                            color: "#e5e7eb",
                                            background: "transparent",
                                            padding: "6px 10px",
                                            borderRadius: "6px",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                        {deleteError && (
                            <div style={{ color: "#ef4444", fontSize: "0.9rem" }}>{deleteError}</div>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );

}
