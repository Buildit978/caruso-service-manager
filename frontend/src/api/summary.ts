// frontend/src/api/summary.ts
import api from './client';

export interface SummaryResponse {
    totalCustomers: number;
    openWorkOrders: number;
    completedWorkOrders: number;
    totalRevenue: number;
}

export async function fetchSummary(): Promise<SummaryResponse> {
    const res = await api.get<SummaryResponse>('/summary');
    return res.data;
}
