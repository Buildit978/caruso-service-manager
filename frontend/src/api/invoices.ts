// frontend/src/api/invoices.ts
import api from "./client";
import type { Invoice } from "../types/invoice";

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
