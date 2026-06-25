const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const PARTNER_TOKEN_KEY = "partner_token";
const PARTNER_SETUP_TOKEN_KEY = "partner_password_setup_token";
const PARTNER_SETUP_EMAIL_KEY = "partner_password_setup_email";

export interface HttpError extends Error {
  status: number;
  data?: unknown;
}

export type HealthStatus = "healthy" | "attention_needed" | "stale";
export type RelationshipLifecycleStatus = "new" | "protected" | "connected" | "engaged";
export type PartnerVisitType =
  | "walkIn"
  | "phone"
  | "email"
  | "textWhatsApp"
  | "demo"
  | "followUp"
  | "referral"
  | "other";

/** @deprecated Use visitType on interaction payloads. */
export type PartnerNoteType = "call" | "email" | "walkIn" | "meeting" | "demo" | "followUp";

/** @deprecated Use PartnerVisitType. */
export const PARTNER_NOTE_TYPE_OPTIONS: PartnerNoteType[] = [
  "call",
  "email",
  "walkIn",
  "meeting",
  "demo",
  "followUp",
];

export interface PartnerInteractionPayload {
  visitType?: PartnerVisitType;
  summary: string;
  activityDate?: string;
  activityTime?: string;
  primaryContact?: string;
  duration?: string;
  interestLevel?: string;
  isMeaningful?: boolean;
  followUpDate?: string;
  nextFollowUpDate?: string;
  /** Legacy */
  type?: PartnerNoteType;
}

export interface PartnerInteractionAmendment {
  text: string;
  createdAt?: string;
  createdBy?: string;
}

export interface PartnerInteraction {
  id: string;
  type: string;
  summary: string;
  isMeaningful?: boolean;
  activityDate?: string;
  activityTime?: string;
  primaryContact?: string;
  visitType?: PartnerVisitType | string;
  duration?: string;
  interestLevel?: string;
  followUpDate?: string;
  amendments?: PartnerInteractionAmendment[];
  createdAt?: string;
}

export interface PartnerPortalAccess {
  status: "enabled" | "disabled";
  enabledAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
}

export interface PartnerLoginResponse {
  token?: string;
  passwordSetupToken?: string;
  partner: { id: string; name: string; email: string };
  mustChangePassword?: boolean;
}

export interface PartnerSetPasswordResponse {
  ok: true;
  token: string;
  partner: { id: string; name: string; email: string };
  mustChangePassword: false;
}

export interface PartnerMe {
  id: string;
  name: string;
  email: string;
  portalAccess: PartnerPortalAccess;
  lastPortalLoginAt?: string;
  stewardedBusinessCount: number;
}

export interface PartnerDashboard {
  partner: {
    id: string;
    name: string;
    email: string;
    portalAccess: PartnerPortalAccess;
    lastPortalLoginAt?: string;
  };
  stewardedBusinessCount: number;
  attentionNeededCount: number;
  recentActivityCount: number;
  recentActivity: Array<{
    type: "interaction";
    noteType: string;
    visitType?: string;
    at?: string;
    summary: string;
    primaryContact?: string;
    prospectId?: string;
    businessName?: string;
  }>;
}

export type PartnerRelationshipStage = "introduced" | "conversation" | "meaningfulConversation";

export const PARTNER_RELATIONSHIP_STAGE_LABELS: Record<PartnerRelationshipStage, string> = {
  introduced: "Introduced",
  conversation: "In conversation",
  meaningfulConversation: "Meaningful conversation",
};

export interface PartnerDuplicateMatch {
  prospectId: string;
  businessName: string;
  email?: string;
  phone?: string;
  website?: string;
  status: string;
  matchedOn: string[];
  confidence: "high" | "medium";
}

export interface PartnerIntroductionListItem {
  prospectId: string;
  businessName: string;
  contactName?: string;
  stage: PartnerRelationshipStage;
  isStewarding: boolean;
  introducedAt?: string;
  stageUpdatedAt?: string;
  firstContactDate?: string;
  lastVisitDate?: string;
  nextFollowUpDate?: string;
  lastActivityAt?: string;
  lastMeaningfulConversation: { summary: string; at?: string } | null;
}

export interface PartnerIntroductionDetail {
  business: PartnerBusinessDetail["business"];
  relationship: {
    stage: PartnerRelationshipStage;
    introducedAt?: string;
    stageUpdatedAt?: string;
    firstContactDate?: string;
    lastVisitDate?: string;
    nextFollowUpDate?: string;
    isStewarding: boolean;
  };
  lastMeaningfulConversation: PartnerInteraction | null;
  notes: PartnerInteraction[];
}

export interface PartnerIntroductionCreateResponse {
  business: PartnerIntroductionDetail["business"];
  relationship: PartnerIntroductionDetail["relationship"];
  note: PartnerInteraction;
  possibleDuplicates: PartnerDuplicateMatch[];
}

export interface PartnerBusinessListItem {
  prospectId: string;
  protectionId: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  location?: string;
  prospectStatus?: string;
  protectionStatus: string;
  lifecycleStatus: RelationshipLifecycleStatus;
  lastActivityAt?: string | null;
  healthStatus?: HealthStatus | null;
  daysSinceLastActivity?: number | null;
}

export interface PartnerBusinessDetail {
  business: {
    id: string;
    businessName: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    location?: string;
    notes?: string;
    status: string;
    createdAt?: string;
    updatedAt?: string;
  };
  relationship: {
    id: string;
    introducedAt?: string;
    protectionStatus: string;
    lifecycleStatus: RelationshipLifecycleStatus;
    evidenceSummary: string;
    approvedAt?: string;
    lastActivityAt?: string | null;
    relationshipAgeDays?: number | null;
    daysSinceLastActivity?: number | null;
    healthStatus?: HealthStatus | null;
    createdAt?: string;
    updatedAt?: string;
  };
  notes: PartnerInteraction[];
}

export function getPartnerToken(): string | null {
  const raw = localStorage.getItem(PARTNER_TOKEN_KEY);
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function setPartnerToken(token: string): void {
  localStorage.setItem(PARTNER_TOKEN_KEY, token.trim());
}

export function clearPartnerToken(): void {
  localStorage.removeItem(PARTNER_TOKEN_KEY);
}

export function getPartnerPasswordSetupToken(): string | null {
  const raw = sessionStorage.getItem(PARTNER_SETUP_TOKEN_KEY);
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function setPartnerPasswordSetupToken(token: string): void {
  sessionStorage.setItem(PARTNER_SETUP_TOKEN_KEY, token.trim());
}

export function setPartnerPasswordSetupEmail(email: string): void {
  sessionStorage.setItem(PARTNER_SETUP_EMAIL_KEY, email.trim().toLowerCase());
}

export function getPartnerPasswordSetupEmail(): string | null {
  const raw = sessionStorage.getItem(PARTNER_SETUP_EMAIL_KEY);
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function clearPartnerPasswordSetupToken(): void {
  sessionStorage.removeItem(PARTNER_SETUP_TOKEN_KEY);
  sessionStorage.removeItem(PARTNER_SETUP_EMAIL_KEY);
}

export function isPartnerUnauthorized(err: unknown): boolean {
  return (
    err != null &&
    typeof err === "object" &&
    "status" in err &&
    ((err as HttpError).status === 401 || (err as HttpError).status === 403)
  );
}

export function partnerApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const data =
    err && typeof err === "object" && "data" in err
      ? (err as { data?: { message?: string } }).data
      : undefined;
  if (data?.message) return data.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return fallback;
}

export async function partnerFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPartnerToken();
  if (!token) {
    const err: HttpError = new Error("No partner token") as HttpError;
    err.status = 401;
    throw err;
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}/partner${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-auth-token": token,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    clearPartnerToken();
    const error: HttpError = new Error(
      (data as { message?: string })?.message ??
        (response.status === 401 ? "Unauthorized" : "Partner access unavailable")
    ) as HttpError;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    const error: HttpError = new Error(
      (data as { message?: string })?.message ?? `HTTP ${response.status}`
    ) as HttpError;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function partnerLogin(credentials: {
  email: string;
  password: string;
}): Promise<PartnerLoginResponse> {
  const res = await fetch(`${API_BASE_URL}/partner/auth/login`, {
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

  return res.json() as Promise<PartnerLoginResponse>;
}

export async function partnerSetPassword(body: {
  newPassword: string;
  passwordSetupToken?: string;
}): Promise<PartnerSetPasswordResponse> {
  const setupToken = body.passwordSetupToken ?? getPartnerPasswordSetupToken();
  if (!setupToken) {
    const err: HttpError = new Error("Password setup session expired") as HttpError;
    err.status = 401;
    throw err;
  }

  const res = await fetch(`${API_BASE_URL}/partner/auth/set-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-partner-setup-token": setupToken,
    },
    body: JSON.stringify({ newPassword: body.newPassword }),
  });

  if (!res.ok) {
    const err: HttpError = new Error(`Set password failed: ${res.status}`) as HttpError;
    err.status = res.status;
    try {
      err.data = await res.json();
    } catch {
      // ignore
    }
    throw err;
  }

  return res.json() as Promise<PartnerSetPasswordResponse>;
}

export function fetchPartnerMe(): Promise<PartnerMe> {
  return partnerFetch("/auth/me");
}

export function fetchPartnerDashboard(): Promise<PartnerDashboard> {
  return partnerFetch("/dashboard");
}

export function fetchPartnerBusinesses(params?: {
  limit?: number;
  skip?: number;
}): Promise<{ items: PartnerBusinessListItem[]; total: number; limit: number; skip: number }> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.skip != null) sp.set("skip", String(params.skip));
  const q = sp.toString();
  return partnerFetch(`/businesses${q ? `?${q}` : ""}`);
}

export function fetchPartnerBusinessById(id: string): Promise<PartnerBusinessDetail> {
  return partnerFetch(`/businesses/${id}`);
}

export function createPartnerBusinessNote(
  prospectId: string,
  body: PartnerInteractionPayload
): Promise<PartnerInteraction> {
  return partnerFetch(`/businesses/${prospectId}/notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchPartnerIntroductions(params?: {
  limit?: number;
  skip?: number;
}): Promise<{ items: PartnerIntroductionListItem[]; total: number; limit: number; skip: number }> {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.skip != null) sp.set("skip", String(params.skip));
  const q = sp.toString();
  return partnerFetch(`/introductions${q ? `?${q}` : ""}`);
}

export function fetchPartnerIntroductionById(prospectId: string): Promise<PartnerIntroductionDetail> {
  return partnerFetch(`/introductions/${prospectId}`);
}

export function createPartnerIntroduction(body: {
  businessName: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  conversationNotes: string;
  isMeaningful?: boolean;
  visitType?: PartnerVisitType;
  activityDate?: string;
  activityTime?: string;
  primaryContact?: string;
  duration?: string;
  interestLevel?: string;
  nextFollowUpDate?: string;
  /** Legacy */
  type?: PartnerNoteType;
}): Promise<PartnerIntroductionCreateResponse> {
  return partnerFetch("/introductions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePartnerIntroduction(
  prospectId: string,
  body: PartnerBusinessDetailsUpdate & {
    firstContactDate?: string | null;
    lastVisitDate?: string | null;
    nextFollowUpDate?: string | null;
  }
): Promise<{
  business?: PartnerBusinessDetail["business"];
  relationship?: PartnerIntroductionDetail["relationship"];
}> {
  return partnerFetch(`/introductions/${prospectId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type PartnerBusinessDetailsUpdate = {
  businessName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  notes?: string;
};

export function updatePartnerBusiness(
  prospectId: string,
  body: PartnerBusinessDetailsUpdate
): Promise<{ business: PartnerBusinessDetail["business"] }> {
  return partnerFetch(`/businesses/${prospectId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function createPartnerIntroductionNote(
  prospectId: string,
  body: PartnerInteractionPayload
): Promise<{ note: PartnerInteraction; relationship: PartnerIntroductionDetail["relationship"] }> {
  return partnerFetch(`/introductions/${prospectId}/notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createPartnerIntroductionAmendment(
  prospectId: string,
  noteId: string,
  text: string
): Promise<{ note: PartnerInteraction }> {
  return partnerFetch(`/introductions/${prospectId}/notes/${noteId}/amendments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function createPartnerBusinessAmendment(
  prospectId: string,
  noteId: string,
  text: string
): Promise<{ note: PartnerInteraction }> {
  return partnerFetch(`/businesses/${prospectId}/notes/${noteId}/amendments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
