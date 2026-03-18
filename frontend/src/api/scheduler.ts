// frontend/src/api/scheduler.ts
import { http } from "./http";

export interface ScheduleEntry {
  _id: string;
  accountId: string;
  workOrderId: string;
  scheduledDate: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  technicianId?: string | null;
  status: "scheduled" | "cancelled";
  notes?: string;
  workOrder?: {
    _id: string;
    status: string;
    complaint?: string;
    diagnosis?: string;
    notes?: string;
    customerLabel?: string;
    vehicleLabel?: string;
  };
  technicianLabel?: string;
  warnings?: { message: string; entryId: string }[];
}

export interface UnscheduledWorkOrder {
  _id: string;
  status: string;
  complaint?: string;
  diagnosis?: string;
  notes?: string;
  customerLabel?: string;
  vehicleLabel?: string;
  customerId?: string | { _id: string };
  createdAt?: string;
}

export interface CreateScheduleEntryPayload {
  workOrderId: string;
  startAt: string;
  durationMinutes: number;
  technicianId?: string | null;
  notes?: string;
}

export interface UpdateScheduleEntryPayload {
  startAt?: string;
  durationMinutes?: number;
  technicianId?: string | null;
  notes?: string;
  status?: "scheduled" | "cancelled";
}

/** GET /api/scheduler */
export async function fetchScheduleEntries(params: {
  start: string;
  end: string;
  technicianId?: string;
}): Promise<ScheduleEntry[]> {
  const q = new URLSearchParams();
  q.set("start", params.start);
  q.set("end", params.end);
  if (params.technicianId) q.set("technicianId", params.technicianId);
  const url = `/scheduler?${q.toString()}`;
  const raw = await http<ScheduleEntry[]>(url);
  return Array.isArray(raw) ? raw : [];
}

/** GET /api/scheduler/unscheduled-work-orders */
export async function fetchUnscheduledWorkOrders(params?: {
  search?: string;
  limit?: number;
}): Promise<UnscheduledWorkOrder[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  const url = q.toString() ? `/scheduler/unscheduled-work-orders?${q.toString()}` : "/scheduler/unscheduled-work-orders";
  const raw = await http<UnscheduledWorkOrder[]>(url);
  return Array.isArray(raw) ? raw : [];
}

/** GET /api/scheduler/work-order/:workOrderId */
export async function fetchScheduleEntryByWorkOrder(
  workOrderId: string
): Promise<ScheduleEntry | null> {
  try {
    return await http<ScheduleEntry>(`/scheduler/work-order/${workOrderId}`);
  } catch {
    return null;
  }
}

/** POST /api/scheduler */
export async function createScheduleEntry(
  payload: CreateScheduleEntryPayload
): Promise<ScheduleEntry> {
  return http<ScheduleEntry>("/scheduler", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** PATCH /api/scheduler/:id */
export async function updateScheduleEntry(
  id: string,
  payload: UpdateScheduleEntryPayload
): Promise<ScheduleEntry> {
  return http<ScheduleEntry>(`/scheduler/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** DELETE /api/scheduler/:id (soft delete: sets status to cancelled) */
export async function deleteScheduleEntry(id: string): Promise<ScheduleEntry> {
  return http<ScheduleEntry>(`/scheduler/${id}`, {
    method: "DELETE",
  });
}
