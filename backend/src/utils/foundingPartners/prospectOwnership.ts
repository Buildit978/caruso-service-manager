import { Types } from "mongoose";
import { CommunicationNote } from "../../models/communicationNote.model";
import { FoundingPartner } from "../../models/foundingPartner.model";
import {
  RelationshipProtection,
  type RelationshipLifecycleStatus,
} from "../../models/relationshipProtection.model";

export interface ProspectOwnershipSummary {
  protectedBy: string | null;
}

export interface ProspectOwnershipDetail {
  relationshipProtectionId: string | null;
  protectedBy: { partnerId: string; partnerName: string } | null;
  protectionStatus: string | null;
  lifecycleStatus: RelationshipLifecycleStatus | null;
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

const LIFECYCLE_ORDER: RelationshipLifecycleStatus[] = [
  "new",
  "protected",
  "connected",
  "engaged",
];

function toIso(date: Date | undefined | null): string | null {
  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function resolveLifecycleStatus(
  lifecycleStatus: RelationshipLifecycleStatus | undefined,
  protectionStatus: string
): RelationshipLifecycleStatus {
  if (lifecycleStatus) return lifecycleStatus;
  return protectionStatus === "approved" ? "protected" : "new";
}

export function isValidLifecycleAdvance(
  current: RelationshipLifecycleStatus,
  next: RelationshipLifecycleStatus
): boolean {
  const currentIdx = LIFECYCLE_ORDER.indexOf(current);
  const nextIdx = LIFECYCLE_ORDER.indexOf(next);
  if (currentIdx < 0 || nextIdx < 0) return false;
  return nextIdx === currentIdx + 1;
}

/** Latest note on a protection (strict relationshipProtectionId only). */
export async function getProtectionLastActivityAt(
  relationshipProtectionId: Types.ObjectId
): Promise<Date | null> {
  const rows = await CommunicationNote.aggregate<{ effectiveAt: Date }>([
    { $match: { relationshipProtectionId } },
    {
      $addFields: {
        effectiveAt: {
          $cond: {
            if: { $ifNull: ["$activityDate", false] },
            then: {
              $dateFromParts: {
                year: { $year: "$activityDate" },
                month: { $month: "$activityDate" },
                day: { $dayOfMonth: "$activityDate" },
                hour: {
                  $toInt: {
                    $substr: [{ $ifNull: ["$activityTime", "12:00"] }, 0, 2],
                  },
                },
                minute: {
                  $toInt: {
                    $substr: [{ $ifNull: ["$activityTime", "12:00"] }, 3, 2],
                  },
                },
              },
            },
            else: "$createdAt",
          },
        },
      },
    },
    { $sort: { effectiveAt: -1 } },
    { $limit: 1 },
    { $project: { effectiveAt: 1 } },
  ]);

  const latest = rows[0]?.effectiveAt;
  if (!latest) return null;
  return new Date(latest);
}

/** Approved protection for a prospect, if any. */
export async function getApprovedProtectionForProspect(prospectId: Types.ObjectId) {
  return RelationshipProtection.findOne({
    prospectId,
    protectionStatus: "approved",
  })
    .sort({ approvedAt: -1 })
    .lean();
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
  const approved = await getApprovedProtectionForProspect(prospectId);

  if (!approved) {
    return null;
  }

  const [partner, lastActivityAt] = await Promise.all([
    FoundingPartner.findById(approved.partnerId).select("name").lean(),
    getProtectionLastActivityAt(approved._id as Types.ObjectId),
  ]);

  return {
    relationshipProtectionId: approved._id.toString(),
    protectedBy: partner
      ? { partnerId: approved.partnerId.toString(), partnerName: partner.name }
      : null,
    protectionStatus: approved.protectionStatus,
    lifecycleStatus: resolveLifecycleStatus(
      approved.lifecycleStatus as RelationshipLifecycleStatus | undefined,
      approved.protectionStatus
    ),
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
