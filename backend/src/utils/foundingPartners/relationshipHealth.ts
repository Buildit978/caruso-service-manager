import { Types } from "mongoose";
import { CommunicationNote } from "../../models/communicationNote.model";

export type HealthStatus = "healthy" | "attention_needed" | "stale";

const MS_DAY = 86_400_000;

export function daysBetween(anchor: Date, now = new Date()): number {
  const d = anchor instanceof Date ? anchor : new Date(anchor);
  if (Number.isNaN(d.getTime())) return NaN;
  return Math.floor((now.getTime() - d.getTime()) / MS_DAY);
}

export function computeHealthStatus(days: number): HealthStatus {
  if (days <= 30) return "healthy";
  if (days <= 60) return "attention_needed";
  return "stale";
}

export interface RelationshipHealthFields {
  relationshipAgeDays: number | null;
  daysSinceLastActivity: number | null;
  healthStatus: HealthStatus | null;
}

export function computeRelationshipHealth(
  approvedAt: Date | undefined | null,
  lastActivityAt: Date | null,
  now = new Date()
): RelationshipHealthFields {
  const approvedDate =
    approvedAt != null ? (approvedAt instanceof Date ? approvedAt : new Date(approvedAt)) : null;
  const approvedValid = approvedDate != null && !Number.isNaN(approvedDate.getTime());

  const relationshipAgeDays = approvedValid ? daysBetween(approvedDate!, now) : null;

  let daysSinceLastActivity: number | null = null;
  if (lastActivityAt != null && !Number.isNaN(lastActivityAt.getTime())) {
    daysSinceLastActivity = daysBetween(lastActivityAt, now);
  } else if (approvedValid) {
    daysSinceLastActivity = daysBetween(approvedDate!, now);
  }

  const healthStatus =
    daysSinceLastActivity != null ? computeHealthStatus(daysSinceLastActivity) : null;

  return {
    relationshipAgeDays,
    daysSinceLastActivity,
    healthStatus,
  };
}

/** Batch latest note timestamp per protection (one aggregation). */
export async function getProtectionLastActivityMap(
  protectionIds: Types.ObjectId[]
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (protectionIds.length === 0) return result;

  const rows = await CommunicationNote.aggregate<{ _id: Types.ObjectId; lastActivityAt: Date }>([
    { $match: { relationshipProtectionId: { $in: protectionIds } } },
    { $group: { _id: "$relationshipProtectionId", lastActivityAt: { $max: "$createdAt" } } },
  ]);

  for (const row of rows) {
    if (row._id && row.lastActivityAt) {
      result.set(row._id.toString(), new Date(row.lastActivityAt));
    }
  }

  return result;
}
