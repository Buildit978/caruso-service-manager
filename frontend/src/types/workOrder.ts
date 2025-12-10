// frontend/src/types/workOrder.ts
import type { Customer } from "./customer";

export type WorkOrderStatus = "open" | "in_progress" | "completed" | "invoiced";

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
    invoiceId?: string; 

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
