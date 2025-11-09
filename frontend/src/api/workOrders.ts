// src/api/workOrders.ts
import api from './client';
import type { WorkOrder, WorkOrderStatus } from '../types/api';

export interface WorkOrderFilters {
    status?: WorkOrderStatus;
    customerId?: string;
    fromDate?: string; // ISO
    toDate?: string;   // ISO
}

export async function fetchWorkOrders(filters: WorkOrderFilters = {}): Promise<WorkOrder[]> {
    const params: Record<string, string> = {};

    if (filters.status) params.status = filters.status;
    if (filters.customerId) params.customerId = filters.customerId;
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;

    const res = await api.get<WorkOrder[]>('/work-orders', { params });
    return res.data;
}
