//frontend/src/api/invoices.ts
import api from "./client";
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
  const res = await api.get<Invoice[]>("/invoices");
  return res.data;
}

// GET /api/invoices/:id
export async function fetchInvoiceById(id: string): Promise<Invoice> {
  const res = await api.get<Invoice>(`/invoices/${id}`);
  return res.data;
}

// PDF helper
export function getInvoicePdfUrl(invoiceId: string) {
  return `${API_BASE}/invoices/${invoiceId}/pdf`;
}

// POST /api/invoices/:id/email
export async function emailInvoice(invoiceId: string) {
  const res = await api.post(`/invoices/${invoiceId}/email`);
  return res.data as {
    ok: boolean;
    message: string;
    email?: any;
    status?: string;
    financialStatus?: string;
    paidAmount?: number;
    balanceDue?: number;
  };
}

// PATCH /api/invoices/:id/status
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  reason?: string
): Promise<Invoice> {
  const res = await api.patch<Invoice>(
    `/invoices/${id}/status`,
    status === "void" ? { status, reason } : { status }
  );
  return res.data;
}

// GET /api/invoices/financial/summary
export async function fetchFinancialSummary(
  params?: { from?: string; to?: string }
): Promise<FinancialSummaryResponse> {
  const res = await api.get<FinancialSummaryResponse>(
    "/invoices/financial/summary",
    { params }
  );
  return res.data;
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
  const res = await api.post<Invoice>(`/invoices/${invoiceId}/pay`, payload);
  return res.data;
}
