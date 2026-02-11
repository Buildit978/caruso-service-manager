// src/api/customers.ts
import { http, type HttpError } from "./http";
import { setBillingLocked, isBillingLockedResponse } from "../state/billingLock";
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

export type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

/**
 * Export customers as CSV
 * Returns a Blob and optional filename from Content-Disposition header
 */
export async function exportCustomers(): Promise<{ blob: Blob; filename?: string }> {
  const { getToken } = await import("./http");
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers["x-auth-token"] = token;
  }

  const url = `${API_BASE_URL}/customers/export`;
  const response = await fetch(url, {
    headers,
  });

  // Handle auth errors
  if (response.status === 401) {
    (await import("./http")).clearToken();
    const error: import("./http").HttpError = new Error("Unauthorized") as import("./http").HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  if (response.status === 403) {
    const error: import("./http").HttpError = new Error("Forbidden") as import("./http").HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  // Handle other non-2xx errors
  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    if (isBillingLockedResponse(response.status, data)) {
      setBillingLocked((data as { message?: string; billingStatus?: string; graceEndsAt?: string | null; currentPeriodEnd?: string | null }) ?? {});
    }
    const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  const blob = await response.blob();
  
  // Parse filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename: string | undefined;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, "");
    }
  }

  return { blob, filename };
}

/**
 * Import customers from CSV file
 */
export async function importCustomers(file: File): Promise<ImportSummary> {
  const token = (await import("./http")).getToken();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["x-auth-token"] = token;
  }

  const url = `${API_BASE_URL}/customers/import`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  // Handle auth errors
  if (response.status === 401) {
    (await import("./http")).clearToken();
    const error: import("./http").HttpError = new Error("Unauthorized") as import("./http").HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  if (response.status === 403) {
    const error: import("./http").HttpError = new Error("Forbidden") as import("./http").HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  // Handle other non-2xx errors
  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    if (isBillingLockedResponse(response.status, data)) {
      setBillingLocked((data as { message?: string; billingStatus?: string; graceEndsAt?: string | null; currentPeriodEnd?: string | null }) ?? {});
    }
    const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return response.json() as Promise<ImportSummary>;
}
