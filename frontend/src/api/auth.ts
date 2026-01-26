// frontend/src/api/auth.ts
import { http } from "./http";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  shopName: string;
  ownerName: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    role: "owner" | "manager" | "technician";
    accountId: string;
  };
}

export interface MeResponse {
  user: {
    id: string;
    role: "owner" | "manager" | "technician";
    accountId: string;
    name: string;
    email: string;
  };
}

export interface ReactivateRequest {
  email: string;
  password: string;
}

/**
 * Register a new shop and owner account
 */
export async function register(credentials: RegisterRequest): Promise<LoginResponse> {
  return http<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

/**
 * Login with email and password
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return http<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

/**
 * Get current user info (requires authentication)
 */
export async function getMe(): Promise<MeResponse> {
  return http<MeResponse>("/auth/me");
}

/**
 * Reactivate an inactive account (public, owner-only)
 */
export async function reactivate(credentials: ReactivateRequest): Promise<LoginResponse> {
  return http<LoginResponse>("/auth/reactivate", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}
