// frontend/src/api/estimates.ts
import { http } from "./http";

export type EstimateView = "drafts" | "open" | "all";

export type EstimateStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "approved"
  | "partially_approved"
  | "declined"
  | "expired";

export interface EstimateLineItem {
  type?: "labour" | "part" | "service";
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  approved?: boolean;
}

export interface Estimate {
  _id: string;
  accountId: string;
  estimateNumber: string;
  kind?: "client" | "non_client";
  customerId?: string | { _id: string; firstName?: string; lastName?: string };
  vehicleId?: string | { _id: string; year?: number; make?: string; model?: string; licensePlate?: string; vin?: string };
  nonClient?: {
    name?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    vehicle?: { year?: number; make?: string; model?: string };
  };
  items: EstimateLineItem[];
  status: EstimateStatus;
  convertedToWorkOrderId?: string;
  internalNotes?: string;
  customerNotes?: string;
  taxRate?: number;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FetchEstimatesOptions {
  view?: EstimateView;
  customerId?: string;
  q?: string;
  limit?: number;
  skip?: number;
  sort?: "createdAt_desc" | "createdAt_asc";
}

export interface FetchEstimatesResponse {
  view: EstimateView;
  q?: string;
  paging: { skip: number; limit: number; returned: number; total: number };
  items: Estimate[];
}

export async function fetchEstimates(
  options: FetchEstimatesOptions = {}
): Promise<FetchEstimatesResponse> {
  const params = new URLSearchParams();

  if (options.view) params.set("view", options.view);
  if (options.customerId) params.set("customerId", options.customerId);
  if (options.q && options.q.trim()) params.set("q", options.q.trim());
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.skip != null) params.set("skip", String(options.skip));
  if (options.sort) params.set("sort", options.sort);

  const query = params.toString();
  const url = query ? `/estimates?${query}` : "/estimates";

  return await http<FetchEstimatesResponse>(url);
}

/**
 * Get estimates for a specific customer.
 * Hits: GET /api/estimates?customerId=...
 */
export async function fetchEstimate(id: string): Promise<Estimate> {
  return await http<Estimate>(`/estimates/${id}`);
}

export async function getCustomerEstimates(
  customerId: string
): Promise<Estimate[]> {
  const res = await fetchEstimates({
    customerId,
    view: "all",
    limit: 100,
    sort: "createdAt_desc",
  });
  return res.items ?? [];
}

export interface UpdateEstimatePayload {
  internalNotes?: string;
  customerNotes?: string;
  vehicleId?: string | null;
  nonClient?: {
    name?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    vehicle?: { year?: number; make?: string; model?: string };
  };
  items?: EstimateLineItem[];
}

export async function updateEstimate(
  id: string,
  payload: UpdateEstimatePayload
): Promise<Estimate> {
  return await http<Estimate>(`/estimates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createEstimate(
  payload: { customerId: string }
): Promise<Estimate> {
  return await http<Estimate>("/estimates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createNonClientEstimate(): Promise<Estimate> {
  return await http<Estimate>("/estimates", {
    method: "POST",
    body: JSON.stringify({ kind: "non_client" }),
  });
}

export async function sendEstimate(id: string): Promise<Estimate> {
  return await http<Estimate>(`/estimates/${id}/send`, {
    method: "POST",
  });
}

export async function resendEstimate(id: string): Promise<Estimate> {
  return await http<Estimate>(`/estimates/${id}/resend`, {
    method: "POST",
  });
}

export async function approveEstimate(id: string): Promise<{ estimate: Estimate }> {
  return await http<{ estimate: Estimate }>(`/estimates/${id}/approve`, {
    method: "POST",
  });
}

export async function convertEstimateToWorkOrder(id: string): Promise<{
  estimate: Estimate;
  workOrder: { _id: string; [key: string]: unknown };
}> {
  return await http<{ estimate: Estimate; workOrder: any }>(
    `/estimates/${id}/convert`,
    {
      method: "POST",
    }
  );
}
