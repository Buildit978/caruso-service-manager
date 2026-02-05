// frontend/src/types/workOrderMessage.ts

export interface WorkOrderMessage {
  _id: string;
  workOrderId: string;
  accountId: string;
  body: string;
  channel: "internal" | "customer"; // legacy, kept for backward compat
  visibility?: "internal" | "customer"; // new field, preferred
  actor: {
    _id?: string;
    id?: string;
    nameSnapshot: string;
    roleSnapshot: "owner" | "manager" | "technician";
    email?: string;
  };
  meta?: {
    ip?: string;
    userAgent?: string;
  };
  createdAt: string; // ISO date string
}
