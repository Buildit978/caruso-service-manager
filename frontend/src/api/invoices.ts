//frontend/src/api/invoices.ts
import { http } from "./http";
import type { Invoice, InvoiceStatus } from "../types/invoice";

export type FinancialSummaryResponse = {
  range: { from: string; to: string };
  revenuePaid: { count: number; amount: number; tax: number; subtotal: number };
  outstandingSent: { count: number; amount: number };
  drafts: { count: number; amount: number };
  voided: { count: number; amount: number };
  aging: Array<{ _id: "0-7" | "8-14" | "15-30" | "31+"; count: number; amount: number }>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// GET /api/invoices
export async function fetchInvoices(): Promise<Invoice[]> {
  return await http<Invoice[]>("/invoices");
}

// GET /api/invoices/:id
export async function fetchInvoiceById(id: string): Promise<Invoice> {
  return await http<Invoice>(`/invoices/${id}`);
}

// PDF helper
export function getInvoicePdfUrl(invoiceId: string) {
  return `${API_BASE}/invoices/${invoiceId}/pdf`;
}

// POST /api/invoices/:id/email
export async function emailInvoice(invoiceId: string) {
  return await http<{
    ok: boolean;
    message: string;
    email?: any;
    status?: string;
    financialStatus?: string;
    paidAmount?: number;
    balanceDue?: number;
  }>(`/invoices/${invoiceId}/email`, {
    method: "POST",
  });
}

// PATCH /api/invoices/:id/status
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  reason?: string
): Promise<Invoice> {
  return await http<Invoice>(`/invoices/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(status === "void" ? { status, reason } : { status }),
  });
}

// GET /api/invoices/financial/summary
export async function fetchFinancialSummary(
  params?: { from?: string; to?: string }
): Promise<FinancialSummaryResponse> {
  const queryParams = new URLSearchParams();
  if (params?.from) queryParams.set("from", params.from);
  if (params?.to) queryParams.set("to", params.to);
  const query = queryParams.toString();
  const url = query ? `/invoices/financial/summary?${query}` : "/invoices/financial/summary";
  return await http<FinancialSummaryResponse>(url);
}

// POST /api/invoices/:id/pay
export async function recordInvoicePayment(
  invoiceId: string,
  payload: {
    method: "cash" | "card" | "e-transfer" | "cheque";
    amount: number;
    reference?: string;
  }
): Promise<Invoice> {
  return await http<Invoice>(`/invoices/${invoiceId}/pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
