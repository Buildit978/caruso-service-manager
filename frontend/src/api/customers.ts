// src/api/customers.ts
import api from "./client";
import type { Customer } from "../types/customer";

export type CustomerPayload = {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
};

export async function fetchCustomers(): Promise<Customer[]> {
    const res = await api.get<Customer[]>("/customers");
    return res.data;
}

export async function fetchCustomer(id: string): Promise<Customer> {
    const res = await api.get<Customer>(`/customers/${id}`);
    return res.data;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
    const res = await api.post<Customer>("/customers", payload);
    return res.data;
}

export async function updateCustomer(
    id: string,
    payload: Partial<CustomerPayload>
): Promise<Customer> {
    const res = await api.put<Customer>(`/customers/${id}`, payload);
    return res.data;
}

export async function deleteCustomer(id: string): Promise<void> {
    await api.delete(`/customers/${id}`);
}
