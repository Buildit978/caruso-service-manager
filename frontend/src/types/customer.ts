// frontend/src/types/customer.ts

export interface Customer {
    _id: string;
    firstName: string;
    lastName: string;
    name?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;

    openWorkOrdersCount?: number;
}
