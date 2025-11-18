// src/api/vehicles.ts
import api from "./client";

export interface Vehicle {
    _id: string;
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
    licensePlate?: string;
    color?: string;
    notes?: string;
}

// Payload to add a new vehicle (no _id coming from the client)
export type NewVehiclePayload = Omit<Vehicle, "_id">;

// Get all vehicles for a specific customer
export async function getCustomerVehicles(
    customerId: string
): Promise<Vehicle[]> {
    const res = await api.get(`/customers/${customerId}/vehicles`);
    return res.data;
}

// Add a vehicle to a specific customer
export async function addCustomerVehicle(
    customerId: string,
    data: NewVehiclePayload
): Promise<Vehicle> {
    const res = await api.post(`/customers/${customerId}/vehicles`, data);
    return res.data;
}

// Update existing vehicle for a customer
export async function updateCustomerVehicle(
    customerId: string,
    vehicleId: string,
    data: Partial<NewVehiclePayload>
): Promise<Vehicle> {
    const res = await api.patch(
        `/customers/${customerId}/vehicles/${vehicleId}`,
        data
    );
    return res.data;
}

// Delete a vehicle from a customer
export async function deleteCustomerVehicle(
    customerId: string,
    vehicleId: string
): Promise<void> {
    await api.delete(`/customers/${customerId}/vehicles/${vehicleId}`);
}
