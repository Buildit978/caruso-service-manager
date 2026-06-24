import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { CommunicationNote } from "../../models/communicationNote.model";
import { FoundingProspect } from "../../models/foundingProspect.model";
import {
  PartnerProspectRelationship,
  type PartnerRelationshipStage,
} from "../../models/partnerProspectRelationship.model";
import { RelationshipProtection } from "../../models/relationshipProtection.model";
import { findDuplicateProspects } from "../../utils/foundingPartners/duplicateProspects";
import { normalizeEmail } from "../../utils/foundingPartners/normalize";
import {
  advancePartnerRelationshipStage,
  isPartnerStewarding,
} from "../../utils/foundingPartners/partnerRelationshipStage";

const router = Router();

const PARTNER_NOTE_TYPES = ["call", "email", "walkIn", "meeting", "demo", "followUp"] as const;
type PartnerNoteType = (typeof PARTNER_NOTE_TYPES)[number];

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

function serializeBusiness(prospect: {
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

function serializeNote(note: {
  _id: Types.ObjectId;
  type: string;
  summary: string;
  isMeaningful?: boolean;
  followUpDate?: Date;
  createdAt?: Date;
}) {
  return {
    id: note._id.toString(),
    type: note.type,
    summary: note.summary,
    isMeaningful: note.isMeaningful === true,
    followUpDate: toIso(note.followUpDate),
    createdAt: toIso(note.createdAt),
  };
}

function serializeRelationship(row: {
  stage: PartnerRelationshipStage;
  introducedAt: Date;
  stageUpdatedAt: Date;
}) {
  return {
    stage: row.stage,
    introducedAt: toIso(row.introducedAt),
    stageUpdatedAt: toIso(row.stageUpdatedAt),
    isStewarding: isPartnerStewarding(row.stage),
  };
}

async function partnerHasApprovedProtection(
  partnerId: Types.ObjectId,
  prospectId: Types.ObjectId
): Promise<boolean> {
  const count = await RelationshipProtection.countDocuments({
    partnerId,
    prospectId,
    protectionStatus: "approved",
  });
  return count > 0;
}

async function findPartnerIntroduction(
  partnerId: Types.ObjectId,
  prospectId: Types.ObjectId
) {
  return PartnerProspectRelationship.findOne({ partnerId, prospectId });
}

function findLastMeaningfulNote(
  notes: Array<{ isMeaningful?: boolean; type: string; summary: string; createdAt?: Date; _id: Types.ObjectId; followUpDate?: Date }>
) {
  return notes.find((n) => n.isMeaningful === true) ?? null;
}

/**
 * POST /api/partner/introductions
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const actor = getPartnerActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const {
      businessName,
      ownerName,
      phone,
      email,
      address,
      conversationNotes,
      isMeaningful,
      type,
    } = req.body as {
      businessName?: string;
      ownerName?: string;
      phone?: string;
      email?: string;
      address?: string;
      conversationNotes?: string;
      isMeaningful?: boolean;
      type?: string;
    };

    const businessNameTrim = businessName ? String(businessName).trim() : "";
    const ownerNameTrim = ownerName ? String(ownerName).trim() : "";
    const notesTrim = conversationNotes ? String(conversationNotes).trim() : "";

    if (!businessNameTrim) return res.status(400).json({ message: "businessName is required" });
    if (!ownerNameTrim) return res.status(400).json({ message: "ownerName is required" });
    if (!notesTrim) return res.status(400).json({ message: "conversationNotes is required" });

    const noteType = type && PARTNER_NOTE_TYPES.includes(type as PartnerNoteType) ? type : "walkIn";
    const meaningful = isMeaningful === true;

    const prospect = await FoundingProspect.create({
      businessName: businessNameTrim,
      contactName: ownerNameTrim,
      email: email ? normalizeEmail(email) : undefined,
      phone: phone ? String(phone).trim() : undefined,
      location: address ? String(address).trim() : undefined,
      status: "new",
    });

    const now = new Date();
    const initialStage = advancePartnerRelationshipStage("introduced", meaningful);

    const relationship = await PartnerProspectRelationship.create({
      partnerId: actor.partnerId,
      prospectId: prospect._id,
      stage: initialStage,
      introducedAt: now,
      stageUpdatedAt: now,
    });

    const note = await CommunicationNote.create({
      partnerId: actor.partnerId,
      prospectId: prospect._id,
      type: noteType,
      summary: notesTrim,
      isMeaningful: meaningful,
      createdBy: actor.userId,
    });

    const possibleDuplicates = await findDuplicateProspects(
      {
        businessName: prospect.businessName,
        email: prospect.email,
        phone: prospect.phone,
        excludeId: prospect._id as Types.ObjectId,
      },
      5
    );

    return res.status(201).json({
      business: serializeBusiness(prospect as any),
      relationship: serializeRelationship(relationship),
      note: serializeNote(note),
      possibleDuplicates,
    });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return res.status(409).json({ message: "You already have an introduction for this business" });
    }
    console.error("[PartnerIntroductionCreate] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/partner/introductions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const actor = getPartnerActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);

    const relationships = await PartnerProspectRelationship.find({ partnerId: actor.partnerId })
      .sort({ stageUpdatedAt: -1 })
      .lean();

    if (relationships.length === 0) {
      return res.json({ items: [], total: 0, limit, skip });
    }

    const prospectIds = relationships.map((r) => r.prospectId as Types.ObjectId);

    const approvedPairs = await RelationshipProtection.find({
      partnerId: actor.partnerId,
      prospectId: { $in: prospectIds },
      protectionStatus: "approved",
    })
      .select("prospectId")
      .lean();
    const approvedProspectIds = new Set(approvedPairs.map((p) => p.prospectId.toString()));

    const filtered = relationships.filter((r) => !approvedProspectIds.has(r.prospectId.toString()));
    const total = filtered.length;
    const page = filtered.slice(skip, skip + limit);

    const pageProspectIds = page.map((r) => r.prospectId as Types.ObjectId);
    const prospects = await FoundingProspect.find({ _id: { $in: pageProspectIds } }).lean();
    const prospectById = new Map(prospects.map((p) => [p._id.toString(), p]));

    const meaningfulNotes = await CommunicationNote.find({
      partnerId: actor.partnerId,
      prospectId: { $in: pageProspectIds },
      isMeaningful: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const lastMeaningfulByProspect = new Map<string, (typeof meaningfulNotes)[0]>();
    for (const n of meaningfulNotes) {
      const key = n.prospectId?.toString();
      if (key && !lastMeaningfulByProspect.has(key)) {
        lastMeaningfulByProspect.set(key, n);
      }
    }

    const items = page.map((row) => {
      const prospect = prospectById.get(row.prospectId.toString());
      const lastMeaningful = lastMeaningfulByProspect.get(row.prospectId.toString());
      return {
        prospectId: row.prospectId.toString(),
        businessName: prospect?.businessName ?? "Unknown business",
        contactName: prospect?.contactName ?? undefined,
        stage: row.stage,
        isStewarding: isPartnerStewarding(row.stage as PartnerRelationshipStage),
        introducedAt: toIso(row.introducedAt),
        stageUpdatedAt: toIso(row.stageUpdatedAt),
        lastMeaningfulConversation: lastMeaningful
          ? {
              summary: lastMeaningful.summary,
              at: toIso(lastMeaningful.createdAt),
            }
          : null,
      };
    });

    return res.json({ items, total, limit, skip });
  } catch (err) {
    console.error("[PartnerIntroductionsList] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/partner/introductions/:prospectId
 */
router.get("/:prospectId", async (req: Request, res: Response) => {
  try {
    const actor = getPartnerActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const prospectId = parseObjectId(req.params.prospectId);
    if (!prospectId) return res.status(404).json({ message: "Introduction not found" });

    const relationship = await findPartnerIntroduction(actor.partnerId, prospectId);
    if (!relationship) return res.status(404).json({ message: "Introduction not found" });

    if (await partnerHasApprovedProtection(actor.partnerId, prospectId)) {
      return res.status(404).json({ message: "Introduction not found" });
    }

    const [prospect, notes] = await Promise.all([
      FoundingProspect.findById(prospectId).lean(),
      CommunicationNote.find({
        partnerId: actor.partnerId,
        prospectId,
        type: { $ne: "internalNote" },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    if (!prospect) return res.status(404).json({ message: "Introduction not found" });

    const lastMeaningful = findLastMeaningfulNote(notes as any);

    return res.json({
      business: serializeBusiness(prospect as any),
      relationship: serializeRelationship(relationship),
      lastMeaningfulConversation: lastMeaningful
        ? serializeNote(lastMeaningful as any)
        : null,
      notes: notes.map((n) => serializeNote(n as any)),
    });
  } catch (err) {
    console.error("[PartnerIntroductionDetail] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/partner/introductions/:prospectId/notes
 */
router.post("/:prospectId/notes", async (req: Request, res: Response) => {
  try {
    const actor = getPartnerActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const prospectId = parseObjectId(req.params.prospectId);
    if (!prospectId) return res.status(404).json({ message: "Introduction not found" });

    const relationship = await findPartnerIntroduction(actor.partnerId, prospectId);
    if (!relationship) return res.status(404).json({ message: "Introduction not found" });

    if (await partnerHasApprovedProtection(actor.partnerId, prospectId)) {
      return res.status(404).json({ message: "Introduction not found" });
    }

    const { type, summary, followUpDate, isMeaningful } = req.body as {
      type?: string;
      summary?: string;
      followUpDate?: string;
      isMeaningful?: boolean;
    };

    if (!type || !PARTNER_NOTE_TYPES.includes(type as PartnerNoteType)) {
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

    const meaningful = isMeaningful === true;
    const nextStage = advancePartnerRelationshipStage(relationship.stage, meaningful);

    const note = await CommunicationNote.create({
      partnerId: actor.partnerId,
      prospectId,
      type,
      summary: summaryTrim,
      isMeaningful: meaningful,
      followUpDate: followUp,
      createdBy: actor.userId,
    });

    if (nextStage !== relationship.stage) {
      relationship.stage = nextStage;
      relationship.stageUpdatedAt = new Date();
      await relationship.save();
    }

    return res.status(201).json({
      note: serializeNote(note),
      relationship: serializeRelationship(relationship),
    });
  } catch (err) {
    console.error("[PartnerIntroductionNoteCreate] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
