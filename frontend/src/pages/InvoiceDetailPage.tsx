// frontend/src/pages/InvoiceDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Invoice } from "../types/invoice";
import { fetchInvoiceById } from "../api/invoices";



import { getInvoicePdfUrl } from "../api/invoices";


function resolveWorkOrderId(invoice: any): string | null {
  if (!invoice) return null;

  const wo = invoice.workOrderId;

  // Case: stored as plain string
  if (typeof wo === "string") return wo;

  // Case: populated object {_id: "..."} or ObjectId
  if (wo && typeof wo === "object") {
    if (typeof wo._id === "string") return wo._id;
    if (wo._id && typeof wo._id.toString === "function") {
      return wo._id.toString();
    }
    if (typeof wo.id === "string") return wo.id;
  }

  return null;
}



export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolvedWorkOrderId = resolveWorkOrderId(invoice);
  console.log("[InvoiceDetail] resolvedWorkOrderId:", resolvedWorkOrderId);

  useEffect(() => {
    if (!id) {
      setError("Missing invoice ID");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        console.log("[InvoiceDetail] Fetching invoice", id);
        const data = await fetchInvoiceById(id);
        console.log("[InvoiceDetail] Loaded invoice", data);
        setInvoice(data);
      } catch (err: any) {
        console.error("[InvoiceDetail] Error fetching invoice:", err);
        setError(err?.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div style={{ padding: "1rem" }}>Loading invoice…</div>;
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: "1rem" }}>
        <p>{error ?? "Invoice not found"}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }


  const customerName = [
    invoice.customerSnapshot.firstName,
    invoice.customerSnapshot.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  
  

  return (
    <div style={{ padding: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2>Invoice #{invoice.invoiceNumber}</h2>
        <span
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "999px",
            border: "1px solid #ccc",
            fontSize: "0.85rem",
            textTransform: "uppercase",
          }}
        >
          {invoice.status}
        </span>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Issue Date:</strong>{" "}
        {invoice.issueDate && new Date(invoice.issueDate).toLocaleDateString()}
        <br />
        {invoice.dueDate && (
          <>
            <strong>Due Date:</strong>{" "}
            {new Date(invoice.dueDate).toLocaleDateString()}
          </>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <h3>Bill To</h3>
        <div>{customerName || "Unknown Customer"}</div>
        {invoice.customerSnapshot.address && <div>{invoice.customerSnapshot.address}</div>}
        {invoice.customerSnapshot.phone && <div>Phone: {invoice.customerSnapshot.phone}</div>}
        {invoice.customerSnapshot.email && <div>Email: {invoice.customerSnapshot.email}</div>}
      </div>

      {invoice.vehicleSnapshot && (
        <div style={{ marginBottom: "1rem" }}>
          <h3>Vehicle</h3>
          <div>
            {invoice.vehicleSnapshot.year} {invoice.vehicleSnapshot.make}{" "}
            {invoice.vehicleSnapshot.model}
          </div>
          {invoice.vehicleSnapshot.licensePlate && (
            <div>Plate: {invoice.vehicleSnapshot.licensePlate}</div>
          )}
          {invoice.vehicleSnapshot.vin && <div>VIN: {invoice.vehicleSnapshot.vin}</div>}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <h3>Line Items</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "0.5rem",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                Description
              </th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                Qty
              </th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                Unit
              </th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                  {item.description}
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    borderBottom: "1px solid #eee",
                    textAlign: "right",
                  }}
                >
                  {item.quantity}
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    borderBottom: "1px solid #eee",
                    textAlign: "right",
                  }}
                >
                  {item.unitPrice.toFixed(2)}
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    borderBottom: "1px solid #eee",
                    textAlign: "right",
                  }}
                >
                  {item.lineTotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1rem", textAlign: "right" }}>
        <div>Subtotal: {invoice.subtotal.toFixed(2)}</div>
        <div>Tax ({invoice.taxRate}%): {invoice.taxAmount.toFixed(2)}</div>
        <div style={{ fontWeight: "bold", marginTop: "0.5rem" }}>
          Total: {invoice.total.toFixed(2)}
        </div>
      </div>

      {invoice.notes && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Notes</h3>
          <p>{invoice.notes}</p>
        </div>
      )}

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem" }}>
       <button
  type="button"
  disabled={!resolvedWorkOrderId}
  onClick={() => {
    if (!resolvedWorkOrderId) return;
    navigate(`/work-orders/${resolvedWorkOrderId}`);
  }}
>
  Back to Work Order
        </button>

<button
  type="button"
  onClick={() => {
    const url = getInvoicePdfUrl(invoice._id);
    console.log("Invoice PDF URL:", url);
    window.open(url, "_blank");
  }}
>
  View PDF
</button>




      </div>
    </div>
  );
}
