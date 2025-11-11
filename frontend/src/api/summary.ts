// frontend/src/api/summary.ts
import api from './client';

export type SummaryResponse = {
    totalCustomers: number;
    openWorkOrders: number;
    completedWorkOrders: number;
    totalRevenue: number;
    workOrdersThisWeek: number;
    revenueThisWeek: number;
    averageOrderValue: number;
};


export async function fetchSummary(): Promise<SummaryResponse> {
    const res = await api.get<SummaryResponse>('/summary');
    return res.data;
}
