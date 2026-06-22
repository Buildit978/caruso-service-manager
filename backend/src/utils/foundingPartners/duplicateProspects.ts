import { Types } from "mongoose";
import { FoundingProspect } from "../../models/foundingProspect.model";
import {
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  normalizeWebsiteHost,
} from "./normalize";

export type DuplicateConfidence = "high" | "medium";

export interface DuplicateProspectMatch {
  prospectId: string;
  businessName: string;
  email?: string;
  phone?: string;
  website?: string;
  status: string;
  matchedOn: string[];
  confidence: DuplicateConfidence;
}

export interface DuplicateSearchInput {
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  excludeId?: Types.ObjectId;
}

function confidenceFromMatches(matchedOn: string[]): DuplicateConfidence {
  if (matchedOn.includes("email") || matchedOn.includes("phone")) return "high";
  return "medium";
}

/**
 * Advisory duplicate detection — does not block or merge records.
 */
export async function findDuplicateProspects(
  input: DuplicateSearchInput,
  limit = 10
): Promise<DuplicateProspectMatch[]> {
  const normEmail = normalizeEmail(input.email);
  const normPhone = normalizePhone(input.phone);
  const normWebsite = normalizeWebsiteHost(input.website);
  const normBusiness = normalizeBusinessName(input.businessName);

  if (!normEmail && !normPhone && !normWebsite && !normBusiness) {
    return [];
  }

  const orClauses: Record<string, unknown>[] = [];
  if (normEmail) orClauses.push({ email: normEmail });
  if (normPhone) {
    // Match phones that contain the same digit sequence (best-effort without stored normalized field).
    orClauses.push({ phone: { $regex: normPhone.slice(-7) } });
  }
  if (normWebsite) {
    orClauses.push({
      website: { $regex: normWebsite.replace(/\./g, "\\."), $options: "i" },
    });
  }
  if (normBusiness) {
    orClauses.push({ businessName: { $regex: normBusiness.slice(0, 12), $options: "i" } });
  }

  const filter: Record<string, unknown> = { $or: orClauses };
  if (input.excludeId) {
    filter._id = { $ne: input.excludeId };
  }

  const candidates = await FoundingProspect.find(filter)
    .select("_id businessName email phone website status")
    .limit(Math.min(limit * 3, 30))
    .lean();

  const matches: DuplicateProspectMatch[] = [];

  for (const c of candidates) {
    const matchedOn: string[] = [];
    const cEmail = normalizeEmail(c.email);
    const cPhone = normalizePhone(c.phone);
    const cWebsite = normalizeWebsiteHost(c.website);
    const cBusiness = normalizeBusinessName(c.businessName);

    if (normEmail && cEmail && normEmail === cEmail) matchedOn.push("email");
    if (normPhone && cPhone && normPhone === cPhone) matchedOn.push("phone");
    if (normWebsite && cWebsite && normWebsite === cWebsite) matchedOn.push("website");
    if (normBusiness && cBusiness) {
      if (cBusiness === normBusiness || cBusiness.includes(normBusiness) || normBusiness.includes(cBusiness)) {
        matchedOn.push("businessName");
      }
    }

    if (matchedOn.length === 0) continue;

    matches.push({
      prospectId: c._id.toString(),
      businessName: c.businessName,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      website: c.website ?? undefined,
      status: c.status,
      matchedOn,
      confidence: confidenceFromMatches(matchedOn),
    });
  }

  // Sort high confidence first, then by number of matched fields.
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
    return b.matchedOn.length - a.matchedOn.length;
  });

  return matches.slice(0, limit);
}
