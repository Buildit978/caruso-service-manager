// frontend/src/api/http.ts
// Centralized HTTP client with JWT token handling

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "csm_token";
const MUST_CHANGE_PASSWORD_KEY = "csm_must_change_password";

export interface HttpError extends Error {
  status: number;
  data?: unknown;
}

/**
 * Get stored JWT token from localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store JWT token in localStorage
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear stored JWT token
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
}

/**
 * Store mustChangePassword flag
 */
export function setMustChangePassword(value: boolean): void {
  if (value) {
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "true");
  } else {
    localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  }
}

/**
 * Get mustChangePassword flag
 */
export function getMustChangePassword(): boolean {
  return localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "true";
}

/**
 * Centralized HTTP client that:
 * - Automatically includes x-auth-token header
 * - Handles JSON in/out
 * - Throws typed errors on non-2xx
 * - Auto-clears token on 401/403
 */
export async function http<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["x-auth-token"] = token;
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle auth errors
  // 401 = unauthenticated (clear token)
  // 403 = authenticated but forbidden (keep token, user is valid but lacks permission)
  if (response.status === 401) {
    clearToken();
    const error: HttpError = new Error("Unauthorized") as HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  if (response.status === 403) {
    const error: HttpError = new Error("Forbidden") as HttpError;
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
    const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  // Handle empty responses (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch a binary response (e.g., PDF) with authentication headers
 * Returns a Blob that can be used to create a Blob URL
 */
export async function httpBlob(path: string): Promise<Blob> {
  const token = getToken();

  const headers: Record<string, string> = {};

  if (token) {
    headers["x-auth-token"] = token;
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    headers,
  });

  // Handle auth errors
  if (response.status === 401) {
    clearToken();
    const error: HttpError = new Error("Unauthorized") as HttpError;
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
    const error: HttpError = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore JSON parse errors
    }
    throw error;
  }

  return response.blob();
}
