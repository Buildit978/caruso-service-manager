// frontend/src/types/invoice.ts
import type { WorkOrderLineItem, WorkOrderVehicle } from "./workOrder";
import type { Customer } from "./customer";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceLineItem {
  type?: WorkOrderLineItem["type"];
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

// Snapshot of customer at the time of invoicing
export interface InvoiceCustomerSnapshot {
  customerId: string;               // for linking back if needed
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

// Main Invoice type
export interface Invoice {
  _id: string;
  invoiceNumber: string;            // human-visible number, e.g. "1001" or "2025-001"
  status: InvoiceStatus;

  workOrderId: string;
  customerSnapshot: InvoiceCustomerSnapshot;
  vehicleSnapshot?: WorkOrderVehicle;

  issueDate: string;                // ISO strings
  dueDate?: string;

  lineItems: InvoiceLineItem[];

  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  notes?: string;

  createdAt?: string;
  updatedAt?: string;

  // Optional population for UI niceness later (not required by backend)
  workOrder?: {
    _id: string;
    status: string;
  };
  customer?: Customer;
}
