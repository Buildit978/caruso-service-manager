// frontend/src/api/invoices.ts
import axios from "axios";
import api from "./client";
import type { Invoice } from "../types/invoice";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
//import { InvoiceSchema } from "./models/invoice.model"; // whatever your wrapper is



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


export function getInvoicePdfUrl(invoiceId: string) {
  return `${API_BASE}/invoices/${invoiceId}/pdf`;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL; // http://localhost:4000/api

export async function emailInvoicePdf(
  invoiceId: string,
  to: string,
  message?: string
) {
  const res = await axios.post(
    `${API_BASE}/invoices/${invoiceId}/email`,
    { to, message }
  );
  return res.data;
}


export async function emailInvoice(invoiceId: string) {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/email`, {
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to email invoice");
  }

  return res.json() as Promise<{
    ok: boolean;
    message: string;
    email?: any;
  }>;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<Invoice> {
  const res = await api.patch<Invoice>(`/invoices/${invoiceId}/status`, { status });
  return res.data;
}

export async function fetchFinancialSummary(params?: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);

  const res = await fetch(`/api/invoices/financial/summary?${qs.toString()}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}


