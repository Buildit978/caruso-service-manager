// frontend/src/api/invoices.ts
import api from "./client";
import type { Invoice } from "../types/invoice";


export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type FinancialSummaryResponse = {
  range: { from: string; to: string };
  revenuePaid: { count: number; amount: number; tax: number; subtotal: number };
  outstandingSent: { count: number; amount: number };
  drafts: { count: number; amount: number };
  voided: { count: number; amount: number };
  aging: Array<{ _id: "0-7" | "8-14" | "15-30" | "31+"; count: number; amount: number }>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL; // http://localhost:4000/api

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

// For <a href> or window.open
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
  };
}

// PATCH /api/invoices/:id/status
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<Invoice> {
  const res = await api.patch<Invoice>(`/invoices/${invoiceId}/status`, { status });
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

export async function recordInvoicePayment(
  invoiceId: string,
  payload: {
    method: "cash" | "card" | "e-transfer" | "cheque";
    amount: number;
    reference?: string;
  }
): Promise<Invoice> {
  const res = await api.post<{ invoice: Invoice }>(`/invoices/${invoiceId}/pay`, payload);
  return res.data.invoice;
}
