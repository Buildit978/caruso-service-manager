import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { CommunicationNote } from "../../models/communicationNote.model";
import { FoundingPartner } from "../../models/foundingPartner.model";
import {
  FoundingProspect,
  type FoundingProspectStatus,
} from "../../models/foundingProspect.model";
import { RelationshipProtection } from "../../models/relationshipProtection.model";
import { User } from "../../models/user.model";
import { findDuplicateProspects } from "../../utils/foundingPartners/duplicateProspects";
import { normalizeEmail } from "../../utils/foundingPartners/normalize";
import {
  buildProspectOwnershipMap,
  getApprovedProtectionForProspect,
  getPendingIntroductionsForProspect,
  getProspectOwnershipDetail,
  getProtectionLastActivityAt,
  hasApprovedProtectionForProspect,
  isValidLifecycleAdvance,
  resolveLifecycleStatus,
} from "../../utils/foundingPartners/prospectOwnership";
import {
  computeRelationshipHealth,
  getProtectionLastActivityMap,
  type HealthStatus,
} from "../../utils/foundingPartners/relationshipHealth";
import { trackFoundingPartnerAudit } from "../../utils/trackFoundingPartnerAudit";

const router = Router();

const PARTNER_STATUSES = ["active", "paused", "inactive"] as const;
const PROSPECT_STATUSES = [
  "new",
  "contacted",
  "demoScheduled",
  "demoCompleted",
  "trialStarted",
  "converted",
  "closedLost",
  "notFit",
] as const;
const PROTECTION_STATUSES = ["pending", "approved", "declined", "expired", "released"] as const;
const LIFECYCLE_STATUSES = ["new", "protected", "connected", "engaged"] as const;
const HEALTH_STATUSES = ["healthy", "attention_needed", "stale"] as const;
const NOTE_TYPES = ["call", "email", "walkIn", "meeting", "demo", "followUp", "internalNote"] as const;

function parseObjectId(param: string | undefined): Types.ObjectId | null {
  if (param == null || param === "" || !Types.ObjectId.isValid(param)) return null;
  return new Types.ObjectId(param);
}

function parseLimit(query: Request["query"], defaultVal = 50, max = 200): number {
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

function parseQ(query: Request["query"]): string | undefined {
  const raw = typeof query.q === "string" ? query.q.trim() : "";
  return raw === "" ? undefined : raw;
}

function toIso(date: Date | undefined | null): string | undefined {
  if (date == null) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function getAdminActor(req: Request): { _id: Types.ObjectId } | null {
  const adminActor = (req as any).adminActor;
  if (!adminActor?._id) return null;
  return adminActor;
}

function serializePartner(doc: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  region?: string;
  status: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? undefined,
    region: doc.region ?? undefined,
    status: doc.status,
    notes: doc.notes ?? undefined,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function serializeProspect(
  doc: {
    _id: Types.ObjectId;
    businessName: string;
    contactName?: string;
    email?: string;
    phone?: string;
    website?: string;
    location?: string;
    status: string;
    closedReason?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
  },
  extras?: { protectedBy?: string | null }
) {
  return {
    id: doc._id.toString(),
    businessName: doc.businessName,
    contactName: doc.contactName ?? undefined,
    email: doc.email ?? undefined,
    phone: doc.phone ?? undefined,
    website: doc.website ?? undefined,
    location: doc.location ?? undefined,
    status: doc.status,
    closedReason: doc.closedReason ?? undefined,
    notes: doc.notes ?? undefined,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
    protectedBy: extras?.protectedBy ?? null,
  };
}

function serializeProtection(
  doc: {
    _id: Types.ObjectId;
    partnerId: Types.ObjectId;
    prospectId: Types.ObjectId;
    introducedAt: Date;
    protectionStatus: string;
    lifecycleStatus?: string;
    lifecycleStatusUpdatedAt?: Date;
    lifecycleStatusUpdatedBy?: Types.ObjectId;
    protectionExpiresAt?: Date | null;
    evidenceSummary: string;
    approvalNotes?: string;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  },
  extras?: {
    partnerName?: string;
    prospectBusinessName?: string;
    lastActivityAt?: string | null;
    relationshipAgeDays?: number | null;
    daysSinceLastActivity?: number | null;
    healthStatus?: HealthStatus | null;
  }
) {
  return {
    id: doc._id.toString(),
    partnerId: doc.partnerId.toString(),
    prospectId: doc.prospectId.toString(),
    partnerName: extras?.partnerName,
    prospectBusinessName: extras?.prospectBusinessName,
    introducedAt: toIso(doc.introducedAt),
    protectionStatus: doc.protectionStatus,
    lifecycleStatus: resolveLifecycleStatus(
      doc.lifecycleStatus as (typeof LIFECYCLE_STATUSES)[number] | undefined,
      doc.protectionStatus
    ),
    lifecycleStatusUpdatedAt: toIso(doc.lifecycleStatusUpdatedAt),
    lifecycleStatusUpdatedBy: doc.lifecycleStatusUpdatedBy?.toString(),
    lastActivityAt: extras?.lastActivityAt ?? undefined,
    relationshipAgeDays: extras?.relationshipAgeDays ?? undefined,
    daysSinceLastActivity: extras?.daysSinceLastActivity ?? undefined,
    healthStatus: extras?.healthStatus ?? undefined,
    protectionExpiresAt: toIso(doc.protectionExpiresAt ?? undefined) ?? null,
    evidenceSummary: doc.evidenceSummary,
    approvalNotes: doc.approvalNotes ?? undefined,
    approvedBy: doc.approvedBy?.toString(),
    approvedAt: toIso(doc.approvedAt),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

type ProtectionLeanDoc = {
  _id: Types.ObjectId;
  partnerId: Types.ObjectId;
  prospectId: Types.ObjectId;
  introducedAt: Date;
  protectionStatus: string;
  lifecycleStatus?: string;
  lifecycleStatusUpdatedAt?: Date;
  lifecycleStatusUpdatedBy?: Types.ObjectId;
  protectionExpiresAt?: Date | null;
  evidenceSummary: string;
  approvalNotes?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

function buildProtectionHealthExtras(
  row: ProtectionLeanDoc,
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

async function loadProtectionNameMaps(rows: ProtectionLeanDoc[]) {
  const partnerIds = [...new Set(rows.map((r) => r.partnerId.toString()))].map(
    (id) => new Types.ObjectId(id)
  );
  const prospectIds = [...new Set(rows.map((r) => r.prospectId.toString()))].map(
    (id) => new Types.ObjectId(id)
  );

  const [partners, prospects] = await Promise.all([
    partnerIds.length > 0
      ? FoundingPartner.find({ _id: { $in: partnerIds } }).select("_id name").lean()
      : Promise.resolve([]),
    prospectIds.length > 0
      ? FoundingProspect.find({ _id: { $in: prospectIds } }).select("_id businessName").lean()
      : Promise.resolve([]),
  ]);

  return {
    partnerNameById: new Map(partners.map((p) => [p._id.toString(), p.name])),
    prospectNameById: new Map(prospects.map((p) => [p._id.toString(), p.businessName])),
  };
}

function serializeNote(
  doc: {
    _id: Types.ObjectId;
    partnerId?: Types.ObjectId;
    prospectId?: Types.ObjectId;
    relationshipProtectionId?: Types.ObjectId;
    type: string;
    summary: string;
    followUpDate?: Date;
    createdBy: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  },
  extras?: { createdByName?: string }
) {
  return {
    id: doc._id.toString(),
    partnerId: doc.partnerId?.toString(),
    prospectId: doc.prospectId?.toString(),
    relationshipProtectionId: doc.relationshipProtectionId?.toString(),
    type: doc.type,
    summary: doc.summary,
    followUpDate: toIso(doc.followUpDate),
    createdBy: doc.createdBy.toString(),
    createdByName: extras?.createdByName,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

async function auditFromReq(
  req: Request,
  args: {
    action: string;
    entityType: "partner" | "prospect" | "relationshipProtection" | "communicationNote";
    entityId: Types.ObjectId;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> {
  const adminActor = getAdminActor(req);
  if (!adminActor) return;
  await trackFoundingPartnerAudit({
    actorId: adminActor._id,
    ...args,
  });
}

// ─── Partners ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/founding-partners/partners
 */
router.get("/partners", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const q = parseQ(req.query);
    const statusRaw = String(req.query.status ?? "all").trim();
    const status =
      statusRaw === "active" || statusRaw === "paused" || statusRaw === "inactive"
        ? statusRaw
        : undefined;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { region: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      FoundingPartner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FoundingPartner.countDocuments(filter),
    ]);

    return res.json({
      items: items.map((p) => serializePartner(p as any)),
      total,
      limit,
      skip,
    });
  } catch (err) {
    console.error("[FoundingPartners] GET partners", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/partners
 */
router.post("/partners", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const { name, email, phone, region, status, notes } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      region?: string;
      status?: string;
      notes?: string;
    };

    const nameTrim = name ? String(name).trim() : "";
    const emailNorm = normalizeEmail(email);
    if (!nameTrim) return res.status(400).json({ message: "name is required" });
    if (!emailNorm) return res.status(400).json({ message: "Valid email is required" });
    if (status && !PARTNER_STATUSES.includes(status as (typeof PARTNER_STATUSES)[number])) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const partner = await FoundingPartner.create({
      name: nameTrim,
      email: emailNorm,
      phone: phone ? String(phone).trim() : undefined,
      region: region ? String(region).trim() : undefined,
      status: status ?? "active",
      notes: notes ? String(notes).trim() : undefined,
    });

    const serialized = serializePartner(partner);
    await auditFromReq(req, {
      action: "founding_partner.create",
      entityType: "partner",
      entityId: partner._id,
      after: serialized,
    });

    return res.status(201).json(serialized);
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: "Partner email already exists" });
    console.error("[FoundingPartners] POST partners", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/admin/founding-partners/partners/:id
 */
router.get("/partners/:id", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid partner id" });

    const partner = await FoundingPartner.findById(id).lean();
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const [protectionCount, noteCount] = await Promise.all([
      RelationshipProtection.countDocuments({ partnerId: id }),
      CommunicationNote.countDocuments({ partnerId: id }),
    ]);

    return res.json({
      ...serializePartner(partner as any),
      counts: { relationshipProtections: protectionCount, communicationNotes: noteCount },
    });
  } catch (err) {
    console.error("[FoundingPartners] GET partner", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/admin/founding-partners/partners/:id
 */
router.patch("/partners/:id", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid partner id" });

    const partner = await FoundingPartner.findById(id);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    const before = serializePartner(partner);
    const { name, email, phone, region, status, notes } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      region?: string;
      status?: string;
      notes?: string;
    };

    if (name !== undefined) {
      const nameTrim = String(name).trim();
      if (!nameTrim) return res.status(400).json({ message: "name cannot be empty" });
      partner.name = nameTrim;
    }
    if (email !== undefined) {
      const emailNorm = normalizeEmail(email);
      if (!emailNorm) return res.status(400).json({ message: "Valid email is required" });
      partner.email = emailNorm;
    }
    if (phone !== undefined) partner.phone = phone ? String(phone).trim() : undefined;
    if (region !== undefined) partner.region = region ? String(region).trim() : undefined;
    if (status !== undefined) {
      if (!PARTNER_STATUSES.includes(status as (typeof PARTNER_STATUSES)[number])) {
        return res.status(400).json({ message: "Invalid status" });
      }
      partner.status = status as (typeof PARTNER_STATUSES)[number];
    }
    if (notes !== undefined) partner.notes = notes ? String(notes).trim() : undefined;

    await partner.save();
    const after = serializePartner(partner);
    await auditFromReq(req, {
      action: "founding_partner.update",
      entityType: "partner",
      entityId: partner._id,
      before,
      after,
    });

    return res.json(after);
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ message: "Partner email already exists" });
    console.error("[FoundingPartners] PATCH partner", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Prospects ──────────────────────────────────────────────────────────────

/**
 * GET /api/admin/founding-partners/prospects/duplicates
 * Advisory duplicate detection (must be registered before /prospects/:id).
 */
router.get("/prospects/duplicates", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const excludeId = parseObjectId(
      typeof req.query.excludeId === "string" ? req.query.excludeId : undefined
    );
    const matches = await findDuplicateProspects(
      {
        businessName: typeof req.query.businessName === "string" ? req.query.businessName : undefined,
        email: typeof req.query.email === "string" ? req.query.email : undefined,
        phone: typeof req.query.phone === "string" ? req.query.phone : undefined,
        website: typeof req.query.website === "string" ? req.query.website : undefined,
        excludeId: excludeId ?? undefined,
      },
      parseLimit(req.query, 10, 20)
    );

    return res.json({ matches });
  } catch (err) {
    console.error("[FoundingPartners] GET prospect duplicates", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/admin/founding-partners/prospects
 */
router.get("/prospects", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const q = parseQ(req.query);
    const statusRaw = String(req.query.status ?? "all").trim();
    const status = PROSPECT_STATUSES.includes(statusRaw as (typeof PROSPECT_STATUSES)[number])
      ? statusRaw
      : undefined;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { businessName: { $regex: q, $options: "i" } },
        { contactName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { website: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      FoundingProspect.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FoundingProspect.countDocuments(filter),
    ]);

    const prospectIds = items.map((p) => p._id as Types.ObjectId);
    const ownershipMap = await buildProspectOwnershipMap(prospectIds);

    return res.json({
      items: items.map((p) => {
        const ownership = ownershipMap.get(p._id.toString());
        return serializeProspect(p as any, { protectedBy: ownership?.protectedBy ?? null });
      }),
      total,
      limit,
      skip,
    });
  } catch (err) {
    console.error("[FoundingPartners] GET prospects", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/prospects
 */
router.post("/prospects", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const { businessName, contactName, email, phone, website, location, status, closedReason, notes } =
      req.body as {
        businessName?: string;
        contactName?: string;
        email?: string;
        phone?: string;
        website?: string;
        location?: string;
        status?: string;
        closedReason?: string;
        notes?: string;
      };

    const businessNameTrim = businessName ? String(businessName).trim() : "";
    if (!businessNameTrim) return res.status(400).json({ message: "businessName is required" });
    if (status && !PROSPECT_STATUSES.includes(status as (typeof PROSPECT_STATUSES)[number])) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const prospect = await FoundingProspect.create({
      businessName: businessNameTrim,
      contactName: contactName ? String(contactName).trim() : undefined,
      email: email ? normalizeEmail(email) : undefined,
      phone: phone ? String(phone).trim() : undefined,
      website: website ? String(website).trim() : undefined,
      location: location ? String(location).trim() : undefined,
      status: (status as FoundingProspectStatus) ?? "new",
      closedReason: closedReason ? String(closedReason).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
    });

    const possibleDuplicates = await findDuplicateProspects(
      {
        businessName: prospect.businessName,
        email: prospect.email,
        phone: prospect.phone,
        website: prospect.website,
        excludeId: prospect._id,
      },
      5
    );

    const serialized = serializeProspect(prospect, { protectedBy: null });
    await auditFromReq(req, {
      action: "founding_prospect.create",
      entityType: "prospect",
      entityId: prospect._id,
      after: serialized,
    });

    return res.status(201).json({ ...serialized, possibleDuplicates });
  } catch (err) {
    console.error("[FoundingPartners] POST prospects", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/admin/founding-partners/prospects/:id
 */
router.get("/prospects/:id", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid prospect id" });

    const prospect = await FoundingProspect.findById(id).lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const [relationshipOwnership, pendingIntroductions, noteCount, protectionCount] =
      await Promise.all([
        getProspectOwnershipDetail(id),
        getPendingIntroductionsForProspect(id),
        CommunicationNote.countDocuments({ prospectId: id }),
        RelationshipProtection.countDocuments({ prospectId: id }),
      ]);

    return res.json({
      ...serializeProspect(prospect as any, {
        protectedBy: relationshipOwnership?.protectedBy?.partnerName ?? null,
      }),
      relationshipOwnership,
      pendingIntroductions,
      counts: {
        communicationNotes: noteCount,
        relationshipProtections: protectionCount,
      },
    });
  } catch (err) {
    console.error("[FoundingPartners] GET prospect", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/admin/founding-partners/prospects/:id
 */
router.patch("/prospects/:id", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid prospect id" });

    const prospect = await FoundingProspect.findById(id);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const before = serializeProspect(prospect);
    const {
      businessName,
      contactName,
      email,
      phone,
      website,
      location,
      status,
      closedReason,
      notes,
    } = req.body as {
      businessName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      website?: string;
      location?: string;
      status?: string;
      closedReason?: string;
      notes?: string;
    };

    if (businessName !== undefined) {
      const trim = String(businessName).trim();
      if (!trim) return res.status(400).json({ message: "businessName cannot be empty" });
      prospect.businessName = trim;
    }
    if (contactName !== undefined) prospect.contactName = contactName ? String(contactName).trim() : undefined;
    if (email !== undefined) prospect.email = email ? normalizeEmail(email) : undefined;
    if (phone !== undefined) prospect.phone = phone ? String(phone).trim() : undefined;
    if (website !== undefined) prospect.website = website ? String(website).trim() : undefined;
    if (location !== undefined) prospect.location = location ? String(location).trim() : undefined;
    if (status !== undefined) {
      if (!PROSPECT_STATUSES.includes(status as (typeof PROSPECT_STATUSES)[number])) {
        return res.status(400).json({ message: "Invalid status" });
      }
      prospect.status = status as FoundingProspectStatus;
    }
    if (closedReason !== undefined) prospect.closedReason = closedReason ? String(closedReason).trim() : undefined;
    if (notes !== undefined) prospect.notes = notes ? String(notes).trim() : undefined;

    await prospect.save();

    const possibleDuplicates = await findDuplicateProspects(
      {
        businessName: prospect.businessName,
        email: prospect.email,
        phone: prospect.phone,
        website: prospect.website,
        excludeId: prospect._id,
      },
      5
    );

    const relationshipOwnership = await getProspectOwnershipDetail(id);
    const after = serializeProspect(prospect, {
      protectedBy: relationshipOwnership?.protectedBy?.partnerName ?? null,
    });

    await auditFromReq(req, {
      action: "founding_prospect.update",
      entityType: "prospect",
      entityId: prospect._id,
      before,
      after,
    });

    return res.json({ ...after, possibleDuplicates, relationshipOwnership });
  } catch (err) {
    console.error("[FoundingPartners] PATCH prospect", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Relationship Protections ───────────────────────────────────────────────

/**
 * GET /api/admin/founding-partners/relationship-protections
 */
router.get("/relationship-protections", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const partnerId = parseObjectId(
      typeof req.query.partnerId === "string" ? req.query.partnerId : undefined
    );
    const prospectId = parseObjectId(
      typeof req.query.prospectId === "string" ? req.query.prospectId : undefined
    );
    const statusRaw = String(req.query.protectionStatus ?? "all").trim();
    const protectionStatus = PROTECTION_STATUSES.includes(
      statusRaw as (typeof PROTECTION_STATUSES)[number]
    )
      ? statusRaw
      : undefined;
    const lifecycleRaw = String(req.query.lifecycleStatus ?? "all").trim();
    const lifecycleStatus = LIFECYCLE_STATUSES.includes(
      lifecycleRaw as (typeof LIFECYCLE_STATUSES)[number]
    )
      ? lifecycleRaw
      : undefined;
    const healthRaw = String(req.query.healthStatus ?? "all").trim();
    const healthStatusFilter = HEALTH_STATUSES.includes(
      healthRaw as (typeof HEALTH_STATUSES)[number]
    )
      ? (healthRaw as (typeof HEALTH_STATUSES)[number])
      : healthRaw === "all"
        ? undefined
        : null;

    if (healthStatusFilter === null) {
      return res.status(400).json({ message: "Invalid healthStatus" });
    }

    const filter: Record<string, unknown> = {};
    if (partnerId) filter.partnerId = partnerId;
    if (prospectId) filter.prospectId = prospectId;
    if (protectionStatus) filter.protectionStatus = protectionStatus;
    if (lifecycleStatus) filter.lifecycleStatus = lifecycleStatus;

    const sort = { createdAt: -1 as const };

    if (healthStatusFilter) {
      const allItems = await RelationshipProtection.find(filter).sort(sort).lean();
      const activityMap = await getProtectionLastActivityMap(
        allItems.map((r) => r._id as Types.ObjectId)
      );

      const matched = allItems.filter((row) => {
        const health = buildProtectionHealthExtras(row as ProtectionLeanDoc, activityMap);
        return health.healthStatus === healthStatusFilter;
      });

      const pageItems = matched.slice(skip, skip + limit);
      const { partnerNameById, prospectNameById } = await loadProtectionNameMaps(
        pageItems as ProtectionLeanDoc[]
      );

      return res.json({
        items: pageItems.map((row) => {
          const healthExtras = buildProtectionHealthExtras(row as ProtectionLeanDoc, activityMap);
          return serializeProtection(row as ProtectionLeanDoc, {
            partnerName: partnerNameById.get(row.partnerId.toString()),
            prospectBusinessName: prospectNameById.get(row.prospectId.toString()),
            ...healthExtras,
          });
        }),
        total: matched.length,
        limit,
        skip,
      });
    }

    const [items, total] = await Promise.all([
      RelationshipProtection.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      RelationshipProtection.countDocuments(filter),
    ]);

    const activityMap = await getProtectionLastActivityMap(
      items.map((r) => r._id as Types.ObjectId)
    );
    const { partnerNameById, prospectNameById } = await loadProtectionNameMaps(
      items as ProtectionLeanDoc[]
    );

    return res.json({
      items: items.map((row) => {
        const healthExtras = buildProtectionHealthExtras(row as ProtectionLeanDoc, activityMap);
        return serializeProtection(row as ProtectionLeanDoc, {
          partnerName: partnerNameById.get(row.partnerId.toString()),
          prospectBusinessName: prospectNameById.get(row.prospectId.toString()),
          ...healthExtras,
        });
      }),
      total,
      limit,
      skip,
    });
  } catch (err) {
    console.error("[FoundingPartners] GET relationship-protections", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/relationship-protections
 */
router.post("/relationship-protections", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const { partnerId, prospectId, introducedAt, evidenceSummary } = req.body as {
      partnerId?: string;
      prospectId?: string;
      introducedAt?: string;
      evidenceSummary?: string;
    };

    const partnerOid = parseObjectId(partnerId);
    const prospectOid = parseObjectId(prospectId);
    if (!partnerOid) return res.status(400).json({ message: "Valid partnerId is required" });
    if (!prospectOid) return res.status(400).json({ message: "Valid prospectId is required" });

    const evidenceTrim = evidenceSummary ? String(evidenceSummary).trim() : "";
    if (!evidenceTrim) return res.status(400).json({ message: "evidenceSummary is required" });

    const [partner, prospect] = await Promise.all([
      FoundingPartner.findById(partnerOid).select("_id").lean(),
      FoundingProspect.findById(prospectOid).select("_id").lean(),
    ]);
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    let introducedDate = new Date();
    if (introducedAt) {
      const parsed = new Date(introducedAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid introducedAt" });
      }
      introducedDate = parsed;
    }

    const protection = await RelationshipProtection.create({
      partnerId: partnerOid,
      prospectId: prospectOid,
      introducedAt: introducedDate,
      protectionStatus: "pending",
      protectionExpiresAt: null,
      evidenceSummary: evidenceTrim,
    });

    const serialized = serializeProtection(protection);
    await auditFromReq(req, {
      action: "relationship_protection.create",
      entityType: "relationshipProtection",
      entityId: protection._id,
      after: serialized,
    });

    return res.status(201).json(serialized);
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "A pending or approved protection already exists for this partner and prospect",
      });
    }
    console.error("[FoundingPartners] POST relationship-protections", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/relationship-protections/:id/approve
 */
router.post("/relationship-protections/:id/approve", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid protection id" });

    const protection = await RelationshipProtection.findById(id);
    if (!protection) return res.status(404).json({ message: "Relationship protection not found" });
    if (protection.protectionStatus !== "pending") {
      return res.status(400).json({ message: "Only pending protections can be approved" });
    }

    const conflict = await hasApprovedProtectionForProspect(protection.prospectId, protection._id);
    if (conflict) {
      return res.status(409).json({
        message: "Another approved protection already exists for this prospect",
      });
    }

    const adminActor = getAdminActor(req)!;
    const before = serializeProtection(protection);
    const { approvalNotes } = req.body as { approvalNotes?: string };

    protection.protectionStatus = "approved";
    protection.lifecycleStatus = "protected";
    protection.lifecycleStatusUpdatedAt = new Date();
    protection.lifecycleStatusUpdatedBy = adminActor._id;
    protection.approvedBy = adminActor._id;
    protection.approvedAt = new Date();
    protection.protectionExpiresAt = null;
    if (approvalNotes !== undefined) {
      protection.approvalNotes = approvalNotes ? String(approvalNotes).trim() : undefined;
    }

    await protection.save();
    const after = serializeProtection(protection);

    await auditFromReq(req, {
      action: "relationship_protection.approve",
      entityType: "relationshipProtection",
      entityId: protection._id,
      before,
      after,
    });

    return res.json(after);
  } catch (err) {
    console.error("[FoundingPartners] POST approve", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/relationship-protections/:id/decline
 */
router.post("/relationship-protections/:id/decline", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid protection id" });

    const protection = await RelationshipProtection.findById(id);
    if (!protection) return res.status(404).json({ message: "Relationship protection not found" });
    if (protection.protectionStatus !== "pending") {
      return res.status(400).json({ message: "Only pending protections can be declined" });
    }

    const before = serializeProtection(protection);
    const { approvalNotes } = req.body as { approvalNotes?: string };

    protection.protectionStatus = "declined";
    if (approvalNotes !== undefined) {
      protection.approvalNotes = approvalNotes ? String(approvalNotes).trim() : undefined;
    }

    await protection.save();
    const after = serializeProtection(protection);

    await auditFromReq(req, {
      action: "relationship_protection.decline",
      entityType: "relationshipProtection",
      entityId: protection._id,
      before,
      after,
    });

    return res.json(after);
  } catch (err) {
    console.error("[FoundingPartners] POST decline", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/relationship-protections/:id/release
 */
router.post("/relationship-protections/:id/release", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid protection id" });

    const protection = await RelationshipProtection.findById(id);
    if (!protection) return res.status(404).json({ message: "Relationship protection not found" });
    if (protection.protectionStatus !== "approved") {
      return res.status(400).json({ message: "Only approved protections can be released" });
    }

    const before = serializeProtection(protection);
    const { approvalNotes } = req.body as { approvalNotes?: string };

    protection.protectionStatus = "released";
    if (approvalNotes !== undefined) {
      protection.approvalNotes = approvalNotes ? String(approvalNotes).trim() : undefined;
    }

    await protection.save();
    const after = serializeProtection(protection);

    await auditFromReq(req, {
      action: "relationship_protection.release",
      entityType: "relationshipProtection",
      entityId: protection._id,
      before,
      after,
    });

    return res.json(after);
  } catch (err) {
    console.error("[FoundingPartners] POST release", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/admin/founding-partners/relationship-protections/:id
 */
router.get("/relationship-protections/:id", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid protection id" });

    const protection = await RelationshipProtection.findById(id).lean();
    if (!protection) return res.status(404).json({ message: "Relationship protection not found" });

    const [partner, prospect, noteCount, lastActivityAt] = await Promise.all([
      FoundingPartner.findById(protection.partnerId).select("name email").lean(),
      FoundingProspect.findById(protection.prospectId).select("businessName status").lean(),
      CommunicationNote.countDocuments({ relationshipProtectionId: id }),
      getProtectionLastActivityAt(id),
    ]);

    return res.json({
      ...serializeProtection(protection as any, {
        partnerName: partner?.name,
        prospectBusinessName: prospect?.businessName,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      }),
      partner: partner
        ? { id: partner._id.toString(), name: partner.name, email: partner.email }
        : undefined,
      prospect: prospect
        ? {
            id: prospect._id.toString(),
            businessName: prospect.businessName,
            status: prospect.status,
          }
        : undefined,
      counts: { communicationNotes: noteCount },
    });
  } catch (err) {
    console.error("[FoundingPartners] GET relationship-protection", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/admin/founding-partners/relationship-protections/:id
 */
router.patch("/relationship-protections/:id", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid protection id" });

    const protection = await RelationshipProtection.findById(id);
    if (!protection) return res.status(404).json({ message: "Relationship protection not found" });

    const adminActor = getAdminActor(req)!;
    const before = serializeProtection(protection);
    const { introducedAt, evidenceSummary, lifecycleStatus } = req.body as {
      introducedAt?: string;
      evidenceSummary?: string;
      lifecycleStatus?: string;
    };

    const hasLifecycleUpdate = lifecycleStatus !== undefined;
    const hasPendingFields = introducedAt !== undefined || evidenceSummary !== undefined;

    if (hasLifecycleUpdate && hasPendingFields) {
      return res.status(400).json({
        message: "Cannot update lifecycle and pending fields in the same request",
      });
    }

    if (hasLifecycleUpdate) {
      if (protection.protectionStatus !== "approved") {
        return res.status(400).json({
          message: "Lifecycle can only be updated on approved protections",
        });
      }
      if (!LIFECYCLE_STATUSES.includes(lifecycleStatus as (typeof LIFECYCLE_STATUSES)[number])) {
        return res.status(400).json({ message: "Invalid lifecycleStatus" });
      }

      const current = resolveLifecycleStatus(protection.lifecycleStatus, protection.protectionStatus);
      const next = lifecycleStatus as (typeof LIFECYCLE_STATUSES)[number];
      if (!isValidLifecycleAdvance(current, next)) {
        return res.status(400).json({
          message: "Lifecycle can only advance one stage at a time (protected → connected → engaged)",
        });
      }

      protection.lifecycleStatus = next;
      protection.lifecycleStatusUpdatedAt = new Date();
      protection.lifecycleStatusUpdatedBy = adminActor._id;

      await protection.save();
      const lastActivityAt = await getProtectionLastActivityAt(protection._id as Types.ObjectId);
      const after = serializeProtection(protection, {
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      });

      await auditFromReq(req, {
        action: "relationship_protection.lifecycle_update",
        entityType: "relationshipProtection",
        entityId: protection._id,
        before,
        after,
      });

      return res.json(after);
    }

    if (protection.protectionStatus !== "pending") {
      return res.status(400).json({ message: "Only pending protections can be edited" });
    }

    if (introducedAt !== undefined) {
      const parsed = new Date(introducedAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid introducedAt" });
      }
      protection.introducedAt = parsed;
    }
    if (evidenceSummary !== undefined) {
      const trim = String(evidenceSummary).trim();
      if (!trim) return res.status(400).json({ message: "evidenceSummary cannot be empty" });
      protection.evidenceSummary = trim;
    }

    await protection.save();
    const after = serializeProtection(protection);

    await auditFromReq(req, {
      action: "relationship_protection.update",
      entityType: "relationshipProtection",
      entityId: protection._id,
      before,
      after,
    });

    return res.json(after);
  } catch (err) {
    console.error("[FoundingPartners] PATCH relationship-protection", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Communication Notes ────────────────────────────────────────────────────

/**
 * GET /api/admin/founding-partners/communication-notes
 */
router.get("/communication-notes", async (req: Request, res: Response) => {
  try {
    if (!getAdminActor(req)) return res.status(401).json({ message: "Unauthorized" });

    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const partnerId = parseObjectId(
      typeof req.query.partnerId === "string" ? req.query.partnerId : undefined
    );
    const prospectId = parseObjectId(
      typeof req.query.prospectId === "string" ? req.query.prospectId : undefined
    );
    const relationshipProtectionId = parseObjectId(
      typeof req.query.relationshipProtectionId === "string"
        ? req.query.relationshipProtectionId
        : undefined
    );

    const filter: Record<string, unknown> = {};
    if (partnerId) filter.partnerId = partnerId;
    if (prospectId) filter.prospectId = prospectId;
    if (relationshipProtectionId) filter.relationshipProtectionId = relationshipProtectionId;

    if (Object.keys(filter).length === 0) {
      return res.status(400).json({
        message: "At least one filter is required: partnerId, prospectId, or relationshipProtectionId",
      });
    }

    const [items, total] = await Promise.all([
      CommunicationNote.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CommunicationNote.countDocuments(filter),
    ]);

    const creatorIds = [...new Set(items.map((n) => n.createdBy.toString()))].map(
      (id) => new Types.ObjectId(id)
    );
    const creators = await User.find({ _id: { $in: creatorIds } }).select("_id name email").lean();
    const creatorNameById = new Map(
      creators.map((u) => [u._id.toString(), u.name || u.email || "Admin"])
    );

    return res.json({
      items: items.map((note) =>
        serializeNote(note as any, {
          createdByName: creatorNameById.get(note.createdBy.toString()),
        })
      ),
      total,
      limit,
      skip,
    });
  } catch (err) {
    console.error("[FoundingPartners] GET communication-notes", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/admin/founding-partners/communication-notes
 */
router.post("/communication-notes", async (req: Request, res: Response) => {
  try {
    const adminActor = getAdminActor(req);
    if (!adminActor) return res.status(401).json({ message: "Unauthorized" });

    const { partnerId, prospectId, relationshipProtectionId, type, summary, followUpDate } =
      req.body as {
        partnerId?: string;
        prospectId?: string;
        relationshipProtectionId?: string;
        type?: string;
        summary?: string;
        followUpDate?: string;
      };

    const partnerOid = partnerId ? parseObjectId(partnerId) : null;
    const prospectOid = prospectId ? parseObjectId(prospectId) : null;
    const protectionOid = relationshipProtectionId ? parseObjectId(relationshipProtectionId) : null;

    if (partnerId && !partnerOid) return res.status(400).json({ message: "Invalid partnerId" });
    if (prospectId && !prospectOid) return res.status(400).json({ message: "Invalid prospectId" });
    if (relationshipProtectionId && !protectionOid) {
      return res.status(400).json({ message: "Invalid relationshipProtectionId" });
    }
    if (!partnerOid && !prospectOid && !protectionOid) {
      return res.status(400).json({
        message: "At least one of partnerId, prospectId, or relationshipProtectionId is required",
      });
    }

    let resolvedPartnerId = partnerOid;
    let resolvedProspectId = prospectOid;
    let resolvedProtectionId = protectionOid;

    if (protectionOid) {
      const protection = await RelationshipProtection.findById(protectionOid)
        .select("partnerId prospectId")
        .lean();
      if (!protection) {
        return res.status(404).json({ message: "Relationship protection not found" });
      }
      resolvedPartnerId = protection.partnerId as Types.ObjectId;
      resolvedProspectId = protection.prospectId as Types.ObjectId;
      resolvedProtectionId = protectionOid;
    } else if (prospectOid) {
      const approved = await getApprovedProtectionForProspect(prospectOid);
      if (approved) {
        resolvedProtectionId = approved._id as Types.ObjectId;
        resolvedPartnerId = approved.partnerId as Types.ObjectId;
        resolvedProspectId = approved.prospectId as Types.ObjectId;
      }
    }

    if (!type || !NOTE_TYPES.includes(type as (typeof NOTE_TYPES)[number])) {
      return res.status(400).json({ message: "Invalid note type" });
    }

    const summaryTrim = summary ? String(summary).trim() : "";
    if (!summaryTrim) return res.status(400).json({ message: "summary is required" });

    let followUp: Date | undefined;
    if (followUpDate) {
      const parsed = new Date(followUpDate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid followUpDate" });
      }
      followUp = parsed;
    }

    const note = await CommunicationNote.create({
      partnerId: resolvedPartnerId ?? undefined,
      prospectId: resolvedProspectId ?? undefined,
      relationshipProtectionId: resolvedProtectionId ?? undefined,
      type,
      summary: summaryTrim,
      followUpDate: followUp,
      createdBy: adminActor._id,
    });

    const creator = await User.findById(adminActor._id).select("name email").lean();
    const serialized = serializeNote(note, {
      createdByName: creator?.name || creator?.email || "Admin",
    });

    await auditFromReq(req, {
      action: "communication_note.create",
      entityType: "communicationNote",
      entityId: note._id,
      after: serialized,
    });

    return res.status(201).json(serialized);
  } catch (err) {
    console.error("[FoundingPartners] POST communication-notes", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
