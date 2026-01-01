// backend/src/domain/invoices/invoiceLifecycle.ts

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

type Transition = { from: InvoiceStatus; to: InvoiceStatus };

const ALLOWED: Transition[] = [
  { from: "draft", to: "sent" },
  { from: "draft", to: "void" },
  { from: "sent", to: "paid" },
  { from: "sent", to: "void" },
];

export function assertValidInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus) {
  if (from === to) return;

  const ok = ALLOWED.some((t) => t.from === from && t.to === to);
  if (!ok) {
    throw Object.assign(new Error(`Invalid invoice transition: ${from} → ${to}`), {
      statusCode: 400,
      code: "INVALID_INVOICE_TRANSITION",
    });
  }
}

export function assertCanEditInvoice(status: InvoiceStatus) {
  if (status !== "draft") {
    throw Object.assign(new Error(`Invoice is locked once ${status}`), {
      statusCode: 400,
      code: "INVOICE_LOCKED",
    });
  }
}
