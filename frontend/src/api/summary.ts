// frontend/src/api/summary.ts
import api from './client';

export type SummaryResponse = {
  totalCustomers: number;
  openWorkOrders: number;
  completedWorkOrders: number;

  workOrdersThisWeek: number;
  revenueThisWeek: number;

  // ✅ Paid truth (dashboard cards)
  revenuePaidAllTime: { amount: number };
  revenuePaidYtd: { amount: number };
    avgOrderValueYtd: number;

  // ✅ Back-compat (safe to keep for now; can delete later)
  totalRevenue?: number;
  averageOrderValue?: number;
};

export async function fetchSummary(): Promise<SummaryResponse> {
  const res = await api.get<SummaryResponse>("/summary");
  return res.data;
}