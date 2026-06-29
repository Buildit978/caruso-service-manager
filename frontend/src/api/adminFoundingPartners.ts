import { adminFetch } from "./admin";
import type { HttpError } from "./admin";

export type { HttpError };

export type FoundingPartnerStatus = "active" | "paused" | "inactive";

export type FoundingProspectStatus =
  | "new"
  | "contacted"
  | "demoScheduled"
  | "demoCompleted"
  | "trialStarted"
  | "converted"
  | "closedLost"
  | "notFit";

export type ProtectionStatus = "pending" | "approved" | "declined" | "expired" | "released";

export type RelationshipLifecycleStatus = "new" | "protected" | "connected" | "engaged";

export type HealthStatus = "healthy" | "attention_needed" | "stale";

export type CommunicationNoteType =
  | "call"
  | "email"
  | "walkIn"
  | "meeting"
  | "demo"
  | "followUp"
  | "internalNote";

export type PortalAccessStatus = "enabled" | "disabled";

export interface PartnerPortalAccess {
  status: PortalAccessStatus;
  enabledAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
}

export interface FoundingPartner {
  id: string;
  name: string;
  email: string;
  phone?: string;
  region?: string;
  status: FoundingPartnerStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FoundingPartnerDetail extends FoundingPartner {
  portalAccess?: PartnerPortalAccess;
  counts?: { relationshipProtections: number; communicationNotes: number };
}

export interface ProspectRelationshipOwnership {
  relationshipProtectionId: string | null;
  protectedBy: { partnerId: string; partnerName: string } | null;
  protectionStatus: string | null;
  lifecycleStatus: RelationshipLifecycleStatus | null;
  introducedAt: string | null;
  lastActivityAt: string | null;
}

export interface PendingIntroduction {
  id: string;
  partnerId: string;
  partnerName: string;
  introducedAt: string;
  protectionStatus: string;
}

export interface FoundingProspect {
  id: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  status: FoundingProspectStatus;
  closedReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  protectedBy: string | null;
}

export interface FoundingProspectDetail extends FoundingProspect {
  relationshipOwnership: ProspectRelationshipOwnership | null;
  pendingIntroductions: PendingIntroduction[];
  counts?: { communicationNotes: number; relationshipProtections: number };
  possibleDuplicates?: DuplicateProspectMatch[];
}

export interface DuplicateProspectMatch {
  prospectId: string;
  businessName: string;
  email?: string;
  phone?: string;
  website?: string;
  status: string;
  matchedOn: string[];
  confidence: "high" | "medium";
}

export interface RelationshipProtection {
  id: string;
  partnerId: string;
  prospectId: string;
  partnerName?: string;
  prospectBusinessName?: string;
  introducedAt?: string;
  protectionStatus: ProtectionStatus;
  lifecycleStatus: RelationshipLifecycleStatus;
  lifecycleStatusUpdatedAt?: string;
  lifecycleStatusUpdatedBy?: string;
  lastActivityAt?: string | null;
  relationshipAgeDays?: number | null;
  daysSinceLastActivity?: number | null;
  healthStatus?: HealthStatus | null;
  protectionExpiresAt?: string | null;
  evidenceSummary: string;
  approvalNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RelationshipProtectionDetail extends RelationshipProtection {
  partner?: { id: string; name: string; email: string };
  prospect?: { id: string; businessName: string; status: string };
  counts?: { communicationNotes: number };
}

export interface CommunicationNote {
  id: string;
  partnerId?: string;
  prospectId?: string;
  relationshipProtectionId?: string;
  type: CommunicationNoteType;
  summary: string;
  activityDate?: string;
  activityTime?: string;
  primaryContact?: string;
  visitType?: string;
  duration?: string;
  interestLevel?: string;
  followUpDate?: string;
  amendments?: Array<{
    text: string;
    createdAt?: string;
    createdBy?: string;
  }>;
  createdBy: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

const BASE = "/founding-partners";

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") sp.set(key, String(value));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function fetchFoundingPartners(params?: {
  q?: string;
  status?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<FoundingPartner>> {
  return adminFetch(`${BASE}/partners${buildQuery(params ?? {})}`);
}

export function createFoundingPartner(body: {
  name: string;
  email: string;
  phone?: string;
  region?: string;
  status?: FoundingPartnerStatus;
  notes?: string;
}): Promise<FoundingPartner> {
  return adminFetch(`${BASE}/partners`, { method: "POST", body: JSON.stringify(body) });
}

export function fetchFoundingPartnerById(id: string): Promise<FoundingPartnerDetail> {
  return adminFetch(`${BASE}/partners/${id}`);
}

export function updateFoundingPartner(
  id: string,
  body: Partial<{
    name: string;
    email: string;
    phone: string;
    region: string;
    status: FoundingPartnerStatus;
    notes: string;
  }>
): Promise<FoundingPartner> {
  return adminFetch(`${BASE}/partners/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function enablePartnerPortalAccess(id: string): Promise<FoundingPartnerDetail> {
  return adminFetch(`${BASE}/partners/${id}/enable-portal-access`, { method: "POST", body: "{}" });
}

export function disablePartnerPortalAccess(id: string): Promise<FoundingPartnerDetail> {
  return adminFetch(`${BASE}/partners/${id}/disable-portal-access`, { method: "POST", body: "{}" });
}

export function fetchFoundingProspects(params?: {
  q?: string;
  status?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<FoundingProspect>> {
  return adminFetch(`${BASE}/prospects${buildQuery(params ?? {})}`);
}

export function fetchProspectDuplicates(params: {
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  excludeId?: string;
}): Promise<{ matches: DuplicateProspectMatch[] }> {
  return adminFetch(`${BASE}/prospects/duplicates${buildQuery(params)}`);
}

export function createFoundingProspect(body: {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  status?: FoundingProspectStatus;
  closedReason?: string;
  notes?: string;
}): Promise<FoundingProspectDetail> {
  return adminFetch(`${BASE}/prospects`, { method: "POST", body: JSON.stringify(body) });
}

export function fetchFoundingProspectById(id: string): Promise<FoundingProspectDetail> {
  return adminFetch(`${BASE}/prospects/${id}`);
}

export function updateFoundingProspect(
  id: string,
  body: Partial<{
    businessName: string;
    contactName: string;
    email: string;
    phone: string;
    website: string;
    location: string;
    status: FoundingProspectStatus;
    closedReason: string;
    notes: string;
  }>
): Promise<FoundingProspectDetail> {
  return adminFetch(`${BASE}/prospects/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function fetchRelationshipProtections(params?: {
  partnerId?: string;
  prospectId?: string;
  protectionStatus?: string;
  lifecycleStatus?: string;
  healthStatus?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<RelationshipProtection>> {
  return adminFetch(`${BASE}/relationship-protections${buildQuery(params ?? {})}`);
}

export function createRelationshipProtection(body: {
  partnerId: string;
  prospectId: string;
  introducedAt?: string;
  evidenceSummary: string;
}): Promise<RelationshipProtection> {
  return adminFetch(`${BASE}/relationship-protections`, { method: "POST", body: JSON.stringify(body) });
}

export function fetchRelationshipProtectionById(id: string): Promise<RelationshipProtectionDetail> {
  return adminFetch(`${BASE}/relationship-protections/${id}`);
}

export function updateRelationshipProtection(
  id: string,
  body: Partial<{ introducedAt: string; evidenceSummary: string; lifecycleStatus: RelationshipLifecycleStatus }>
): Promise<RelationshipProtection> {
  return adminFetch(`${BASE}/relationship-protections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function approveRelationshipProtection(
  id: string,
  body?: { approvalNotes?: string }
): Promise<RelationshipProtection> {
  return adminFetch(`${BASE}/relationship-protections/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function declineRelationshipProtection(
  id: string,
  body?: { approvalNotes?: string }
): Promise<RelationshipProtection> {
  return adminFetch(`${BASE}/relationship-protections/${id}/decline`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function releaseRelationshipProtection(
  id: string,
  body?: { approvalNotes?: string }
): Promise<RelationshipProtection> {
  return adminFetch(`${BASE}/relationship-protections/${id}/release`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function fetchCommunicationNotes(params: {
  partnerId?: string;
  prospectId?: string;
  relationshipProtectionId?: string;
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<CommunicationNote>> {
  return adminFetch(`${BASE}/communication-notes${buildQuery(params)}`);
}

export function createCommunicationNote(body: {
  partnerId?: string;
  prospectId?: string;
  relationshipProtectionId?: string;
  type?: CommunicationNoteType;
  visitType?: string;
  summary: string;
  activityDate?: string;
  activityTime?: string;
  primaryContact?: string;
  duration?: string;
  interestLevel?: string;
  followUpDate?: string;
}): Promise<CommunicationNote> {
  return adminFetch(`${BASE}/communication-notes`, { method: "POST", body: JSON.stringify(body) });
}

export function updateCommunicationNote(
  id: string,
  body: Partial<{
    type: CommunicationNoteType;
    visitType: string;
    summary: string;
    activityDate: string;
    activityTime: string;
    primaryContact: string;
    duration: string;
    interestLevel: string | null;
    followUpDate: string | null;
  }>
): Promise<CommunicationNote> {
  return adminFetch(`${BASE}/communication-notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export interface LearningCenterObservation {
  id: string;
  date: string;
  partnerId?: string;
  partnerName: string;
  prospectId?: string;
  businessName: string;
  observation: string;
}

export function fetchLearningCenterObservations(params?: {
  limit?: number;
  skip?: number;
}): Promise<PaginatedResponse<LearningCenterObservation>> {
  return adminFetch(`${BASE}/learning-center${buildQuery(params ?? {})}`);
}
