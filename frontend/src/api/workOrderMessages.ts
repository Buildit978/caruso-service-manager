// frontend/src/api/workOrderMessages.ts
import { http } from "./http";
import type { WorkOrderMessage } from "../types/workOrderMessage";

export interface WorkOrderMessagesResponse {
  items: WorkOrderMessage[];
}

export interface PostMessagePayload {
  body: string;
  channel?: "internal" | "customer"; // legacy, kept for backward compat
  visibility?: "internal" | "customer"; // new field, preferred
}

export interface PostMessageResponse {
  item: WorkOrderMessage;
}

/**
 * Fetch all messages for a work order
 * GET /api/work-orders/:workOrderId/messages
 */
export async function fetchWorkOrderMessages(
  workOrderId: string
): Promise<WorkOrderMessage[]> {
  const response = await http<WorkOrderMessagesResponse>(
    `/work-orders/${workOrderId}/messages`
  );
  return response.items || [];
}

/**
 * Post a new message to a work order
 * POST /api/work-orders/:workOrderId/messages
 */
export async function postWorkOrderMessage(
  workOrderId: string,
  payload: PostMessagePayload
): Promise<WorkOrderMessage> {
  const response = await http<PostMessageResponse>(
    `/work-orders/${workOrderId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return response.item;
}
