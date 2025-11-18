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
    total?: number;
    createdAt: string;
    date?: string;
    odometer?: number;
    complaint?: string;
    diagnosis?: string;

    // vehicle snapshot
    vehicle?: WorkOrderVehicle;

    notes?: string;

    // normalized: separate customerId + optional populated customer
    customerId?: string | Customer;
    customer?: Customer;
}
