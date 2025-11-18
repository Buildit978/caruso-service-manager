// src/api/workOrders.ts
import api from "./client";
import type { WorkOrder, WorkOrderStatus, WorkOrderVehicle } from "../types/workOrder";

export interface WorkOrderFilters {
    status?: WorkOrderStatus;
    customerId?: string;
    fromDate?: string; // ISO
    toDate?: string;   // ISO
}

export interface CreateWorkOrderPayload {
    customerId: string;
    complaint: string;
    odometer?: number;
    diagnosis?: string;
    notes?: string;
    vehicle?: WorkOrderVehicle;
}

export interface UpdateWorkOrderPayload {
    complaint?: string;
    diagnosis?: string;
    notes?: string;
    odometer?: number;
    status?: WorkOrderStatus;
    vehicle?: WorkOrderVehicle;
}

export async function fetchWorkOrders(filters: WorkOrderFilters = {}): Promise<WorkOrder[]> {
    const params: Record<string, string> = {};

    if (filters.status) params.status = filters.status;
    if (filters.customerId) params.customerId = filters.customerId;
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;

    const res = await api.get<WorkOrder[]>("/work-orders", { params });
    return res.data;
}

export async function fetchWorkOrder(id: string): Promise<WorkOrder> {
    const res = await api.get<WorkOrder>(`/work-orders/${id}`);
    return res.data;
}

export async function createWorkOrder(payload: CreateWorkOrderPayload): Promise<WorkOrder> {
    const res = await api.post<WorkOrder>("/work-orders", payload);
    return res.data;
}

export async function updateWorkOrder(
    id: string,
    payload: UpdateWorkOrderPayload
): Promise<WorkOrder> {
    const res = await api.put<WorkOrder>(`/work-orders/${id}`, payload);
    return res.data;
}

export async function updateWorkOrderStatus(
    id: string,
    status: WorkOrderStatus
): Promise<WorkOrder> {
    const res = await api.patch<WorkOrder>(`/work-orders/${id}/status`, { status });
    return res.data;
}

export async function deleteWorkOrder(id: string): Promise<void> {
    await api.delete(`/work-orders/${id}`);
}

export async function createInvoiceFromWorkOrder(id: string) {
    const res = await api.post(`/invoices/from-workorder/${id}`);
    return res.data;
}
