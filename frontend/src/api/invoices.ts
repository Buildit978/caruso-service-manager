// frontend/src/api/invoices.ts
import axios from "axios";
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

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function getInvoicePdfUrl(invoiceId: string) {
  return `${API_BASE}/invoices/${invoiceId}/pdf`;
}

