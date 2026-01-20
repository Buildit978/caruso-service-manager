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
import WorkOrderMessages from "../components/workOrders/WorkOrderMessages";

const markWorkOrderComplete = (id: string) => updateWorkOrderStatus(id, "completed");

export const INVOICE_ENABLED = import.meta.env.VITE_INVOICE_ENABLED === "true";

type TimelineItem = {
  label: string;
  date?: string | Date | null;
  done: boolean;
};

function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TimelineBlock({ items }: { items: TimelineItem[] }) {
  return (
    <div
      style={{
        border: "1px solid #374151",
        borderRadius: 12,
        padding: "12px 14px",
        background: "rgba(17,24,39,0.6)",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af" }}>
        Timeline
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #374151",
              opacity: it.done ? 1 : 0.6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: it.done ? "#10b981" : "#6b7280",
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 600 }}>{it.label}</span>
            </div>

            <span style={{ color: "#cbd5e1", fontSize: 13 }}>{formatDateTime(it.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ✅ Canonical invoice id resolver (truth: if invoice exists, we can view it)
function resolveInvoiceIdFromWorkOrder(wo: any): string | null {
  if (!wo) return null;

  const inv: any = wo?.invoice ?? wo?.invoiceId ?? null;
  if (!inv) return null;

  if (typeof inv === "string") return inv;

  if (typeof inv === "object") {
    if (typeof inv._id === "string") return inv._id;
    if (inv._id && typeof inv._id.toString === "function") return inv._id.toString();
  }

  return null;
}

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [taxRate, setTaxRate] = useState<number>(13);
  const [saving, setSaving] = useState(false);

  // 🔁 Shared loader so we can call it from useEffect AND after save
  async function loadWorkOrder() {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWorkOrder(id);
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

    // Don't overwrite local edits with server data while dirty
    if (!hasUnsavedChanges) {
      setLineItems(workOrder.lineItems ?? []);
      setTaxRate(workOrder.taxRate ?? 13);
    }
  }, [workOrder, hasUnsavedChanges]);

  async function applyStatus(nextStatus: "in_progress" | "on_hold" | "completed" | "invoiced") {
    if (!workOrder?._id) return;

    try {
      setActionError(null);
      await updateWorkOrderStatus(workOrder._id, nextStatus);

      // refresh so timestamps/status are up-to-date
      const refreshed = await fetchWorkOrder(workOrder._id);
      setWorkOrder(refreshed);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Failed to update status");
    }
  }

  const handleStartWork = async () => {
    if (hasUnsavedChanges) {
      const saveThenStart = window.confirm(
        "You have unsaved line items.\n\n" + "Click OK to SAVE and START.\n" + "Click Cancel to stay here."
      );
      if (!saveThenStart) return;
      await handleSaveLineItems();
    }

    await applyStatus("in_progress");
  };

  const handlePauseWork = async () => {
    if (hasUnsavedChanges) {
      const saveThenPause = window.confirm(
        "You have unsaved line items.\n\n" + "Click OK to SAVE and PAUSE.\n" + "Click Cancel to stay here."
      );
      if (!saveThenPause) return;
      await handleSaveLineItems();
    }

    if (hasUnsavedChanges) {
      // discard draft by reloading from backend truth
      await loadWorkOrder();
      setHasUnsavedChanges(false);
    }

    await applyStatus("on_hold");
  };

  // Derive customer + display name from the loaded work order
  const customer = (workOrder as any)?.customerId ?? (workOrder as any)?.customer ?? null;

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

      // COMPLETE
      if (hasUnsavedChanges) {
        await handleSaveLineItems();
      }

      await markWorkOrderComplete(workOrder._id);

      // ✅ reload from backend truth
      await loadWorkOrder();

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

      const result = await createInvoiceFromWorkOrder(workOrder._id, {
        notes: workOrder.notes ?? undefined,
      });

      const invoice = (result as any).invoice ?? result;
      const invoiceLabel = invoice.invoiceNumber ?? invoice._id;

      alert(
        (result as any).alreadyExists
          ? `ℹ️ Invoice #${invoiceLabel} already exists — opening it.`
          : `✅ Invoice #${invoiceLabel} created.`
      );

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
    setHasUnsavedChanges(true);
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        type: "labour",
        description: "",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 1 * 0,
        rawQuantity: "1",
        rawUnitPrice: "0",
      } as any,
    ]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const normalizedLineItems = Array.isArray(lineItems)
    ? lineItems.map((item) => {
        const quantity = Number(item?.quantity) || 0;
        const unitPrice = Number(item?.unitPrice) || 0;
        const lineTotal = typeof item?.lineTotal === "number" ? item.lineTotal : quantity * unitPrice;
        return {
          ...item,
          type: item?.type ?? "labour",
          description: item?.description ?? "",
          rawQuantity:
            item?.rawQuantity ??
            (item?.quantity !== undefined && item?.quantity !== null ? String(item.quantity) : ""),
          rawUnitPrice:
            item?.rawUnitPrice ??
            (item?.unitPrice !== undefined && item?.unitPrice !== null ? String(item.unitPrice) : ""),
          quantity,
          unitPrice,
          lineTotal,
        };
      })
    : [];

  // Live totals
  const computedSubtotal = normalizedLineItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  const taxRateToUse = typeof taxRate === "number" && !Number.isNaN(taxRate) ? taxRate : 13;

  const computedTaxAmount = computedSubtotal * (taxRateToUse / 100);
  const computedTotal = computedSubtotal + computedTaxAmount;

  // Saved totals (from backend)
  const savedSubtotal = typeof workOrder?.subtotal === "number" ? workOrder.subtotal : computedSubtotal;
  const savedTaxAmount = typeof workOrder?.taxAmount === "number" ? workOrder.taxAmount : computedTaxAmount;
  const savedTotal = typeof workOrder?.total === "number" ? workOrder.total : computedTotal;

  // ✅ Display totals:
  // - If user has unsaved changes → show computed (live)
  // - Otherwise → show saved (authoritative)
  const displaySubtotal = hasUnsavedChanges ? computedSubtotal : savedSubtotal;
  const displayTaxAmount = hasUnsavedChanges ? computedTaxAmount : savedTaxAmount;
  const displayTotal = hasUnsavedChanges ? computedTotal : savedTotal;

  const handleSaveLineItems = async () => {
    if (!workOrder?._id) return;
    setSaving(true);
    try {
      const payloadLineItems = normalizedLineItems.map(({ rawQuantity, rawUnitPrice, ...rest }) => rest);

      await updateWorkOrder(workOrder._id, {
        lineItems: payloadLineItems,
        taxRate: taxRateToUse,
      } as any);

      await loadWorkOrder();
      setHasUnsavedChanges(false);

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

  // ----------------------
  // Canonical invoice truth
  // ----------------------
  const resolvedInvoiceId = resolveInvoiceIdFromWorkOrder(workOrder);
  const hasInvoice = !!resolvedInvoiceId;

  // ----------------------
  // Work order status truth (with invoice-safe normalization)
  // ----------------------
  const rawStatus = (workOrder.status || "").toLowerCase().trim();

  const isOpen = rawStatus === "open";
  const isInProgress = rawStatus === "in_progress";
  const isOnHold = rawStatus === "on_hold";
  const isCancelled = rawStatus === "cancelled";
  const isCompleted = rawStatus === "completed" || rawStatus === "complete";

  // ✅ Truth: if invoice exists, treat as invoiced in UI even if status string lags
  const isInvoiced = rawStatus === "invoiced" || hasInvoice;

  // ----------------------
  // Timeline timestamps (safe fallbacks)
  // ----------------------
  const startedAt = (workOrder as any)?.startedAt ?? null;
  const onHoldAt = (workOrder as any)?.pausedAt ?? (workOrder as any)?.onHoldAt ?? null;
  const completedAt = (workOrder as any)?.completedAt ?? null;
  const invoicedAt = (workOrder as any)?.invoicedAt ?? (hasInvoice ? (workOrder as any)?.updatedAt ?? null : null);

  const timelineItems: TimelineItem[] = [
    {
      label: "Started",
      date: startedAt,
      done: !!startedAt || isInProgress || isOnHold || isCompleted || isInvoiced,
    },
    {
      label: "On Hold",
      date: onHoldAt,
      done: !!onHoldAt || isOnHold,
    },
    {
      label: "Completed",
      date: completedAt,
      done: !!completedAt || isCompleted || isInvoiced,
    },
    {
      label: "Invoiced",
      date: invoicedAt,
      done: isInvoiced,
    },
  ];

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
  } else if (isOnHold) {
    statusLabel = "ON HOLD";
    statusBg = "#ffedd5";
    statusBorder = "#c2410c";
    statusColor = "#9a3412";
  } else if (isInProgress) {
    statusLabel = "IN PROGRESS";
    statusBg = "#fef9c3";
    statusBorder = "#a16207";
    statusColor = "#854d0e";
  } else if (isCancelled) {
    statusLabel = "CANCELLED";
    statusBg = "#e5e7eb";
    statusBorder = "#6b7280";
    statusColor = "#374151";
  }

  // ✅ Create invoice only when completed and no invoice exists
  const canCreateInvoice = INVOICE_ENABLED && isCompleted && !hasInvoice && !isCreatingInvoice;

  const formattedDate = workOrder.date ? new Date(workOrder.date).toLocaleDateString() : "";

  return (
    <div style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
      {/* HEADER (InvoiceDetail pattern) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        {/* Left: Title + meta + status */}
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.15 }}>
            Work Order #{workOrder._id.slice(-6)}
          </h1>

          <div style={{ marginTop: "0.35rem", color: "#9ca3af", fontWeight: 600, fontSize: "0.95rem" }}>
            Created {formattedDate || "—"}
          </div>

          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {/* Status pill */}
            <span
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "999px",
                border: `2px solid ${statusBorder}`,
                background: statusBg,
                color: statusColor,
                fontSize: "0.85rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
                boxShadow: "0 1px 0 rgba(0,0,0,0.10)",
              }}
            >
              {statusLabel}
            </span>

            {/* START / PAUSE / RESUME buttons */}
            {!isCompleted && !isInvoiced && !isCancelled && (
              <>
                {(isOpen || isOnHold) && (
                  <button
                    type="button"
                    onClick={handleStartWork}
                    style={{
                      padding: "0.4rem 0.9rem",
                      borderRadius: "999px",
                      border: "1px solid #16a34a",
                      background: "#16a34a",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    {isOnHold ? "RESUME" : "START"}
                  </button>
                )}

                {isInProgress && (
                  <button
                    type="button"
                    onClick={handlePauseWork}
                    style={{
                      padding: "0.4rem 0.9rem",
                      borderRadius: "999px",
                      border: "1px solid #f59e0b",
                      background: "#ffffff",
                      color: "#b45309",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    PAUSE
                  </button>
                )}
              </>
            )}

            {/* COMPLETE button */}
            {(isInProgress || isOnHold) && !isCompleted && !isInvoiced && (
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
                  fontWeight: 700,
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

        {/* Right: Nav/actions */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => navigate("/work-orders")}>
            Back to Work Orders
          </button>

          {/* ✅ Invoice block: truth based on resolvedInvoiceId */}
          {INVOICE_ENABLED && (
            <>
              {resolvedInvoiceId ? (
                <button type="button" onClick={() => navigate(`/invoices/${resolvedInvoiceId}`)}>
                  View Invoice
                </button>
              ) : isCompleted ? (
                <button
                  type="button"
                  onClick={handleCreateInvoice}
                  disabled={!canCreateInvoice}
                  title="Create an invoice for this work order."
                >
                  {isCreatingInvoice ? "Creating Invoice…" : "Create Invoice"}
                </button>
              ) : (
                <button type="button" disabled title="Complete the work order before creating an invoice.">
                  Create Invoice
                </button>
              )}
            </>
          )}

          <button type="button" onClick={handleEdit}>
            Edit
          </button>

          <button
            type="button"
            onClick={handleDelete}
            style={{
              border: "1px solid #b91c1c",
              color: "#b91c1c",
              background: "transparent",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Optional UI-level error */}
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

      {/* CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        {/* Customer card */}
        <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Customer</h3>
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

        {/* Work Order card */}
        <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Work Order</h3>

          <p>
            <strong>Date:</strong> {formattedDate || "—"}
          </p>
          <p>
            <strong>Odometer:</strong> {workOrder.odometer?.toLocaleString() ?? "—"}
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
            <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #eee" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Vehicle</div>

              <div>
                {workOrder.vehicle.year && `${workOrder.vehicle.year} `}
                {workOrder.vehicle.make} {workOrder.vehicle.model}
              </div>

              {workOrder.vehicle.licensePlate ? <div>Plate: {workOrder.vehicle.licensePlate}</div> : null}
              {workOrder.vehicle.vin ? <div>VIN: {workOrder.vehicle.vin}</div> : null}
              {workOrder.vehicle.color ? <div>Color: {workOrder.vehicle.color}</div> : null}
              {workOrder.vehicle.notes ? <div>Notes: {workOrder.vehicle.notes}</div> : null}
            </div>
          )}

          <p style={{ marginTop: "0.75rem" }}>
            <strong>Total:</strong> ${displayTotal.toFixed(2)}
          </p>
        </div>

        {/* Timeline card */}
        <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Timeline</h3>
          <TimelineBlock items={timelineItems} />
        </div>
      </div>

      {/* LINE ITEMS */}
      <div style={{ marginTop: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <h3 style={{ margin: 0 }}>Line Items</h3>

          <button
            type="button"
            onClick={handleAddLineItem}
            style={{
              padding: "8px 14px",
              borderRadius: "10px",
              border: "1px solid #111827",
              backgroundColor: "#111827",
              color: "#ffffff",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            + Add Line
          </button>
        </div>

        <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>Description</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>Qty / Hours</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>Unit Price</th>
                <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>Line Total</th>
                <th style={{ padding: "8px 12px", width: "1%" }} />
              </tr>
            </thead>

            <tbody>
              {normalizedLineItems.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}>
                    No line items yet. Click “Add Line” to get started.
                  </td>
                </tr>
              )}

              {normalizedLineItems.map((item, index) => (
                <tr key={index} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <select
                      value={item.type}
                      onChange={(e) => handleLineItemChange(index, "type", e.target.value)}
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "6px 8px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <option value="labour">Labour</option>
                      <option value="part">Part</option>
                      <option value="service">Service</option>
                    </select>
                  </td>

                  <td style={{ padding: "8px 12px" }}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                      placeholder={item.type === "labour" ? "e.g. Brake inspection" : "e.g. Brake pads"}
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "0.85rem",
                      }}
                    />
                  </td>

                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <input
                      type="text"
                      value={item.rawQuantity ?? ""}
                      onChange={(e) => handleLineItemChange(index, "rawQuantity", e.target.value)}
                      style={{
                        width: "90px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "0.85rem",
                        textAlign: "right",
                      }}
                      placeholder={item.type === "labour" ? "e.g. 1:25" : "Qty"}
                    />
                  </td>

                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <input
                      type="text"
                      value={item.rawUnitPrice ?? ""}
                      onChange={(e) => handleLineItemChange(index, "rawUnitPrice", e.target.value)}
                      style={{
                        width: "110px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "0.85rem",
                        textAlign: "right",
                      }}
                      placeholder="$0.00"
                    />
                  </td>

                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{item.lineTotal.toFixed(2)}</td>

                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
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

        {/* Totals + Save */}
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: "300px", textAlign: "right" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <span style={{ fontWeight: 600 }}>Subtotal:</span>
              <span>${displaySubtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", alignItems: "center", marginTop: "6px" }}>
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
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "0.85rem",
                  textAlign: "right",
                }}
              />
              <span>%</span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "6px" }}>
              <span style={{ fontWeight: 600 }}>Tax Amount:</span>
              <span>${displayTaxAmount.toFixed(2)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", fontWeight: 800, fontSize: "1rem", marginTop: "8px" }}>
              <span>Total:</span>
              <span>${displayTotal.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" }}>
              {hasUnsavedChanges && (
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    border: "1px solid #f59e0b",
                    color: "#b45309",
                    background: "rgba(245, 158, 11, 0.10)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Unsaved changes
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveLineItems}
                disabled={saving}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid #4b5563",
                  backgroundColor: saving ? "#e5e7eb" : "#111827",
                  color: saving ? "#6b7280" : "#ffffff",
                  fontSize: "0.95rem",
                  cursor: saving ? "default" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save Line Items"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm ? (
        <div style={{ marginTop: "1.25rem", border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", borderRadius: "12px", padding: "0.9rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Delete this work order?</div>
          <div style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>This can’t be undone.</div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              style={{
                border: "1px solid #b91c1c",
                color: "#b91c1c",
                background: "transparent",
                padding: "8px 12px",
                borderRadius: "10px",
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
                padding: "8px 12px",
                borderRadius: "10px",
              }}
            >
              Cancel
            </button>
          </div>

          {deleteError ? <div style={{ marginTop: "0.5rem", color: "#ef4444" }}>{deleteError}</div> : null}
        </div>
      ) : null}

      {/* Work Order Messages */}
      <WorkOrderMessages workOrderId={workOrder._id} />
    </div>
  );
}
