import type { IFoundingProspect } from "../../models/foundingProspect.model";
import { normalizeEmail } from "./normalize";

export type PartnerProspectBusinessPatchBody = {
  businessName?: string;
  ownerName?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  location?: string | null;
  website?: string | null;
  notes?: string | null;
};

export function hasPartnerProspectBusinessPatchFields(body: PartnerProspectBusinessPatchBody): boolean {
  return (
    body.businessName !== undefined ||
    body.ownerName !== undefined ||
    body.contactName !== undefined ||
    body.phone !== undefined ||
    body.email !== undefined ||
    body.address !== undefined ||
    body.location !== undefined ||
    body.website !== undefined ||
    body.notes !== undefined
  );
}

export function applyPartnerProspectBusinessPatch(
  prospect: IFoundingProspect,
  body: PartnerProspectBusinessPatchBody
): { ok: true } | { ok: false; error: string } {
  if (body.businessName !== undefined) {
    const trim = String(body.businessName).trim();
    if (!trim) return { ok: false, error: "businessName is required" };
    prospect.businessName = trim;
  }

  if (body.ownerName !== undefined) {
    prospect.contactName = body.ownerName ? String(body.ownerName).trim() : undefined;
  } else if (body.contactName !== undefined) {
    prospect.contactName = body.contactName ? String(body.contactName).trim() : undefined;
  }

  if (body.phone !== undefined) {
    prospect.phone = body.phone ? String(body.phone).trim() : undefined;
  }

  if (body.email !== undefined) {
    prospect.email = body.email ? normalizeEmail(String(body.email)) : undefined;
  }

  const locationRaw = body.address !== undefined ? body.address : body.location;
  if (locationRaw !== undefined) {
    prospect.location = locationRaw ? String(locationRaw).trim() : undefined;
  }

  if (body.website !== undefined) {
    prospect.website = body.website ? String(body.website).trim() : undefined;
  }

  if (body.notes !== undefined) {
    prospect.notes = body.notes ? String(body.notes).trim() : undefined;
  }

  return { ok: true };
}
