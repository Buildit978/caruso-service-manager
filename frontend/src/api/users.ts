// frontend/src/api/users.ts
import { http } from "./http";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  name: string; // legacy / convenience
  role: "owner" | "manager" | "technician";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  role: "manager" | "technician";
  password?: string;
}

export interface CreateUserResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    name: string;
    role: "manager" | "technician";
  };
  tempPassword: string;
}

export interface ListUsersResponse {
  users: User[];
}

export interface DeactivateUserResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    name: string;
    role: "owner" | "manager" | "technician";
    isActive: boolean;
  };
}

export interface ResetPasswordResponse {
  tempPassword: string;
}

export interface ReactivateUserResponse {
  tempPassword: string;
}

/**
 * List all users for the current account (owner/manager only)
 */
export async function listUsers(): Promise<ListUsersResponse> {
  return http<ListUsersResponse>("/users");
}

/**
 * Create a new user (owner/manager only)
 * V1 Rules:
 * - Owner: can create managers and technicians
 * - Manager: can create technicians ONLY
 */
export async function createUser(payload: CreateUserRequest): Promise<CreateUserResponse> {
  return http<CreateUserResponse>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Deactivate a user (owner/manager only)
 * V1 Rules:
 * - Owner: can deactivate managers and technicians
 * - Manager: can deactivate technicians ONLY
 * - Cannot deactivate owners
 */
export async function deactivateUser(userId: string): Promise<DeactivateUserResponse> {
  return http<DeactivateUserResponse>(`/users/${userId}/deactivate`, {
    method: "PATCH",
  });
}

export async function resetUserPassword(userId: string): Promise<ResetPasswordResponse> {
  return http<ResetPasswordResponse>(`/users/${userId}/reset-password`, {
    method: "POST",
  });
}

/**
 * Reactivate a deactivated user (owner only)
 * Returns a new temporary password
 */
export async function reactivateUser(userId: string): Promise<ReactivateUserResponse> {
  return http<ReactivateUserResponse>(`/users/${userId}/reactivate`, {
    method: "POST",
  });
}
