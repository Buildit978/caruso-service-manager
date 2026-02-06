// src/api/vehicles.ts
import { http } from "./http";

/**
 * Vehicle as returned by the backend
 */
export interface Vehicle {
  _id: string;
  accountId: string;
  customerId: string;
  vin?: string;
  year?: number;
  make: string;                  // required – needed for parts/orders
  model: string;                 // required – needed for parts/orders
  licensePlate?: string;
  color?: string;
  notes?: string;
  currentOdometer?: number | null;
}

/**
 * Payload used when creating a new vehicle from the frontend.
 * accountId comes from the server; we just send customer + details.
 */
export interface NewVehiclePayload {
  customerId: string;
  vin?: string;
  year?: number | string;
  make: string;                  // required
  model: string;                 // required
  licensePlate?: string;
  color?: string;
  notes?: string;
  odometer?: number | string;    // seeds currentOdometer on create
}

/**
 * Get all vehicles for a specific customer
 * Hits: GET /api/vehicles?customerId=...
 */
export async function getCustomerVehicles(
  customerId: string
): Promise<Vehicle[]> {
  return await http<Vehicle[]>(`/vehicles?customerId=${encodeURIComponent(customerId)}`);
}

/**
 * Get all vehicles for the account (optionally filtered by search)
 * Hits: GET /api/vehicles?search=...
 */
export async function fetchAllVehicles(
  options: { search?: string } = {}
): Promise<Vehicle[]> {
  const params = new URLSearchParams();

  if (options.search && options.search.trim() !== "") {
    params.set("search", options.search.trim());
  }

  const query = params.toString();
  const url = query ? `/vehicles?${query}` : "/vehicles";

  return await http<Vehicle[]>(url);
}

/**
 * Create a new vehicle (used by the inline form on Create Work Order)
 * Hits: POST /api/vehicles
 */
export async function createVehicle(
  payload: NewVehiclePayload
): Promise<Vehicle> {
  return await http<Vehicle>("/vehicles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Legacy-style helpers (wrappers) to keep existing call sites happy.
 * These assume the newer /api/vehicles endpoints:
 *   POST   /api/vehicles
 *   PATCH  /api/vehicles/:vehicleId
 *   DELETE /api/vehicles/:vehicleId
 */

/**
 * Add a vehicle to a specific customer.
 * Under the hood this just calls createVehicle with customerId in the body.
 */
export async function addCustomerVehicle(
  customerId: string,
  data: Omit<NewVehiclePayload, "customerId">
): Promise<Vehicle> {
  return createVehicle({
    ...data,
    customerId,
  });
}

/**
 * Update an existing vehicle.
 * NOTE: customerId is not needed in the new route shape, but we keep the
 * signature to avoid breaking older code. It can be ignored by callers later.
 */
export async function updateCustomerVehicle(
  _customerId: string,
  vehicleId: string,
  data: Partial<NewVehiclePayload>
): Promise<Vehicle> {
  return await http<Vehicle>(`/vehicles/${vehicleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a vehicle.
 * Same note as above: customerId is kept for backwards compatibility.
 */
export async function deleteCustomerVehicle(
  _customerId: string,
  vehicleId: string
): Promise<void> {
  await http<void>(`/vehicles/${vehicleId}`, {
    method: "DELETE",
  });
}
export async function fetchVehicleById(id: string) {
  return await http<Vehicle>(`/vehicles/${id}`);
}
