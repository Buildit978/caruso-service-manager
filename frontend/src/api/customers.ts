// src/api/customers.ts
import { http } from "./http";
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

  return await http<Customer[]>(url);
}


export async function fetchCustomer(id: string): Promise<Customer> {
    return await http<Customer>(`/customers/${id}`);
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
    return await http<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateCustomer(
    id: string,
    payload: Partial<CustomerPayload>
): Promise<Customer> {
    return await http<Customer>(`/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export async function deleteCustomer(id: string): Promise<void> {
    await http<void>(`/customers/${id}`, {
        method: "DELETE",
    });
}

export async function fetchCustomerById(customerId: string) {
  return await http<any>(`/customers/${customerId}`);
}
