import { Types } from "mongoose";
import { CommunicationNote } from "../../models/communicationNote.model";
import { FoundingPartner } from "../../models/foundingPartner.model";
import { RelationshipProtection } from "../../models/relationshipProtection.model";

export interface ProspectOwnershipSummary {
  protectedBy: string | null;
}

export interface ProspectOwnershipDetail {
  protectedBy: { partnerId: string; partnerName: string } | null;
  protectionStatus: string | null;
  introducedAt: string | null;
  lastActivityAt: string | null;
}

export interface PendingIntroductionSummary {
  id: string;
  partnerId: string;
  partnerName: string;
  introducedAt: string;
  protectionStatus: string;
}

function toIso(date: Date | undefined | null): string | null {
  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function getProtectionIdsForProspect(prospectId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const rows = await RelationshipProtection.find({ prospectId }).select("_id").lean();
  return rows.map((r) => r._id as Types.ObjectId);
}

/** Latest communication note timestamp for a prospect (direct or via related protections). */
export async function getProspectLastActivityAt(prospectId: Types.ObjectId): Promise<Date | null> {
  const protectionIds = await getProtectionIdsForProspect(prospectId);
  const orClauses: Record<string, unknown>[] = [{ prospectId }];
  if (protectionIds.length > 0) {
    orClauses.push({ relationshipProtectionId: { $in: protectionIds } });
  }

  const latest = await CommunicationNote.findOne({ $or: orClauses })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();

  if (!latest?.createdAt) return null;
  return new Date(latest.createdAt);
}

/** Batch map of prospectId → protectedBy partner name (approved protection only). */
export async function buildProspectOwnershipMap(
  prospectIds: Types.ObjectId[]
): Promise<Map<string, ProspectOwnershipSummary>> {
  const result = new Map<string, ProspectOwnershipSummary>();
  for (const id of prospectIds) {
    result.set(id.toString(), { protectedBy: null });
  }
  if (prospectIds.length === 0) return result;

  const approved = await RelationshipProtection.find({
    prospectId: { $in: prospectIds },
    protectionStatus: "approved",
  })
    .select("prospectId partnerId")
    .lean();

  if (approved.length === 0) return result;

  const partnerIds = [...new Set(approved.map((r) => r.partnerId.toString()))].map(
    (id) => new Types.ObjectId(id)
  );
  const partners = await FoundingPartner.find({ _id: { $in: partnerIds } })
    .select("_id name")
    .lean();
  const partnerNameById = new Map(partners.map((p) => [p._id.toString(), p.name]));

  for (const row of approved) {
    const prospectKey = row.prospectId.toString();
    const partnerName = partnerNameById.get(row.partnerId.toString()) ?? null;
    result.set(prospectKey, { protectedBy: partnerName });
  }

  return result;
}

/** Full ownership detail for prospect detail view (approved protection only). */
export async function getProspectOwnershipDetail(
  prospectId: Types.ObjectId
): Promise<ProspectOwnershipDetail | null> {
  const approved = await RelationshipProtection.findOne({
    prospectId,
    protectionStatus: "approved",
  })
    .sort({ approvedAt: -1 })
    .lean();

  const lastActivityAt = await getProspectLastActivityAt(prospectId);

  if (!approved) {
    return null;
  }

  const partner = await FoundingPartner.findById(approved.partnerId).select("name").lean();

  return {
    protectedBy: partner
      ? { partnerId: approved.partnerId.toString(), partnerName: partner.name }
      : null,
    protectionStatus: approved.protectionStatus,
    introducedAt: toIso(approved.introducedAt),
    lastActivityAt: toIso(lastActivityAt),
  };
}

/** Pending introductions for a prospect (read-only links; not ownership). */
export async function getPendingIntroductionsForProspect(
  prospectId: Types.ObjectId
): Promise<PendingIntroductionSummary[]> {
  const pending = await RelationshipProtection.find({
    prospectId,
    protectionStatus: "pending",
  })
    .sort({ introducedAt: -1 })
    .lean();

  if (pending.length === 0) return [];

  const partnerIds = [...new Set(pending.map((r) => r.partnerId.toString()))].map(
    (id) => new Types.ObjectId(id)
  );
  const partners = await FoundingPartner.find({ _id: { $in: partnerIds } })
    .select("_id name")
    .lean();
  const partnerNameById = new Map(partners.map((p) => [p._id.toString(), p.name]));

  return pending.map((row) => ({
    id: row._id.toString(),
    partnerId: row.partnerId.toString(),
    partnerName: partnerNameById.get(row.partnerId.toString()) ?? "Unknown partner",
    introducedAt: toIso(row.introducedAt) ?? new Date().toISOString(),
    protectionStatus: row.protectionStatus,
  }));
}

/** Returns true if another approved protection exists for this prospect (excluding optional id). */
export async function hasApprovedProtectionForProspect(
  prospectId: Types.ObjectId,
  excludeProtectionId?: Types.ObjectId
): Promise<boolean> {
  const filter: Record<string, unknown> = {
    prospectId,
    protectionStatus: "approved",
  };
  if (excludeProtectionId) {
    filter._id = { $ne: excludeProtectionId };
  }
  const count = await RelationshipProtection.countDocuments(filter);
  return count > 0;
}
