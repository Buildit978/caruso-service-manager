// src/types/api.ts

export type WorkOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface Customer {
    _id: string
    firstName: string
    lastName: string
    phone?: string
    email?: string
    vehicleMake?: string
    vehicleModel?: string
    vehicleYear?: number
    createdAt: string
    updatedAt: string
}

export interface WorkOrder {
    _id: string
    customerId: string
    description: string
    status: WorkOrderStatus
    totalAmount?: number
    createdAt: string
    updatedAt: string
}

// 🔴 This is the one the error is complaining about:
export interface WorkOrderSummary {
    totalCount: number
    byStatus: {
        status: WorkOrderStatus
        count: number
    }[]
    // add more fields later if your backend summary returns them
}

// whatever you use for base URL
const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export async function markWorkOrderComplete(id: string) {
    const res = await fetch(`${API}/work-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // use 'completed' to match what you're already seeing in the UI
        body: JSON.stringify({ status: 'completed' }),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to mark complete');
    }

    return res.json(); // this should be the updated work order
}

export async function getWorkOrderById(id: string) {
    const res = await fetch(`${API}/work-orders/${id}`);

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to load work order');
    }

    return res.json(); // this should be the single work order
}

export async function createInvoiceForWorkOrder(workOrderId: string) {
    const res = await fetch(`${API}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId }),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to create invoice');
    }

    return res.json(); // expect { invoiceNumber, ... } from backend
}
