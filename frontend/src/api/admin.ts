// Admin API client: uses localStorage adminToken, only /api/admin/*

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_ROLE_KEY = "adminRole";

export type AdminRole = "admin" | "superadmin";

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_ROLE_KEY);
}

export function getAdminRole(): AdminRole | null {
  const r = localStorage.getItem(ADMIN_ROLE_KEY);
  if (r === "admin" || r === "superadmin") return r;
  return null;
}

export function setAdminRole(role: AdminRole): void {
  localStorage.setItem(ADMIN_ROLE_KEY, role);
}

export function clearAdminRole(): void {
  localStorage.removeItem(ADMIN_ROLE_KEY);
}

/** POST /api/admin/auth/login for admin gate; stores token in admin_token only (does not touch tenant token). Returns { token, adminUser } or throws. */
export interface AdminLoginResponse {
  token: string;
  adminUser: { id: string; email: string; name: string; role: string; accountId: string };
}
export async function adminLogin(credentials: { email: string; password: string }): Promise<AdminLoginResponse> {
  const url = `${API_BASE_URL}/admin/auth/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const err: HttpError = new Error(`Login failed: ${res.status}`) as HttpError;
    err.status = res.status;
    try {
      err.data = await res.json();
    } catch {
      // ignore
    }
    throw err;
  }
  return res.json() as Promise<AdminLoginResponse>;
}

export interface HttpError extends Error {
  status: number;
  data?: unknown;
}

/** GET /api/admin/me — current admin (id, email, name, role). Requires token. */
export interface AdminMeResponse {
  id: string;
  email: string;
  name: string;
  role: string;
}
export async function fetchAdminMe(): Promise<AdminMeResponse> {
  return adminFetch<AdminMeResponse>("/me");
}

async function adminFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  if (!token) {
    const err: HttpError = new Error("No admin token") as HttpError;
    err.status = 401;
    throw err;
  }
  const url = path.startsWith("http") ? path : `${API_BASE_URL}/admin${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-auth-token": token,
    ...(options.headers as Record<string, string>),
  };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    clearAdminToken();
    const error: HttpError = new Error(response.status === 401 ? "Unauthorized" : "Forbidden") as HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore
    }
    throw error;
  }
  if (!response.ok) {
    const error: HttpError = new Error(`HTTP ${response.status}`) as HttpError;
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      // ignore
    }
    throw error;
  }
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null as T;
  }
  return response.json() as Promise<T>;
}

// --- Types (minimal, matching backend) ---

export interface AdminOverview {
  range: { days: number; since: string };
  accounts: { total: number; active: number; inactive: number };
  events: { total: number; byType: Array<{ type: string; count: number }> };
}

export interface AdminAccountItem {
  accountId: string;
  name: string;
  slug: string;
  shopName?: string;
  shopCode?: string;
  region?: "Canada" | "TT";
  isActive: boolean;
  createdAt: string;
  lastActiveAt?: string;
  isNew?: boolean;
  primaryOwnerDisplayName?: string;
  primaryOwner?: { name: string; email?: string; phone?: string };
  address?: string;
  seats?: {
    owner: number;
    manager: number;
    technician: number;
    total: number;
  };
  counts: { workOrders: number; invoices: number; customers: number; users: number };
}

export interface AdminAccountUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "technician";
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AdminAccountUsersResponse {
  items: AdminAccountUser[];
}

export interface AdminAccountsResponse {
  range: { days: number; since: string };
  region: string;
  status?: string;
  q?: string;
  paging: { skip: number; limit: number; returned: number; total: number };
  items: AdminAccountItem[];
}

export interface AdminAuditItem {
  _id: string;
  accountId: string;
  action: string;
  createdAt: string;
  actorId: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
}

export interface AdminAuditsResponse {
  paging: { skip: number; limit: number; returned: number };
  items: AdminAuditItem[];
}

export function fetchAdminOverview(params?: { days?: number }): Promise<AdminOverview> {
  const q = params?.days != null ? `?days=${params.days}` : "";
  return adminFetch<AdminOverview>(`/beta/overview${q}`);
}

export function fetchAdminAccounts(params?: {
  days?: number;
  region?: string;
  status?: string;
  q?: string;
  limit?: number;
  skip?: number;
  sort?: string;
  newOnly?: boolean;
  newDays?: number;
}): Promise<AdminAccountsResponse> {
  const sp = new URLSearchParams();
  if (params?.days != null) sp.set("days", String(params.days));
  if (params?.region != null) sp.set("region", params.region);
  if (params?.status != null) sp.set("status", params.status);
  if (params?.q != null && params.q !== "") sp.set("q", params.q);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.skip != null) sp.set("skip", String(params.skip));
  if (params?.sort != null && params.sort !== "") sp.set("sort", params.sort);
  if (params?.newOnly === true) sp.set("newOnly", "true");
  if (params?.newDays != null) sp.set("newDays", String(params.newDays));
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return adminFetch<AdminAccountsResponse>(`/beta/accounts${query}`);
}

/** GET /api/admin/beta/accounts/:accountId — single account detail (same shape as list item + shopName, shopCode, primaryOwner). */
export function fetchAdminAccountById(accountId: string): Promise<AdminAccountItem> {
  return adminFetch<AdminAccountItem>(`/beta/accounts/${accountId}`);
}

/** GET /api/admin/accounts/:accountId/users?role=&isActive=&search= — tenant users for account overview. */
export function fetchAdminAccountUsers(
  accountId: string,
  params?: { role?: string; isActive?: boolean; search?: string }
): Promise<AdminAccountUsersResponse> {
  const sp = new URLSearchParams();
  if (params?.role != null && params.role !== "") sp.set("role", params.role);
  if (params?.isActive !== undefined) sp.set("isActive", String(params.isActive));
  if (params?.search != null && params.search !== "") sp.set("search", params.search);
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return adminFetch<AdminAccountUsersResponse>(`/accounts/${accountId}/users${query}`);
}

export function fetchAdminAudits(accountId: string, params?: { limit?: number; skip?: number }): Promise<AdminAuditsResponse> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.skip != null) sp.set("skip", String(params.skip));
  const q = sp.toString() ? `?${sp.toString()}` : "";
  return adminFetch<AdminAuditsResponse>(`/accounts/${accountId}/audits${q}`);
}

export function postQuarantine(accountId: string, body: { until: string; note?: string }): Promise<{ ok: boolean; accountId: string; quarantineUntil: string }> {
  return adminFetch<{ ok: boolean; accountId: string; quarantineUntil: string }>(
    `/accounts/${accountId}/security/quarantine`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function deleteQuarantine(accountId: string, body?: { note?: string }): Promise<{ ok: boolean; accountId: string; quarantineUntil: null }> {
  return adminFetch<{ ok: boolean; accountId: string; quarantineUntil: null }>(
    `/accounts/${accountId}/security/quarantine`,
    { method: "DELETE", body: body ? JSON.stringify(body) : undefined }
  );
}

export function postThrottle(accountId: string, body: { until: string; note?: string }): Promise<{ ok: boolean; accountId: string; throttleUntil: string }> {
  return adminFetch<{ ok: boolean; accountId: string; throttleUntil: string }>(
    `/accounts/${accountId}/security/throttle`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function deleteThrottle(accountId: string, body?: { note?: string }): Promise<{ ok: boolean; accountId: string; throttleUntil: null }> {
  return adminFetch<{ ok: boolean; accountId: string; throttleUntil: null }>(
    `/accounts/${accountId}/security/throttle`,
    { method: "DELETE", body: body ? JSON.stringify(body) : undefined }
  );
}

export function postForceLogout(accountId: string, body?: { note?: string }): Promise<{ ok: boolean; accountId: string; forcedAt: string }> {
  return adminFetch<{ ok: boolean; accountId: string; forcedAt: string }>(
    `/accounts/${accountId}/security/force-logout`,
    { method: "POST", body: body ? JSON.stringify(body) : undefined }
  );
}

// --- Admin users (governance, superadmin-only) ---

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: "admin" | "superadmin";
  createdAt?: string;
  isActive: boolean;
}

export interface AdminUsersResponse {
  items: AdminUserItem[];
}

export function fetchAdminUsers(): Promise<AdminUsersResponse> {
  return adminFetch<AdminUsersResponse>("/admin-users");
}

export function inviteAdminUser(body: { email: string; name?: string; role: "admin" | "superadmin" }): Promise<{ ok: boolean; userId: string; reinvite?: boolean }> {
  return adminFetch<{ ok: boolean; userId: string; reinvite?: boolean }>("/admin-users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resetAdminUserPassword(userId: string): Promise<{ ok: boolean; userId: string }> {
  return adminFetch<{ ok: boolean; userId: string }>(`/admin-users/${userId}/reset-password`, { method: "POST" });
}

export function updateAdminUserRole(userId: string, body: { role: "admin" | "superadmin" }): Promise<{ ok: boolean; userId: string; role: string }> {
  return adminFetch<{ ok: boolean; userId: string; role: string }>(`/admin-users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
