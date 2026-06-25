import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { CommunicationNote } from "../../models/communicationNote.model";
import { FoundingPartner } from "../../models/foundingPartner.model";
import { FoundingProspect } from "../../models/foundingProspect.model";
import { RelationshipProtection } from "../../models/relationshipProtection.model";
import { buildPortalAccessSnapshot } from "../../utils/foundingPartners/partnerPortalAccess";
import { resolveLifecycleStatus } from "../../utils/foundingPartners/prospectOwnership";
import {
  computeRelationshipHealth,
  getProtectionLastActivityMap,
  type HealthStatus,
} from "../../utils/foundingPartners/relationshipHealth";
import {
  getEffectiveActivityTimestamp,
  parseOptionalFollowUpDateInput,
  sortNotesByEffectiveActivityDesc,
} from "../../utils/foundingPartners/activityDates";
import {
  buildInteractionCreatePayload,
  parseInteractionFields,
  serializeInteractionNote,
} from "../../utils/foundingPartners/fieldInteractions";

const router = Router();

const RECENT_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

function parseObjectId(param: string | undefined): Types.ObjectId | null {
  if (param == null || param === "" || !Types.ObjectId.isValid(param)) return null;
  return new Types.ObjectId(param);
}

function parseLimit(query: Request["query"], defaultVal = 50, max = 100): number {
  const raw = query.limit;
  if (raw == null || raw === "") return defaultVal;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(Math.max(n, 1), max);
}

function parseSkip(query: Request["query"]): number {
  const raw = query.skip;
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.max(n, 0), 5000);
}

function toIso(date: Date | undefined | null): string | undefined {
  if (date == null) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function getPartnerActor(req: Request): { partnerId: Types.ObjectId; userId: Types.ObjectId } | null {
  const actor = req.partnerActor;
  if (!actor?.partnerId || !actor?.userId) return null;
  return { partnerId: actor.partnerId, userId: actor.userId };
}

function getPartnerId(req: Request): Types.ObjectId | null {
  return req.partnerActor?.partnerId ?? null;
}

type ProtectionLean = {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  prospectId: Types.ObjectId;
  introducedAt: Date;
  protectionStatus: string;
  lifecycleStatus?: string;
  evidenceSummary: string;
  approvedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

function serializePartnerRelationship(
  row: ProtectionLean,
  extras?: {
    lastActivityAt?: string | null;
    relationshipAgeDays?: number | null;
    daysSinceLastActivity?: number | null;
    healthStatus?: HealthStatus | null;
  }
) {
  return {
    id: row._id.toString(),
    introducedAt: toIso(row.introducedAt),
    protectionStatus: row.protectionStatus,
    lifecycleStatus: resolveLifecycleStatus(
      row.lifecycleStatus as Parameters<typeof resolveLifecycleStatus>[0],
      row.protectionStatus
    ),
    evidenceSummary: row.evidenceSummary,
    approvedAt: toIso(row.approvedAt),
    lastActivityAt: extras?.lastActivityAt ?? null,
    relationshipAgeDays: extras?.relationshipAgeDays ?? null,
    daysSinceLastActivity: extras?.daysSinceLastActivity ?? null,
    healthStatus: extras?.healthStatus ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function serializePartnerBusiness(prospect: {
  _id: Types.ObjectId;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: prospect._id.toString(),
    businessName: prospect.businessName,
    contactName: prospect.contactName ?? undefined,
    email: prospect.email ?? undefined,
    phone: prospect.phone ?? undefined,
    website: prospect.website ?? undefined,
    location: prospect.location ?? undefined,
    status: prospect.status,
    createdAt: toIso(prospect.createdAt),
    updatedAt: toIso(prospect.updatedAt),
  };
}

function serializePartnerNote(note: Parameters<typeof serializeInteractionNote>[0]) {
  return serializeInteractionNote(note);
}

async function findApprovedProtectionForPartner(
  partnerId: Types.ObjectId,
  prospectId: Types.ObjectId
): Promise<ProtectionLean | null> {
  const row = await RelationshipProtection.findOne({
    partnerId,
    prospectId,
    protectionStatus: "approved",
  }).lean();

  return row as ProtectionLean | null;
}

function buildHealthExtras(
  row: ProtectionLean,
  activityMap: Map<string, Date>
): {
  lastActivityAt: string | null;
  relationshipAgeDays: number | null;
  daysSinceLastActivity: number | null;
  healthStatus: HealthStatus | null;
} {
  const lastActivity = activityMap.get(row._id.toString()) ?? null;
  const health = computeRelationshipHealth(row.approvedAt, lastActivity);
  return {
    lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
    relationshipAgeDays: health.relationshipAgeDays,
    daysSinceLastActivity: health.daysSinceLastActivity,
    healthStatus: health.healthStatus,
  };
}

/**
 * GET /api/partner/dashboard
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return res.status(401).json({ message: "Unauthorized" });

    const partner = await FoundingPartner.findById(partnerId).lean();
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const cutoff = new Date(Date.now() - RECENT_ACTIVITY_MS);
    const approvedProtectionFilter = { partnerId, protectionStatus: "approved" as const };

    const [portalAccess, stewardedBusinessCount, protections] = await Promise.all([
      buildPortalAccessSnapshot(partner),
      RelationshipProtection.countDocuments(approvedProtectionFilter),
      RelationshipProtection.find(approvedProtectionFilter).select("_id prospectId approvedAt").lean(),
    ]);

    const approvedProtectionIds = protections.map((p) => p._id as Types.ObjectId);

    let recentActivityCount = 0;
    let recentNotes: Array<{
      _id: Types.ObjectId;
      type: string;
      visitType?: string;
      summary: string;
      primaryContact?: string;
      prospectId?: Types.ObjectId;
      activityDate?: Date;
      activityTime?: string;
      createdAt?: Date;
      effectiveAt?: Date;
    }> = [];

    if (approvedProtectionIds.length > 0) {
      const noteMatch = {
        relationshipProtectionId: { $in: approvedProtectionIds },
        type: { $ne: "internalNote" as const },
      };

      const [countRows, recentNoteRows] = await Promise.all([
        CommunicationNote.aggregate<{ total: number }>([
          { $match: noteMatch },
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
          { $match: { effectiveAt: { $gte: cutoff } } },
          { $count: "total" },
        ]),
        CommunicationNote.aggregate<{
          _id: Types.ObjectId;
          type: string;
          summary: string;
          prospectId?: Types.ObjectId;
          activityDate?: Date;
          createdAt?: Date;
          effectiveAt?: Date;
        }>([
          { $match: noteMatch },
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
          { $match: { effectiveAt: { $gte: cutoff } } },
          { $sort: { effectiveAt: -1 } },
          { $limit: 5 },
        ]),
      ]);

      recentActivityCount = countRows[0]?.total ?? 0;
      recentNotes = recentNoteRows;
    }

    const activityMap = await getProtectionLastActivityMap(approvedProtectionIds);

    let attentionNeededCount = 0;
    for (const row of protections) {
      const lastActivity = activityMap.get(row._id.toString()) ?? null;
      const health = computeRelationshipHealth(row.approvedAt, lastActivity);
      if (health.healthStatus === "attention_needed" || health.healthStatus === "stale") {
        attentionNeededCount++;
      }
    }

    const stewardedProspectIds = protections.map((p) => p.prospectId as Types.ObjectId);
    const prospects =
      stewardedProspectIds.length > 0
        ? await FoundingProspect.find({ _id: { $in: stewardedProspectIds } })
            .select("_id businessName")
            .lean()
        : [];
    const businessNameByProspectId = new Map(prospects.map((p) => [p._id.toString(), p.businessName]));

    const recentActivity = recentNotes.map((note) => {
      const ts = getEffectiveActivityTimestamp(note as any);
      return {
        type: "interaction" as const,
        noteType: note.visitType ?? note.type,
        visitType: note.visitType ?? undefined,
        at: ts != null ? new Date(ts).toISOString() : toIso(note.createdAt),
        summary: note.summary,
        primaryContact: note.primaryContact ?? undefined,
        prospectId: note.prospectId?.toString(),
        businessName: note.prospectId
          ? businessNameByProspectId.get(note.prospectId.toString())
          : undefined,
      };
    });

    return res.json({
      partner: {
        id: partner._id.toString(),
        name: partner.name,
        email: partner.email,
        portalAccess,
        lastPortalLoginAt: toIso(partner.lastPortalLoginAt),
      },
      stewardedBusinessCount,
      attentionNeededCount,
      recentActivityCount,
      recentActivity,
    });
  } catch (err) {
    console.error("[PartnerDashboard] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/partner/businesses
 */
router.get("/businesses", async (req: Request, res: Response) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return res.status(401).json({ message: "Unauthorized" });

    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);

    const filter = { partnerId, protectionStatus: "approved" as const };

    const [protections, total] = await Promise.all([
      RelationshipProtection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RelationshipProtection.countDocuments(filter),
    ]);

    if (protections.length === 0) {
      return res.json({ items: [], total, limit, skip });
    }

    const prospectIds = protections.map((p) => p.prospectId as Types.ObjectId);
    const protectionIds = protections.map((p) => p._id as Types.ObjectId);

    const [prospects, activityMap] = await Promise.all([
      FoundingProspect.find({ _id: { $in: prospectIds } }).lean(),
      getProtectionLastActivityMap(protectionIds),
    ]);

    const prospectById = new Map(prospects.map((p) => [p._id.toString(), p]));

    const items = protections.map((row) => {
      const protection = row as ProtectionLean;
      const prospect = prospectById.get(protection.prospectId.toString());
      const healthExtras = buildHealthExtras(protection, activityMap);

      return {
        prospectId: protection.prospectId.toString(),
        protectionId: protection._id.toString(),
        businessName: prospect?.businessName ?? "Unknown business",
        contactName: prospect?.contactName ?? undefined,
        email: prospect?.email ?? undefined,
        phone: prospect?.phone ?? undefined,
        location: prospect?.location ?? undefined,
        prospectStatus: prospect?.status,
        protectionStatus: protection.protectionStatus,
        lifecycleStatus: resolveLifecycleStatus(
          protection.lifecycleStatus as Parameters<typeof resolveLifecycleStatus>[0],
          protection.protectionStatus
        ),
        lastActivityAt: healthExtras.lastActivityAt,
        healthStatus: healthExtras.healthStatus,
        daysSinceLastActivity: healthExtras.daysSinceLastActivity,
      };
    });

    return res.json({ items, total, limit, skip });
  } catch (err) {
    console.error("[PartnerBusinesses] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/partner/businesses/:id/notes
 * :id is prospectId; creates a note on the partner's approved protection.
 */
router.post("/businesses/:id/notes", async (req: Request, res: Response) => {
  try {
    const actor = getPartnerActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const prospectId = parseObjectId(req.params.id);
    if (!prospectId) return res.status(404).json({ message: "Business not found" });

    const protection = await findApprovedProtectionForPartner(actor.partnerId, prospectId);
    if (!protection) return res.status(404).json({ message: "Business not found" });

    const { type, visitType, summary, followUpDate, activityDate, activityTime, primaryContact, duration, interestLevel } =
      req.body as {
        type?: string;
        visitType?: string;
        summary?: string;
        followUpDate?: string;
        activityDate?: string;
        activityTime?: string;
        primaryContact?: string;
        duration?: string;
        interestLevel?: string;
      };

    const interactionParsed = parseInteractionFields(
      {
        summary,
        type,
        visitType,
        activityDate,
        activityTime,
        primaryContact,
        duration,
        interestLevel,
      },
      { summaryRequired: true }
    );
    if (!interactionParsed.ok) return res.status(400).json({ message: interactionParsed.error });

    let followUp: Date | undefined;
    if (followUpDate) {
      const parsed = new Date(followUpDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid followUpDate" });
      }
      followUp = parsed;
    }

    const note = await CommunicationNote.create(
      buildInteractionCreatePayload(interactionParsed.fields, {
        partnerId: actor.partnerId,
        prospectId,
        relationshipProtectionId: protection._id,
        followUpDate: followUp,
        createdBy: actor.userId,
      })
    );

    return res.status(201).json(serializePartnerNote(note));
  } catch (err) {
    console.error("[PartnerBusinessNoteCreate] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/partner/businesses/:id
 * :id is prospectId; returns 404 unless this partner has an approved protection.
 */
router.get("/businesses/:id", async (req: Request, res: Response) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return res.status(401).json({ message: "Unauthorized" });

    const prospectId = parseObjectId(req.params.id);
    if (!prospectId) return res.status(404).json({ message: "Business not found" });

    const protection = await findApprovedProtectionForPartner(partnerId, prospectId);
    if (!protection) return res.status(404).json({ message: "Business not found" });

    const [prospect, notes, activityMap] = await Promise.all([
      FoundingProspect.findById(prospectId).lean(),
      CommunicationNote.find({
        relationshipProtectionId: protection._id,
        type: { $ne: "internalNote" },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      getProtectionLastActivityMap([protection._id]),
    ]);

    if (!prospect) return res.status(404).json({ message: "Business not found" });

    const healthExtras = buildHealthExtras(protection, activityMap);
    const sortedNotes = sortNotesByEffectiveActivityDesc(notes as any);

    return res.json({
      business: serializePartnerBusiness(prospect as any),
      relationship: serializePartnerRelationship(protection, healthExtras),
      notes: sortedNotes.map((note) => serializePartnerNote(note as any)),
    });
  } catch (err) {
    console.error("[PartnerBusinessDetail] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
