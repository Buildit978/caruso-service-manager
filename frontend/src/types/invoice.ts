//frontend/src/types/invoice.ts
import type { WorkOrderLineItem, WorkOrderVehicle } from "./workOrder";
import type { Customer } from "./customer";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type FinancialStatus = "paid" | "partial" | "due";

export interface InvoiceLineItem {
  type?: WorkOrderLineItem["type"];
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceCustomerSnapshot {
  customerId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type InvoiceEmailStatus = "never_sent" | "sending" | "sent" | "failed";

export type InvoiceEmailMeta = {
  status: InvoiceEmailStatus;
  lastTo?: string;
  lastSentAt?: string;
  lastMessageId?: string;
  lastError?: string;
  attempts?: number;
};

export interface Invoice {
  _id: string;
  invoiceNumber: string;

  // lifecycle
  status: InvoiceStatus;

  // ✅ canonical financial truth (from backend)
  financialStatus: FinancialStatus;
  paidAmount: number;
  balanceDue: number;

  workOrderId: string | { _id: string };
  customerSnapshot: InvoiceCustomerSnapshot;
  vehicleSnapshot?: WorkOrderVehicle;

  issueDate: string;
  dueDate?: string;

  lineItems: InvoiceLineItem[];

  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  notes?: string;

  createdAt?: string;
  updatedAt?: string;

  // optional populated helpers
  workOrder?: {
    _id: string;
    status: string;
  };
  customer?: Customer;
  email?: InvoiceEmailMeta;
}
