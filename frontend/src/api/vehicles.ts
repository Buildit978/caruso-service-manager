// src/api/vehicles.ts
import api from "./client";

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
  const res = await api.get("/vehicles", {
    params: { customerId },
  });
  return res.data;
}

/**
 * Create a new vehicle (used by the inline form on Create Work Order)
 * Hits: POST /api/vehicles
 */
export async function createVehicle(
  payload: NewVehiclePayload
): Promise<Vehicle> {
  const res = await api.post("/vehicles", payload);
  return res.data;
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
  const res = await api.patch(`/vehicles/${vehicleId}`, data);
  return res.data;
}

/**
 * Delete a vehicle.
 * Same note as above: customerId is kept for backwards compatibility.
 */
export async function deleteCustomerVehicle(
  _customerId: string,
  vehicleId: string
): Promise<void> {
  await api.delete(`/vehicles/${vehicleId}`);
}
