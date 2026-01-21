// backend/src/utils/customerRedaction.ts
// Redacts customer PII based on actor role

import type { ICustomer } from "../models/customer.model";

type ActorRole = "owner" | "manager" | "technician";

/**
 * Redacts PII from customer data for technicians.
 * Owners and managers see full data.
 *
 * Allowed for technicians:
 * - _id
 * - firstName, lastName, fullName
 * - Basic identifiers
 *
 * Redacted for technicians:
 * - phone
 * - email
 * - address
 * - notes
 */
export function sanitizeCustomerForActor(
  customer: any,
  actorRole: ActorRole
): any {
  if (!customer) return customer;

  // Owners and managers see full data
  if (actorRole === "owner" || actorRole === "manager") {
    return customer;
  }

  // Technicians get redacted version
  const sanitized = { ...customer };

  // Remove PII fields
  delete sanitized.phone;
  delete sanitized.email;
  delete sanitized.address;
  delete sanitized.notes;

  return sanitized;
}

/**
 * Redacts PII from array of customers for technicians.
 */
export function sanitizeCustomersForActor(
  customers: any[],
  actorRole: ActorRole
): any[] {
  return customers.map((customer) => sanitizeCustomerForActor(customer, actorRole));
}
