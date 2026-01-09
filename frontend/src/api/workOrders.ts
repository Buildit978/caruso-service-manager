// src/api/workOrders.ts
import api from "./client";
import type { WorkOrder, WorkOrderStatus, WorkOrderVehicle } from "../types/workOrder";



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

export type WorkOrderSortBy = "createdAt" | "serviceDate" | "status";
export type SortDir = "asc" | "desc";
export type WorkOrderView = "active" | "financial" | "archive" | "all";

export interface WorkOrderFilters {
  status?: WorkOrderStatus | "active";
  customerId?: string;
  view?: WorkOrderView;
  vehicleId?: string;
  fromDate?: string; // ISO
  toDate?: string;   // ISO

  // sorting
  sortBy?: "createdAt" | "status";
  sortDir?: "asc" | "desc";
};




// frontend/src/api/workOrder.ts
export async function fetchWorkOrders(
  filters: WorkOrderFilters = {}
): Promise<WorkOrder[]> {
  const params: Record<string, string> = {};

  if (filters.view) params.view = filters.view;
  if (filters.status) params.status = filters.status;
  if (filters.customerId) params.customerId = filters.customerId;
  if (filters.vehicleId) params.vehicleId = filters.vehicleId;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortDir) params.sortDir = filters.sortDir;

  const res = await api.get<any>("/work-orders", { params });

  const raw = res.data;

  // ✅ MUST be WorkOrder[]
  if (Array.isArray(raw)) return raw;

  // 🔥 emergency compatibility (prevents blank UI)
  const fallback =
    raw?.workOrders ??
    raw?.items ??
    raw?.results ??
    raw?.data ??
    [];
  
  
  // frontend/src/api/workOrder.ts
    const workOrders = Array.isArray(raw) ? raw : Array.isArray(fallback) ? fallback : [];

    return workOrders.map((wo: any) => {
      const invoice =
        wo.invoice ??
        (wo.invoiceId && typeof wo.invoiceId === "object" ? wo.invoiceId : undefined);

      const customer =
        wo.customer ??
        (wo.customerId && typeof wo.customerId === "object" ? wo.customerId : undefined);

      return {
        ...wo,
        invoice,   // ✅ now wo.invoice exists for UI
        customer,  // ✅ now wo.customer exists for formatCustomerName
      };
    });


  return Array.isArray(fallback) ? fallback : [];
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
}

export async function createInvoiceFromWorkOrder(
  id: string,
  opts?: { notes?: string; dueDate?: string }
) {

  try{

    const res = await api.post(`/invoices/from-work-order/${id}`, opts ?? {});
  return res.data;
  } catch(err: any) {console.log("[createInvoiceFromWorkOrder] status:", err?.response?.status);
                    console.log("[createInvoiceFromWorkOrder] data:", err?.response?.data);
                    console.log("[createInvoiceFromWorkOrder] headers:", err?.config?.headers);
                    throw err;}
  
}

