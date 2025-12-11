// src/pages/WorkOrderDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchWorkOrder,
  createInvoiceFromWorkOrder,
  deleteWorkOrder,
  updateWorkOrder,
  updateWorkOrderStatus,
} from "../api/workOrders";
import type { WorkOrder, WorkOrderLineItem } from "../types/workOrder";

const markWorkOrderComplete = (id: string) =>
  updateWorkOrderStatus(id, "completed");

export const INVOICE_ENABLED =
  import.meta.env.VITE_INVOICE_ENABLED === "true";

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<WorkOrderLineItem[]>([]);
  const [taxRate, setTaxRate] = useState<number>(13);
  const [saving, setSaving] = useState(false);

  // 🔁 Shared loader so we can call it from useEffect AND after save
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
    customer?.name ||
    customer?.fullName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "(No name)";

  // ✏️ Edit button
  function handleEdit() {
    if (!workOrder) return;
    navigate(`/work-orders/${workOrder._id}/edit`);
  }

  // ✅ Mark Complete (status)
  async function handleMarkComplete() {
    if (!workOrder || !workOrder._id) return;

    try {
      setIsMarkingComplete(true);
      setActionError(null);

      console.log("[WO Detail] Marking complete:", workOrder._id);
      const updated = await markWorkOrderComplete(workOrder._id);

      setWorkOrder(updated);
      alert("✅ Work order marked complete!");
    } catch (err: any) {
      console.error("[WO Detail] Failed to mark complete", err);
      setActionError(err.message || "Could not mark work order complete.");
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

  // 🔢 Helpers for line items
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
        item.rawQuantity = value;
        item.quantity = parseQuantityInput(value);
      } else if (field === "rawUnitPrice") {
        item.rawUnitPrice = value;
        const cleaned = value.replace(/[^0-9.]/g, "");
        item.unitPrice = Number(cleaned) || 0;
      } else if (field === "type") {
        item.type = value as WorkOrderLineItem["type"];
      } else if (field === "description") {
        item.description = value;
      } else {
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
        type: "labour",
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
    typeof taxRate === "number" && !Number.isNaN(taxRate) ? taxRate : 13;
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

      await updateWorkOrder(workOrder._id, {
        lineItems: payloadLineItems,
        taxRate: taxRateToUse,
      } as any);

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

    const rawStatus = (workOrder.status || "").toLowerCase();

const isCompleted =
  rawStatus === "completed" || rawStatus === "complete";
const isInvoiced = rawStatus === "invoiced";
const hasInvoice = !!workOrder.invoiceId;

let statusLabel = "OPEN";
let statusBg = "#fee2e2";
let statusBorder = "#b91c1c";
let statusColor = "#b91c1c";

if (isInvoiced) {
  statusLabel = "INVOICED";
  statusBg = "#dbeafe";
  statusBorder = "#1d4ed8";
  statusColor = "#1d4ed8";
} else if (isCompleted) {
  statusLabel = "COMPLETED";
  statusBg = "#dcfce7";
  statusBorder = "#16a34a";
  statusColor = "#166534";
}
 
  const canCreateInvoice =
    INVOICE_ENABLED && isCompleted && !hasInvoice && !isCreatingInvoice;

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

      {/* Optional UI-level error for actions like Mark Complete */}
      {actionError && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#7f1d1d",
            fontSize: "0.9rem",
          }}
        >
          {actionError}
        </div>
      )}

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

          <p>
            <strong>Name:</strong> {displayName}
          </p>
          <p>
            <strong>Phone:</strong> {customer?.phone || "—"}
          </p>
          <p>
            <strong>Email:</strong> {customer?.email || "—"}
          </p>
          <p>
            <strong>Address:</strong> {customer?.address || "—"}
          </p>
        </div>

        {/* RIGHT COLUMN — WORK ORDER DETAILS */}
        <div>
          {/* Work Order Details Header + COMPLETE Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              gap: "1rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Work Order Details
            </h2>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              {/* Status pill */}
              <span
          style={{
            padding: "0.35rem 0.85rem",
            borderRadius: "999px",
            border: `2px solid ${statusBorder}`,
            background: statusBg,
            color: statusColor,
            fontSize: "0.85rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            whiteSpace: "nowrap",
            boxShadow: "0 0 6px rgba(0,0,0,0.25)",
          }}
        >
          {statusLabel}
        </span>


              {/* COMPLETE button – only if not already done */}
              {!isCompleted && !isInvoiced && (
                <button
                  type="button"
                  onClick={handleMarkComplete}
                  disabled={isMarkingComplete}
                  style={{
                    padding: "0.4rem 0.9rem",
                    borderRadius: "999px",
                    border: "1px solid #16a34a",
                    background: "#ffffff",
                    color: "#16a34a",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: isMarkingComplete ? "default" : "pointer",
                    opacity: isMarkingComplete ? 0.7 : 1,
                  }}
                >
                  {isMarkingComplete ? "..." : "COMPLETE"}
                </button>
              )}
            </div>
          </div>

          <p>
            <strong>Date:</strong> {formattedDate}
          </p>
          <p>
            <strong>Odometer:</strong>{" "}
            {workOrder.odometer?.toLocaleString() ?? "—"}
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
              {workOrder.vehicle.vin && (
                <p>VIN: {workOrder.vehicle.vin}</p>
              )}
              {workOrder.vehicle.color && (
                <p>Color: {workOrder.vehicle.color}</p>
              )}
              {workOrder.vehicle.notes && (
                <p>Notes: {workOrder.vehicle.notes}</p>
              )}
            </section>
          )}

          <p>
            <strong>Total:</strong> ${effectiveTotal.toFixed(2)}
          </p>
        </div>
      </section>

      {/* LINE ITEMS SECTION */}
      <section style={{ marginTop: "32px", padding: "50px" }}>
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
              padding: "6px 12px",
              borderRadius: "4px",
              border: "1px solid #111827",
              backgroundColor: "#111827",
              color: "#ffffff",
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
                    No line items yet. Click &ldquo;Add Line&rdquo; to get
                    started.
                  </td>
                </tr>
              )}

              {normalizedLineItems.map((item, index) => (
                <tr
                  key={index}
                  style={{ borderTop: "1px solid #f3f4f6" }}
                >
                  {/* Type */}
                  <td style={{ padding: "8px 8px 8px 0" }}>
                    <select
                      value={item.type}
                      onChange={(e) =>
                        handleLineItemChange(
                          index,
                          "type",
                          e.target.value
                        )
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
                        handleLineItemChange(
                          index,
                          "description",
                          e.target.value
                        )
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
                        handleLineItemChange(
                          index,
                          "rawQuantity",
                          e.target.value
                        )
                      }
                      style={{
                        width: "80px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "0.85rem",
                        textAlign: "right",
                      }}
                      placeholder={
                        item.type === "labour" ? "e.g. 1:25" : "Qty"
                      }
                    />
                  </td>

                  {/* Unit Price */}
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <input
                      type="text"
                      value={item.rawUnitPrice ?? ""}
                      onChange={(e) =>
                        handleLineItemChange(
                          index,
                          "rawUnitPrice",
                          e.target.value
                        )
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

          <div
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <span style={{ fontWeight: 600 }}>Tax Rate:</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={taxRate}
              onChange={(e) =>
                setTaxRate(Number(e.target.value) || 0)
              }
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

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
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

          {/* Invoice-related button */}
          {INVOICE_ENABLED && (
            <>
              {/* CASE 1: Invoiced AND we know the invoiceId → show View Invoice */}
              {isInvoiced && workOrder.invoiceId ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/invoices/${workOrder.invoiceId}`)
                  }
                  title="View the invoice for this work order."
                >
                  View Invoice
                </button>
              ) : isInvoiced && !workOrder.invoiceId ? (
                // CASE 2: Invoiced but no invoiceId (older data)
                <button
                  type="button"
                  disabled
                  title="An invoice already exists for this work order."
                >
                  Invoice Created
                </button>
              ) : (
                // CASE 3: Only show Create Invoice when completed and no invoice
                isCompleted &&
                !hasInvoice && (
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
                    {isCreatingInvoice
                      ? "Creating Invoice…"
                      : "Create Invoice"}
                  </button>
                )
              )}
            </>
          )}

          {/* Delete with inline confirmation */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{
                    border: "1px solid #b91c1c",
                    color: "#b91c1c",
                  }}
                >
                  Delete Work Order
                </button>
              ) : (
                <>
                  <span
                    style={{
                      color: "#b91c1c",
                      fontSize: "0.9rem",
                    }}
                  >
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
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "0.9rem",
                }}
              >
                {deleteError}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
