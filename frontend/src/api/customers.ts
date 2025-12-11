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

export type CustomerSortBy = "name" | "createdAt";
export type SortDir = "asc" | "desc";

interface FetchCustomersOptions {
  search?: string;
  sortBy?: CustomerSortBy;
  sortDir?: SortDir;
}

export async function fetchCustomers(
  options: FetchCustomersOptions = {}
): Promise<Customer[]> {
  const params = new URLSearchParams();

  if (options.search && options.search.trim() !== "") {
    params.set("search", options.search.trim());
  }
  if (options.sortBy) {
    params.set("sortBy", options.sortBy);
  }
  if (options.sortDir) {
    params.set("sortDir", options.sortDir);
  }

  const query = params.toString();
  const url = query ? `/customers?${query}` : "/customers";

  const res = await api.get<Customer[]>(url);
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
