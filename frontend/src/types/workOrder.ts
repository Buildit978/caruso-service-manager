// frontend/src/types/workOrder.ts
import type { Customer } from "./customer";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type WorkOrderStatus = "open" | "in_progress" | "completed" | "invoiced";
export type WorkOrderView = "active" | "financial" | "archive" | "all";

export interface WorkOrderVehicle {
    vehicleId?: string;
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
    licensePlate?: string;
    color?: string;
    notes?: string;
}

export interface WorkOrder {
    _id: string;
    status: WorkOrderStatus;
    createdAt: string;
    date?: string;
    odometer?: number;
    complaint?: string;
    diagnosis?: string;
  
  
  // In your WorkOrder type/interface:
    invoiceId?: string | WorkOrderInvoiceLite | null;
    invoice?: WorkOrderInvoiceLite; // optional if you normalize

    // vehicle snapshot
    vehicle?: WorkOrderVehicle;

    notes?: string;

    // normalized: separate customerId + optional populated customer
    customerId?: string | Customer;
    customer?: Customer;

    // pricing
    lineItems?: WorkOrderLineItem[];
    taxRate?: number;
    subtotal?: number;
    taxAmount?: number;
    total?: number;
}

export type WorkOrderLineItemType = "labour" | "part" | "service";

export interface WorkOrderLineItem {
  type?: WorkOrderLineItemType;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  rawQuantity?: string;    // for UI only
  rawUnitPrice?: string;   // for UI only
}

export type WorkOrderInvoiceLite = {
  _id: string;
  status?: InvoiceStatus;
  invoiceNumber?: string;
  sentAt?: string | null;
  paidAt?: string | null;
  voidedAt?: string | null;
  total?: number;
};

export type WorkOrderFilters = {
  // ✅ NEW
  view?: WorkOrderView;

  // existing filters (keep these)
  status?: string;        // legacy / optional
  customerId?: string;
  vehicleId?: string;
  fromDate?: string;
  toDate?: string;

  // sorting
  sortBy?: "createdAt" | "status";
  sortDir?: "asc" | "desc";
};
