import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchWorkOrder, updateWorkOrderStatus, createInvoiceFromWorkOrder, deleteWorkOrder, updateWorkOrder, } from "../api/workOrders";
import type { WorkOrder, WorkOrderLineItem, } from "../types/workOrder";





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

    const [lineItems, setLineItems] = useState<WorkOrderLineItem[]>([]);
    const [taxRate, setTaxRate] = useState<number>(13);
    const [saving, setSaving] = useState(false);
 


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

    useEffect(() => {
        if (!workOrder) return;
        setLineItems(workOrder.lineItems ?? []);
        setTaxRate(workOrder.taxRate ?? 13);
    }, [workOrder]);

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

    const invoice = await createInvoiceFromWorkOrder(workOrder._id, {
      notes: workOrder.notes ?? undefined,
      // dueDate: "2025-01-30" // optional if you want to set manually later
    });

    console.log("[WO Detail] Invoice created:", invoice);

    const invoiceLabel = invoice.invoiceNumber ?? invoice._id;
    alert(`✅ Invoice #${invoiceLabel} created.`);

    // redirect to invoice detail page
    navigate(`/invoices/${invoice._id}`);
  } catch (err) {
    console.error("[WO Detail] Error creating invoice", err);
    setError("Failed to create invoice.");
  } finally {
    setIsCreatingInvoice(false);
  }
}


  const parseQuantityInput = (raw: string): number => {
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  // Handle "H:MM" format, e.g. "1:15"
  if (trimmed.includes(":")) {
    const [hStr, mStr] = trimmed.split(":");
    const hours = Number(hStr) || 0;
    const minutes = Number(mStr) || 0;
    return hours + minutes / 60;
  }

  // Fallback to simple decimal, e.g. "1.5"
  return Number(trimmed) || 0;
  };
  
    const handleLineItemChange = (
  index: number,
  field: keyof WorkOrderLineItem | "rawQuantity" | "rawUnitPrice",
  value: string
) => {
  setLineItems((prev) => {
    const next = [...prev];
    const item = { ...next[index] };

    if (field === "rawQuantity") {
      // Store what the user typed (e.g. "1:25")
      item.rawQuantity = value;
      // Parse to a decimal number for math
      item.quantity = parseQuantityInput(value);
    } else if (field === "rawUnitPrice") {
      // Store what the user typed (e.g. "120.50")
      item.rawUnitPrice = value;
      // Strip non-numeric stuff except dot, then parse
      const cleaned = value.replace(/[^0-9.]/g, "");
      item.unitPrice = Number(cleaned) || 0;
    } else if (field === "type") {
      item.type = value as WorkOrderLineItem["type"];
    } else if (field === "description") {
      item.description = value;
    } else {
      // fallback for any other fields
      (item as any)[field] = value;
    }

    const qty = item.quantity ?? 0;
    const price = item.unitPrice ?? 0;
    item.lineTotal = qty * price;

    next[index] = item;
    return next;
  });
};


    
    const handleAddLineItem = () => {
  setLineItems((prev) => [
    ...prev,
    {
      type: "labour",              // default
      description: "",
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0,
    },
  ]);
};

const handleRemoveLineItem = (index: number) => {
  setLineItems((prev) => prev.filter((_, i) => i !== index));
};

    const normalizedLineItems = Array.isArray(lineItems)
        ? lineItems.map((item) => {
              const quantity = Number(item?.quantity) || 0;
              const unitPrice = Number(item?.unitPrice) || 0;
              const lineTotal =
                  typeof item?.lineTotal === "number"
                      ? item.lineTotal
                      : quantity * unitPrice;
              return {
                  ...item,
                  type: item?.type ?? "labour",
                  description: item?.description ?? "",
                  rawQuantity:
                      item?.rawQuantity ??
                      (item?.quantity !== undefined && item?.quantity !== null
                          ? String(item.quantity)
                          : ""),
                  rawUnitPrice:
                      item?.rawUnitPrice ??
                      (item?.unitPrice !== undefined && item?.unitPrice !== null
                          ? String(item.unitPrice)
                          : ""),
                  quantity,
                  unitPrice,
                  lineTotal,
              };
          })
        : [];

    const computedSubtotal = normalizedLineItems.reduce(
        (sum, item) => sum + (item.lineTotal || 0),
        0
    );
    const taxRateToUse =
        typeof taxRate === "number" && !Number.isNaN(taxRate)
            ? taxRate
            : 13;
    const computedTaxAmount = computedSubtotal * (taxRateToUse / 100);
    const computedTotal = computedSubtotal + computedTaxAmount;

    const effectiveSubtotal =
        typeof workOrder?.subtotal === "number"
            ? workOrder.subtotal
            : computedSubtotal;

    const effectiveTaxAmount =
        typeof workOrder?.taxAmount === "number"
            ? workOrder.taxAmount
            : computedTaxAmount;

    const effectiveTotal =
        typeof workOrder?.total === "number"
            ? workOrder.total
            : computedTotal;


const handleSaveLineItems = async () => {
  if (!workOrder?._id) return;
  setSaving(true);
  try {
    const payloadLineItems = normalizedLineItems.map(
      ({ rawQuantity, rawUnitPrice, ...rest }) => rest
    );

    // 1) Save to backend
    await updateWorkOrder(workOrder._id, {
      lineItems: payloadLineItems,
      taxRate: taxRateToUse,
    });

    // 2) Reload the full work order (with customer populated, etc.)
    await loadWorkOrder();

    alert("✅ Line items saved.");
  } catch (err) {
    console.error(err);
    alert("❌ Failed to save line items.");
  } finally {
    setSaving(false);
  }
};


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
      const isInvoiced = workOrder.status === "invoiced";
      const hasInvoice = !!workOrder.invoiceId;

      const canCreateInvoice =
        INVOICE_ENABLED &&
        isCompleted &&
        !hasInvoice &&
        !isCreatingInvoice;


    console.log("[WO Detail] workOrder object:", workOrder);

    const formattedDate = workOrder.date
        ? new Date(workOrder.date).toLocaleDateString()
        : "";

    // ⬅ from here down, keep your existing JSX, but use:
    // - {displayName} wherever Name should show
    // - customer?.phone / customer?.email / customer?.address
    
    // in the Customer Information section
  
  
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

                    <p><strong>Total:</strong> ${effectiveTotal.toFixed(2)}</p>


                </div>
            </section>

        

{/* LINE ITEMS SECTION */}
        <section style={{ marginTop: "32px", padding: "50px"  }}>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "12px",
 
    }}
  >
    <h3 style={{ margin: 0 }}>Line Items</h3>

    <button
      type="button"
      onClick={handleAddLineItem}
      style={{
         padding: "6px 12px ",
         borderRadius: "4px",
         border: "1px solid #111827",
         backgroundColor: "#111827",
         color: "#ffffff",          // <- force white text
         fontSize: "0.85rem",
         cursor: "pointer",
      }}
    >
      + Add Line
    </button>
  </div>

  <div style={{ overflowX: "auto" }}>
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "0.9rem",
      }}
    >
      <thead>
        <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
          <th
            style={{
    textAlign: "left",
    padding: "8px 25px",
    fontWeight: 600,
        }}
          >
            Type
          </th>
          <th
            style={{
              textAlign: "left",
              padding: "8px 8px 8px 0px",
              fontWeight: 600,
            }}
          >
            Description
          </th>
          <th
            style={{
              textAlign: "right",
              padding: "8px",
              fontWeight: 600,
            }}
          >
            Qty / Hours
          </th>
          <th
            style={{
              textAlign: "right",
              padding: "8px",
              fontWeight: 600,
            }}
          >
            Unit Price
          </th>
          <th
            style={{
              textAlign: "right",
              padding: "8px",
              fontWeight: 600,
            }}
          >
            Line Total
          </th>
          <th style={{ padding: "8px", width: "1%" }} />
        </tr>
      </thead>
      <tbody>
        {normalizedLineItems.length === 0 && (
          <tr>
            <td
              colSpan={6}
              style={{
                padding: "12px 12px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              No line items yet. Click &ldquo;Add Line&rdquo; to get started.
            </td>
          </tr>
        )}

        {normalizedLineItems.map((item, index) => (
          <tr key={index} style={{ borderTop: "1px solid #f3f4f6" }}>
            {/* Type */}
            <td style={{ padding: "8px 8px 8px 0" }}>
              <select
                value={item.type}
                onChange={(e) =>
                  handleLineItemChange(index, "type", e.target.value)
                }
                style={{
                  border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    marginLeft: "25px",
                  padding: "4px 6px",
                  fontSize: "0.85rem",
                }}
              >
                <option value="labour">Labour</option>
                <option value="part">Part</option>
                <option value="service">Service</option>
              </select>
            </td>

            {/* Description */}
            <td style={{ padding: "8px 8px 8px 0" }}>
              <input
                type="text"
                value={item.description}
                onChange={(e) =>
                  handleLineItemChange(index, "description", e.target.value)
                }
                placeholder={
                  item.type === "labour"
                    ? "e.g. Brake inspection"
                    : "e.g. Brake pads"
                }
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "0.85rem",
                }}
              />
            </td>

            {/* Quantity */}
            <td style={{ padding: "8px", textAlign: "right" }}>
             <input
                    type="text"
                    value={item.rawQuantity ?? ""}
                    onChange={(e) =>
                      handleLineItemChange(index, "rawQuantity", e.target.value)
                    }
                    style={{
                      width: "80px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      textAlign: "right",
                    }}
                    placeholder={item.type === "labour" ? "e.g. 1:25" : "Qty"}
                  />




            </td>

            {/* Unit Price */}
            <td style={{ padding: "8px", textAlign: "right" }}>
              <input
                      type="text"
                      value={item.rawUnitPrice ?? ""}
                      onChange={(e) =>
                        handleLineItemChange(index, "rawUnitPrice", e.target.value)
                      }
                      style={{
                        width: "100px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "0.85rem",
                        textAlign: "right",
                      }}
                      placeholder="$0.00"
                    />


            </td>

            {/* Line Total */}
            <td style={{ padding: "8px", textAlign: "right" }}>
              {item.lineTotal.toFixed(2)} 
            
            </td>

            {/* Remove */}
            <td style={{ padding: "8px", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => handleRemoveLineItem(index)}
                style={{
                  border: "none",
                  background: "none",
                  color: "#dc2626",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Totals block */}
  <div
    style={{
      marginTop: "16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "4px",
      fontSize: "0.9rem",
    }}
  >
    <div style={{ display: "flex", gap: "12px" }}>
      <span style={{ fontWeight: 600 }}>Subtotal:</span>
              <span>${effectiveSubtotal.toFixed(2)}</span>
    </div>

    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <span style={{ fontWeight: 600 }}>Tax Rate:</span>
      <input
        type="number"
        min={0}
        step="0.1"
        value={taxRate}
        onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
        style={{
          width: "80px",
          border: "1px solid #d1d5db",
          borderRadius: "4px",
          padding: "4px 8px",
          fontSize: "0.85rem",
          textAlign: "right",
        }}
      />
      <span>%</span>
    </div>

    <div style={{ display: "flex", gap: "12px" }}>
      <span style={{ fontWeight: 600 }}>Tax Amount:</span>
      <span>${effectiveTaxAmount.toFixed(2)}</span>
    </div>

    <div
      style={{
        display: "flex",
        gap: "12px",
        fontWeight: 700,
        fontSize: "1rem",
        marginTop: "4px",
      }}
    >
      <span>Total:</span>
      <span>${effectiveTotal.toFixed(2)}</span>
    </div>
  </div>

  <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
    <button
      type="button"
      onClick={handleSaveLineItems}
      disabled={saving}
      style={{
        padding: "8px 16px",
        borderRadius: "4px",
        border: "1px solid #4b5563",
        backgroundColor: saving ? "#e5e7eb" : "#111827",
        color: saving ? "#6b7280" : "#ffffff",
        fontSize: "0.9rem",
        cursor: saving ? "default" : "pointer",
      }}
    >
      {saving ? "Saving..." : "Save Line Items"}
    </button>
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
    {/* Edit always available */}
    <button type="button" onClick={handleEdit}>
      Edit
    </button>

    {/* Only show Mark Complete if not completed or invoiced */}
    {!isCompleted && !isInvoiced && (
      <button
        type="button"
        onClick={handleMarkComplete}
        disabled={isMarkingComplete}
      >
        {isMarkingComplete ? "Marking…" : "Mark Complete"}
      </button>
    )}

    {/* Invoice-related button */}
    {INVOICE_ENABLED && (
      <>
        {/* CASE 1: Invoiced AND we know the invoiceId → show View Invoice */}
        {isInvoiced && workOrder.invoiceId ? (
          <button
            type="button"
            onClick={() => navigate(`/invoices/${workOrder.invoiceId}`)}
            title="View the invoice for this work order."
          >
            View Invoice
          </button>
        ) : /* CASE 2: Invoiced but no invoiceId (older data) → show disabled status */
        isInvoiced && !workOrder.invoiceId ? (
          <button
            type="button"
            disabled
            title="An invoice already exists for this work order."
          >
            Invoice Created
          </button>
        ) : (
          /* CASE 3: Only show Create Invoice when completed and no invoice */
          isCompleted && !hasInvoice && (
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={!canCreateInvoice}
              title={
                !isCompleted
                  ? "Complete the work order before creating an invoice."
                  : "Create an invoice for this work order."
              }
            >
              {isCreatingInvoice ? "Creating Invoice…" : "Create Invoice"}
            </button>
          )
        )}
      </>
    )}

    {/* Delete with inline confirmation (unchanged) */}
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
