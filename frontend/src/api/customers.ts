// src/api/customers.ts
import api from './client';
import type { Customer } from '../types/api';

export async function fetchCustomers(): Promise<Customer[]> {
    const res = await api.get<Customer[]>('/customers');
    return res.data;
}
