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


