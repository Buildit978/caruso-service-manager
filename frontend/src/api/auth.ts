// frontend/src/api/auth.ts
import { http } from "./http";

export interface LoginRequest {
  email: string;
  password: string;
  shopCode?: string;
}

export interface RegisterRequest {
  shopName: string;
  ownerName: string;
  email: string;
  password: string;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    role: "owner" | "manager" | "technician";
    accountId: string;
  };
  mustChangePassword?: boolean;
}

/** Current user shape (from GET /auth/me and PATCH /users/me) */
export interface MeUser {
  id: string;
  role: "owner" | "manager" | "technician";
  accountId: string;
  name: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

export interface MeResponse {
  user: MeUser;
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

export interface ChangePasswordRequest {
  newPassword: string;
  currentPassword?: string;
}

export interface ChangePasswordResponse {
  ok: true;
  token: string;
  mustChangePassword: false;
}

/**
 * Change password (PATCH /auth/password).
 * Supports both flows: forced (no currentPassword) and voluntary (currentPassword required).
 */
export async function changePassword(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  return http<ChangePasswordResponse>("/auth/password", {
    method: "PATCH",
    body: JSON.stringify(request),
  });
}

/**
 * Legacy change password (POST /auth/change-password).
 * Kept for compatibility; prefer changePassword() which uses PATCH /auth/password.
 */
export async function changePasswordLegacy(request: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  return http<ChangePasswordResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export interface ForgotPasswordRequest {
  email: string;
  shopCode: string;
}

export interface ForgotPasswordResponse {
  ok: true;
}

/**
 * Request password reset email (owner only). Always returns 200; no user enumeration.
 */
export async function forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  return http<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export interface ResetPasswordRequest {
  token: string;
  shopCode: string;
  newPassword: string;
}

/**
 * Reset password with token from email. Returns JWT for auto-login.
 */
export async function resetPassword(request: ResetPasswordRequest): Promise<ChangePasswordResponse> {
  return http<ChangePasswordResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
