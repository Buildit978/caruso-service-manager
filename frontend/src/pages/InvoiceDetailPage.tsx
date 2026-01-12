// frontend/src/pages/InvoiceDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Invoice } from "../types/invoice";
import { fetchInvoiceById, getInvoicePdfUrl, emailInvoice, updateInvoiceStatus, type InvoiceStatus } from "../api/invoices";
import { fetchCustomerById } from "../api/customers";
import { recordInvoicePayment } from "../api/invoices";



function resolveWorkOrderId(invoice: any): string | null {
  if (!invoice) return null;

  const wo = invoice.workOrderId;

  // Case: stored as plain string
  if (typeof wo === "string") return wo;

  // Case: populated object {_id: "..."} or ObjectId
  if (wo && typeof wo === "object") {
    if (typeof wo._id === "string") return wo._id;
    if (wo._id && typeof wo._id.toString === "function") return wo._id.toString();
    if (typeof wo.id === "string") return wo.id;
  }

  return null;
}

function resolveCustomerId(inv: any): string | null {
  if (!inv) return null;
  const c = inv.customerId ?? inv.customer ?? null;

  if (typeof c === "string") return c;

  if (c && typeof c === "object") {
    if (typeof c._id === "string") return c._id;
    if (c._id && typeof c._id.toString === "function") return c._id.toString();
    if (typeof c.id === "string") return c.id;
  }

  return null;
}

  function fmtDateTime(d: any): string {
    if (!d) return "";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString();
  }

  function getLatestPaymentDate(inv: any): Date | null {
    const payments = Array.isArray(inv?.payments) ? inv.payments : [];
    const dates = payments
      .map((p: any) => p?.paidAt)
      .filter(Boolean)
      .map((x: any) => (x instanceof Date ? x : new Date(x)))
      .filter((d: Date) => !Number.isNaN(d.getTime()))
      .sort((a: Date, b: Date) => b.getTime() - a.getTime());

    return dates[0] ?? null;
  }


export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liveCustomerEmail, setLiveCustomerEmail] = useState<string>("");
  const [liveCustomerLoading, setLiveCustomerLoading] = useState(false);

  const [isEmailing, setIsEmailing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const resolvedWorkOrderId = useMemo(() => resolveWorkOrderId(invoice), [invoice]);

  const resolvedCustomerId = useMemo(() => resolveCustomerId(invoice), [invoice]);

  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "e-transfer" | "cheque">("cash");
  const [payRef, setPayRef] = useState<string>("");

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  async function handleRecordPayment() {
    if (!invoice?._id) return;

    const amountNum = Number(payAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setPayError("Enter a valid payment amount.");
      return;
    }

    try {
      setPaying(true);
      setPayError(null);

      const updated = await recordInvoicePayment(invoice._id, {
        method: payMethod,
        amount: amountNum,
        reference: payRef.trim() || undefined,
      });

      setInvoice(updated);
      setPayAmount("");
      setPayRef("");

    } catch (err: any) {
      setPayError(err?.message || "Failed to record payment.");
    } finally {
      setPaying(false);
    }
  }


  // ✅ Load invoice by route param
  useEffect(() => {
   if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      setError("Invalid invoice ID");
      setLoading(false);
      return;
    } 

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchInvoiceById(id);
        if (!cancelled) setInvoice(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load invoice");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ✅ Fetch live customer email whenever the *customer id* changes
  useEffect(() => {
    if (!resolvedCustomerId) {
      setLiveCustomerEmail("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLiveCustomerLoading(true);
        const customer = await fetchCustomerById(resolvedCustomerId);
        const email = (customer?.email || "").trim();
        if (!cancelled) setLiveCustomerEmail(email);
      } catch (err) {
        console.error("[InvoiceDetail] Failed to fetch live customer email", err);
        if (!cancelled) setLiveCustomerEmail("");
      } finally {
        if (!cancelled) setLiveCustomerLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedCustomerId]);

  if (loading) return <div style={{ padding: "1rem" }}>Loading invoice…</div>;

  if (error || !invoice) {
    return (
      <div style={{ padding: "1rem" }}>
        <p>{error ?? "Invoice not found"}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  // --- Email helpers ---
  async function handleSendOrResend() {
    if (!invoice?._id) return;

    try {
      setIsEmailing(true);
      setEmailError(null);

      const resp = await emailInvoice(invoice._id);

      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              ...(resp?.status ? { status: resp.status as any } : null),
              ...(resp?.email ? { email: resp.email as any } : null),
            }
          : prev
      );

      alert("✅ Invoice emailed.");
      // Optional: mark as sent automatically after successful email:
      // const updated = await updateInvoiceStatus(invoice._id, "sent");
      // setInvoice(updated);
    } catch (err: any) {
      const msg = err?.message || "Failed to email invoice.";
      setEmailError(msg);
      alert("❌ " + msg);
    } finally {
      setIsEmailing(false);
    }
  }

  // --- Status update helper ---
  async function handleSetStatus(next: InvoiceStatus) {
    if (!invoice?._id) return;

    try {
      setIsSaving(true);
      setError(null);

      const updated = await updateInvoiceStatus(invoice._id, next);
      setInvoice(updated);
    } catch (err: any) {
      console.error("[InvoiceDetail] status update failed:", err);
      setError(err.message || "Failed to update invoice status");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVoidInvoice() {
    if (!invoice?._id) return;

    const lifecycle = String((invoice as any).status ?? "draft").toLowerCase();
    const fin = String((invoice as any).financialStatus ?? "").toLowerCase();

    if (fin === "paid") {
      alert("This invoice is PAID and cannot be voided.");
      return;
    }
    if (lifecycle === "void") return;

    const reason = window.prompt("Void reason (required):");
    if (!reason || !reason.trim()) return;


  try {
    setIsSaving(true);
    setError(null);

    const updated = await updateInvoiceStatus(invoice._id, "void", reason.trim());
    setInvoice(updated);
  } catch (err: any) {
    setError(err?.message || "Failed to void invoice");
  } finally {
    setIsSaving(false);
  }
}


  const customerName = [invoice.customerSnapshot?.firstName, invoice.customerSnapshot?.lastName]
    .filter(Boolean)
    .join(" ");

  const liveEmail =
  (liveCustomerEmail || (invoice as any)?.customerId?.email || "").trim();
  const snapshotEmail = (invoice.customerSnapshot?.email || "").trim();
  const truthEmail = liveEmail || snapshotEmail;
  const emailMismatch = !!liveEmail && !!snapshotEmail && liveEmail !== snapshotEmail;



// --- Money + status clarity (backend truth) ---

// Lifecycle truth: comes from invoice.status (updated by updateInvoiceStatus)
const lifecycleRaw = String((invoice as any).status ?? "draft").toLowerCase();

// lifecycle flags
const isDraft = lifecycleRaw === "draft";
const isVoid = lifecycleRaw === "void";
const isReadOnly = !isDraft;

// Financial truth: comes from invoice.financialStatus (set by backend)
const financialRaw = String((invoice as any).financialStatus ?? "").toLowerCase();
const isPaid = financialRaw === "paid";
const isPartial = financialRaw === "partial";
const isDue = financialRaw === "due" || !financialRaw; // tolerate older invoices missing financialStatus


  // money values: display-only (never used to infer status)
  const paidAmountNum = Number((invoice as any).paidAmount ?? 0);
  const balanceDueNum = Number((invoice as any).balanceDue ?? Number(invoice.total ?? 0));

  const latestPaymentDate = getLatestPaymentDate(invoice);

  // display-only helper line (driven by backend financialStatus + payments)
  const paidOrLastPaymentLine =
    isVoid
      ? ""
      : isPaid && latestPaymentDate
      ? `Paid on ${fmtDateTime(latestPaymentDate)}`
      : isPartial && latestPaymentDate
      ? `Last payment ${fmtDateTime(latestPaymentDate)}`
      : "";

 
 
 
return (
  <div style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
    {/* Header */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "1rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ flex: 1 }}>
        <h2 style={{ margin: 0 }}>Invoice #{invoice.invoiceNumber}</h2>

        {/* NEW: Confidence money line */}
        <div
          style={{
            marginTop: "0.35rem",
            color: "#9ca3af",
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          Total {Number(invoice.total ?? 0).toFixed(2)}{" "}
          <span style={{ color: "#6b7280", fontWeight: 500 }}>•</span>{" "}
          Paid {paidAmountNum.toFixed(2)}{" "}
          <span style={{ color: "#6b7280", fontWeight: 500 }}>•</span>{" "}
          Balance {balanceDueNum.toFixed(2)}
        </div>

        {/* Status + paid/last payment + email meta */}
        <div
          style={{
            marginTop: "0.5rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
      {/* Status badges: Lifecycle + Financial (VOID overrides everything) */}
{(() => {
  const lifecycle = String((invoice as any).status ?? "draft").toLowerCase();
  const fin = String((invoice as any).financialStatus ?? "").toLowerCase();

  // VOID overrides everything
  if (lifecycle === "void") {
    return (
      <span
        style={{
          padding: "0.4rem 0.9rem",
          borderRadius: "999px",
          fontSize: "0.95rem",
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
          border: "2px solid #dc2626",
          color: "#dc2626",
          background: "#fef2f2",
        }}
      >
        VOID
      </span>
    );
  }

  const base: React.CSSProperties = {
    padding: "0.35rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.85rem",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  };

  // Lifecycle badge (DRAFT/SENT)
  const lifecycleLabel = lifecycle === "draft" ? "DRAFT" : "SENT";
  const lifecycleStyle =
    lifecycleLabel === "DRAFT"
      ? { border: "2px solid #6b7280", color: "#374151", background: "#f3f4f6" }
      : { border: "2px solid #2563eb", color: "#2563eb", background: "#eff6ff" };

  // Financial badge (DUE/PARTIAL/PAID) — default DUE if missing/unknown
  const finLabel =
    fin === "paid" ? "PAID" : fin === "partial" ? "PARTIAL" : "DUE";

  const finStyle =
    finLabel === "PAID"
      ? { border: "2px solid #16a34a", color: "#16a34a", background: "#f0fdf4" }
      : finLabel === "PARTIAL"
      ? { border: "2px solid #d97706", color: "#b45309", background: "#fffbeb" }
      : { border: "2px solid #2563eb", color: "#2563eb", background: "#eff6ff" };

  return (
    <span style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
      <span style={{ ...base, ...lifecycleStyle }}>{lifecycleLabel}</span>
      <span style={{ ...base, ...finStyle }}>{finLabel}</span>
    </span>
  );
})()}


          {/* NEW: Paid/Last payment line (truth = payments[]) */}
          {paidOrLastPaymentLine ? (
            <span style={{ fontSize: "0.9rem", color: "#374151", fontWeight: 600 }}>
              {paidOrLastPaymentLine}
            </span>
          ) : null}

          {/* Email meta (unchanged) */}
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            Email: {((invoice as any).email?.status ?? "never_sent").replace("_", " ")}
            {(invoice as any).email?.lastSentAt
              ? ` • Last: ${new Date((invoice as any).email.lastSentAt).toLocaleString()}`
              : ""}
            {liveCustomerLoading ? " • syncing…" : ""}
          </span>
        </div>

        {emailError ? <div style={{ marginTop: "0.5rem", color: "#b91c1c" }}>{emailError}</div> : null}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={!resolvedWorkOrderId}
          onClick={() => resolvedWorkOrderId && navigate(`/work-orders/${resolvedWorkOrderId}`)}
        >
          Back to Work Order
        </button>

        <button type="button" disabled={isEmailing} onClick={handleSendOrResend}>
          {isEmailing
            ? "Sending..."
            : (invoice as any).email?.status && (invoice as any).email.status !== "never_sent"
            ? "Resend Email"
            : "Email Invoice"}
        </button>

        <button
          type="button"
          onClick={() => {
            const url = getInvoicePdfUrl(invoice._id);
            window.open(url, "_blank");
          }}
        >
          View PDF
        </button>
      </div>
    </div>

    {/* V1 Actions (no Mark Draft / no Mark Sent) */}
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      <button
        type="button"
        disabled={isSaving || isPaid || isVoid}
        onClick={handleVoidInvoice}
        style={{
          border: "1px solid #dc2626",
          color: "#dc2626",
          background: "white",
        }}
        title={isPaid ? "Paid invoices cannot be voided" : isVoid ? "Invoice is already void" : "Void this invoice"}
      >
        Void Invoice
      </button>

      {isReadOnly ? (
        <span style={{ alignSelf: "center", fontSize: "0.9rem", color: "#6b7280" }}>
          This invoice is read-only ({lifecycleRaw.toUpperCase()}).
        </span>
      ) : (
        <span style={{ alignSelf: "center", fontSize: "0.9rem", color: "#6b7280" }}>
          Draft invoice — editable until emailed/sent.
        </span>
      )}

    </div>

    {/* Dates row */}
    <div style={{ marginBottom: "1rem", fontSize: "0.95rem" }}>
      <strong>Issue Date:</strong>{" "}
      {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : "—"}
      {invoice.dueDate ? (
        <>
          {" "}
          • <strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}
        </>
      ) : null}
    </div>

    {/* Bill To + Vehicle */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "1rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Bill To</h3>
        <div>{customerName || "Unknown Customer"}</div>
        {invoice.customerSnapshot?.address ? <div>{invoice.customerSnapshot.address}</div> : null}
        {invoice.customerSnapshot?.phone ? <div>Phone: {invoice.customerSnapshot.phone}</div> : null}
        {truthEmail && <div>Email: {truthEmail}</div>}
        {emailMismatch && (
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            On invoice: {snapshotEmail}
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Vehicle</h3>
        {invoice.vehicleSnapshot ? (
          <>
            <div>
              {invoice.vehicleSnapshot.year} {invoice.vehicleSnapshot.make} {invoice.vehicleSnapshot.model}
            </div>
            {invoice.vehicleSnapshot.licensePlate ? <div>Plate: {invoice.vehicleSnapshot.licensePlate}</div> : null}
            {invoice.vehicleSnapshot.vin ? <div>VIN: {invoice.vehicleSnapshot.vin}</div> : null}
          </>
        ) : (
          <div style={{ color: "#6b7280" }}>No vehicle snapshot</div>
        )}
      </div>
    </div>

    {/* Line items */}
    <div style={{ marginBottom: "1rem" }}>
      <h3>Line Items</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
              Description
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Qty</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Unit</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems?.map((item: any, idx: number) => (
            <tr key={idx}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{item.description}</td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", textAlign: "right" }}>
                {item.quantity}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", textAlign: "right" }}>
                {Number(item.unitPrice ?? 0).toFixed(2)}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", textAlign: "right" }}>
                {Number(item.lineTotal ?? 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Totals */}
    <div style={{ marginTop: "1rem", textAlign: "right" }}>
      <div>Subtotal: {Number(invoice.subtotal ?? 0).toFixed(2)}</div>
      <div>
        Tax ({Number(invoice.taxRate ?? 0)}%): {Number(invoice.taxAmount ?? 0).toFixed(2)}
      </div>
      <div style={{ fontWeight: "bold", marginTop: "0.5rem" }}>
        Total: {Number(invoice.total ?? 0).toFixed(2)}
      </div>
    </div>

    {/* Payments */}
    <div style={{ marginTop: "1.25rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Payments</h3>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Paid to date</div>
          <div style={{ fontWeight: 600 }}>{Number((invoice as any).paidAmount ?? 0).toFixed(2)}</div>
        </div>

        <div>
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Balance due</div>
          <div style={{ fontWeight: 600 }}>
            {Number((invoice as any).balanceDue ?? Number(invoice.total ?? 0)).toFixed(2)}
          </div>
        </div>

       {/* Date paid / Last payment (backend truth) */}
            {isPaid && latestPaymentDate ? (
              <div>
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Date paid</div>
                <div style={{ fontWeight: 600 }}>{fmtDateTime(latestPaymentDate)}</div>
              </div>
            ) : isPartial && latestPaymentDate ? (
              <div>
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Last payment</div>
                <div style={{ fontWeight: 600 }}>{fmtDateTime(latestPaymentDate)}</div>
              </div>
            ) : null}

      </div>

      {/* Payment history (optional but useful now that you have payments[]) */}
      {Array.isArray((invoice as any).payments) && (invoice as any).payments.length > 0 ? (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem" }}>History</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {(invoice as any).payments.map((p: any, idx: number) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>
                {new Date(p.paidAt).toLocaleString()} • {p.method} • ${Number(p.amount ?? 0).toFixed(2)}
                {p.reference ? ` • ${p.reference}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: "0.75rem" }}>
          No payments recorded yet.
        </div>
      )}

      {/* Record payment form */}
      {(() => {
        const status = (invoice.financialStatus || "draft").toLowerCase();
        const locked = status === "draft" || status === "paid" || status === "void";

        return (
          <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#6b7280" }}>Amount</label>
                <input
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 50"
                  inputMode="decimal"
                  style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "8px" }}
                  disabled={locked || paying}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#6b7280" }}>Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "8px" }}
                  disabled={locked || paying}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="e-transfer">e-Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#6b7280" }}>Reference (optional)</label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. deposit, txn id, last 4"
                  style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "8px" }}
                  disabled={locked || paying}
                />
              </div>

              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={locked || paying}
                style={{ padding: "0.55rem 0.9rem" }}
              >
                {paying ? "Recording..." : "Record Payment"}
              </button>
            </div>

            {locked ? (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#6b7280" }}>
                {status === "draft"
                  ? "Send the invoice before recording payment."
                  : status === "paid"
                  ? "Invoice is fully paid."
                  : "Invoice is voided."}
              </div>
            ) : null}

            {payError ? <div style={{ marginTop: "0.5rem", color: "#b91c1c" }}>{payError}</div> : null}
          </div>
        );
      })()}
    </div>

    {/* Notes */}
    {invoice.notes ? (
      <div style={{ marginTop: "1rem" }}>
        <h3>Notes</h3>
        <p>{invoice.notes}</p>
      </div>
    ) : null}
  </div>
);

}
