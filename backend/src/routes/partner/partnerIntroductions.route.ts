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
  getEffectiveActivityTimestamp,
  parseOptionalFollowUpDateInput,
  parseOptionalPastOrPresentDateInput,
  sortNotesByEffectiveActivityDesc,
} from "../../utils/foundingPartners/activityDates";
import { applyPartnerProspectRelationshipActivity } from "../../utils/foundingPartners/partnerRelationshipActivity";
import {
  buildInteractionCreatePayload,
  parseInteractionFields,
  parseAmendmentText,
  serializeInteractionNote,
} from "../../utils/foundingPartners/fieldInteractions";
import {
  applyPartnerProspectBusinessPatch,
  hasPartnerProspectBusinessPatchFields,
  type PartnerProspectBusinessPatchBody,
} from "../../utils/foundingPartners/partnerProspectBusinessUpdate";
import {
  advancePartnerRelationshipStage,
  isPartnerStewarding,
} from "../../utils/foundingPartners/partnerRelationshipStage";
import { buildPartnerInteractionSearchText } from "../../utils/foundingPartners/partnerInteractionSearchText";

const router = Router();

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
  notes?: string;
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
    notes: prospect.notes ?? undefined,
    status: prospect.status,
    createdAt: toIso(prospect.createdAt),
    updatedAt: toIso(prospect.updatedAt),
  };
}

function serializeNote(note: Parameters<typeof serializeInteractionNote>[0]) {
  return serializeInteractionNote(note);
}

function serializeRelationship(row: {
  stage: PartnerRelationshipStage;
  introducedAt: Date;
  stageUpdatedAt: Date;
  firstContactDate?: Date;
  lastVisitDate?: Date;
  nextFollowUpDate?: Date;
}) {
  return {
    stage: row.stage,
    introducedAt: toIso(row.introducedAt),
    stageUpdatedAt: toIso(row.stageUpdatedAt),
    firstContactDate: toIso(row.firstContactDate),
    lastVisitDate: toIso(row.lastVisitDate),
    nextFollowUpDate: toIso(row.nextFollowUpDate),
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
  notes: Array<{
    isMeaningful?: boolean;
    type: string;
    summary: string;
    activityDate?: Date;
    createdAt?: Date;
    _id: Types.ObjectId;
    followUpDate?: Date;
  }>
) {
  const sorted = sortNotesByEffectiveActivityDesc(notes);
  return sorted.find((n) => n.isMeaningful === true) ?? null;
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
      visitType,
      activityDate,
      activityTime,
      primaryContact,
      duration,
      interestLevel,
      nextFollowUpDate: nextFollowUpDateRaw,
    } = req.body as {
      businessName?: string;
      ownerName?: string;
      phone?: string;
      email?: string;
      address?: string;
      conversationNotes?: string;
      isMeaningful?: boolean;
      type?: string;
      visitType?: string;
      activityDate?: string;
      activityTime?: string;
      primaryContact?: string;
      duration?: string;
      interestLevel?: string;
      nextFollowUpDate?: string;
    };

    const businessNameTrim = businessName ? String(businessName).trim() : "";
    const ownerNameTrim = ownerName ? String(ownerName).trim() : "";
    const notesTrim = conversationNotes ? String(conversationNotes).trim() : "";

    if (!businessNameTrim) return res.status(400).json({ message: "businessName is required" });
    if (!notesTrim) return res.status(400).json({ message: "conversationNotes is required" });

    const meaningful = isMeaningful === true;

    const interactionParsed = parseInteractionFields(
      {
        summary: notesTrim,
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

    const nextFollowUpParsed = parseOptionalFollowUpDateInput(nextFollowUpDateRaw);
    if (!nextFollowUpParsed.ok) return res.status(400).json({ message: nextFollowUpParsed.error });

    const prospect = await FoundingProspect.create({
      businessName: businessNameTrim,
      contactName: ownerNameTrim || undefined,
      email: email ? normalizeEmail(email) : undefined,
      phone: phone ? String(phone).trim() : undefined,
      location: address ? String(address).trim() : undefined,
      status: "new",
    });

    const now = new Date();
    const initialStage = advancePartnerRelationshipStage("introduced", meaningful);
    const activityDateValue = interactionParsed.fields.activityDate;

    const relationship = await PartnerProspectRelationship.create({
      partnerId: actor.partnerId,
      prospectId: prospect._id,
      stage: initialStage,
      introducedAt: now,
      stageUpdatedAt: now,
      firstContactDate: activityDateValue,
      lastVisitDate: activityDateValue,
      nextFollowUpDate: nextFollowUpParsed.date,
    });

    const note = await CommunicationNote.create(
      buildInteractionCreatePayload(interactionParsed.fields, {
        partnerId: actor.partnerId,
        prospectId: prospect._id,
        isMeaningful: meaningful,
        createdBy: actor.userId,
      })
    );

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

    const partnerNotes = await CommunicationNote.find({
      partnerId: actor.partnerId,
      prospectId: { $in: pageProspectIds },
    }).lean();

    const notesByProspect = new Map<string, typeof partnerNotes>();
    for (const note of partnerNotes) {
      const key = note.prospectId?.toString();
      if (!key) continue;
      const bucket = notesByProspect.get(key);
      if (bucket) bucket.push(note);
      else notesByProspect.set(key, [note]);
    }

    const lastMeaningfulByProspect = new Map<string, (typeof partnerNotes)[0]>();
    for (const n of sortNotesByEffectiveActivityDesc(partnerNotes)) {
      if (n.isMeaningful !== true) continue;
      const key = n.prospectId?.toString();
      if (key && !lastMeaningfulByProspect.has(key)) {
        lastMeaningfulByProspect.set(key, n);
      }
    }

    const items = page.map((row) => {
      const prospect = prospectById.get(row.prospectId.toString());
      const prospectKey = row.prospectId.toString();
      const prospectNotes = notesByProspect.get(prospectKey) ?? [];
      const lastMeaningful = lastMeaningfulByProspect.get(prospectKey);
      const lastActivityAt = row.lastVisitDate ?? lastMeaningful?.activityDate ?? lastMeaningful?.createdAt;
      const interactionSearchText = buildPartnerInteractionSearchText(prospectNotes);
      return {
        prospectId: prospectKey,
        businessName: prospect?.businessName ?? "Unknown business",
        contactName: prospect?.contactName ?? undefined,
        phone: prospect?.phone ?? undefined,
        email: prospect?.email ?? undefined,
        location: prospect?.location ?? undefined,
        website: prospect?.website ?? undefined,
        notes: prospect?.notes ?? undefined,
        interactionSearchText: interactionSearchText || undefined,
        stage: row.stage,
        isStewarding: isPartnerStewarding(row.stage as PartnerRelationshipStage),
        introducedAt: toIso(row.introducedAt),
        stageUpdatedAt: toIso(row.stageUpdatedAt),
        firstContactDate: toIso(row.firstContactDate),
        lastVisitDate: toIso(row.lastVisitDate),
        nextFollowUpDate: toIso(row.nextFollowUpDate),
        lastActivityAt: toIso(lastActivityAt),
        lastMeaningfulConversation: lastMeaningful
          ? {
              summary: lastMeaningful.summary,
              at: toIso(
                getEffectiveActivityTimestamp(lastMeaningful as any) != null
                  ? new Date(getEffectiveActivityTimestamp(lastMeaningful as any)!)
                  : lastMeaningful.createdAt
              ),
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
        .limit(50)
        .lean(),
    ]);

    if (!prospect) return res.status(404).json({ message: "Introduction not found" });

    const sortedNotes = sortNotesByEffectiveActivityDesc(notes as any);
    const lastMeaningful = findLastMeaningfulNote(sortedNotes as any);

    return res.json({
      business: serializeBusiness(prospect as any),
      relationship: serializeRelationship(relationship),
      lastMeaningfulConversation: lastMeaningful
        ? serializeNote(lastMeaningful as any)
        : null,
      notes: sortedNotes.map((n) => serializeNote(n as any)),
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

    const {
      type,
      visitType,
      summary,
      followUpDate,
      isMeaningful,
      activityDate,
      activityTime,
      primaryContact,
      duration,
      interestLevel,
      nextFollowUpDate: nextFollowUpDateRaw,
    } = req.body as {
      type?: string;
      visitType?: string;
      summary?: string;
      followUpDate?: string;
      isMeaningful?: boolean;
      activityDate?: string;
      activityTime?: string;
      primaryContact?: string;
      duration?: string;
      interestLevel?: string;
      nextFollowUpDate?: string;
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

    const nextFollowUpParsed = parseOptionalFollowUpDateInput(nextFollowUpDateRaw);
    if (!nextFollowUpParsed.ok) return res.status(400).json({ message: nextFollowUpParsed.error });

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
    const activityDateValue = interactionParsed.fields.activityDate;

    const note = await CommunicationNote.create(
      buildInteractionCreatePayload(interactionParsed.fields, {
        partnerId: actor.partnerId,
        prospectId,
        isMeaningful: meaningful,
        followUpDate: followUp,
        createdBy: actor.userId,
      })
    );

    if (nextStage !== relationship.stage) {
      relationship.stage = nextStage;
      relationship.stageUpdatedAt = new Date();
    }

    await applyPartnerProspectRelationshipActivity(
      relationship,
      activityDateValue,
      nextFollowUpDateRaw !== undefined ? { nextFollowUpDate: nextFollowUpParsed.date ?? null } : undefined
    );

    return res.status(201).json({
      note: serializeNote(note),
      relationship: serializeRelationship(relationship),
    });
  } catch (err) {
    console.error("[PartnerIntroductionNoteCreate] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/partner/introductions/:prospectId/notes/:noteId/amendments
 * Append a clarification without changing the original interaction record.
 */
router.post("/:prospectId/notes/:noteId/amendments", async (req: Request, res: Response) => {
  try {
    const actor = getPartnerActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });

    const prospectId = parseObjectId(req.params.prospectId);
    const noteId = parseObjectId(req.params.noteId);
    if (!prospectId || !noteId) return res.status(404).json({ message: "Interaction not found" });

    const relationship = await findPartnerIntroduction(actor.partnerId, prospectId);
    if (!relationship) return res.status(404).json({ message: "Interaction not found" });

    if (await partnerHasApprovedProtection(actor.partnerId, prospectId)) {
      return res.status(404).json({ message: "Interaction not found" });
    }

    const note = await CommunicationNote.findOne({
      _id: noteId,
      partnerId: actor.partnerId,
      prospectId,
    });
    if (!note) return res.status(404).json({ message: "Interaction not found" });

    const parsed = parseAmendmentText((req.body as { text?: string })?.text);
    if (!parsed.ok) return res.status(400).json({ message: parsed.error });

    if (!note.amendments) note.amendments = [];
    note.amendments.push({
      text: parsed.text,
      createdBy: actor.userId,
      createdAt: new Date(),
    });
    await note.save();

    return res.status(201).json({ note: serializeNote(note) });
  } catch (err) {
    console.error("[PartnerIntroductionAmendmentCreate] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/partner/introductions/:prospectId/business
 * Update business details on an active introduction (current truth — no new record).
 */
router.patch("/:prospectId/business", async (req: Request, res: Response) => {
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

    const body = req.body as PartnerProspectBusinessPatchBody;
    if (!hasPartnerProspectBusinessPatchFields(body)) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    const prospect = await FoundingProspect.findById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Introduction not found" });

    const applied = applyPartnerProspectBusinessPatch(prospect, body);
    if (!applied.ok) return res.status(400).json({ message: applied.error });

    await prospect.save();

    return res.json({ business: serializeBusiness(prospect as any) });
  } catch (err) {
    console.error("[PartnerIntroductionBusinessPatch] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/partner/introductions/:prospectId
 * Update real-world relationship dates (not system timestamps).
 */
router.patch("/:prospectId", async (req: Request, res: Response) => {
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

    const { firstContactDate, lastVisitDate, nextFollowUpDate } = req.body as {
      firstContactDate?: string | null;
      lastVisitDate?: string | null;
      nextFollowUpDate?: string | null;
    };

    if (
      firstContactDate === undefined &&
      lastVisitDate === undefined &&
      nextFollowUpDate === undefined
    ) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    if (firstContactDate !== undefined) {
      if (firstContactDate === null || firstContactDate === "") {
        relationship.firstContactDate = undefined;
      } else {
        const parsed = parseOptionalPastOrPresentDateInput(firstContactDate, "firstContactDate");
        if (!parsed.ok) return res.status(400).json({ message: parsed.error });
        relationship.firstContactDate = parsed.date;
      }
    }

    if (lastVisitDate !== undefined) {
      if (lastVisitDate === null || lastVisitDate === "") {
        relationship.lastVisitDate = undefined;
      } else {
        const parsed = parseOptionalPastOrPresentDateInput(lastVisitDate, "lastVisitDate");
        if (!parsed.ok) return res.status(400).json({ message: parsed.error });
        relationship.lastVisitDate = parsed.date;
      }
    }

    if (nextFollowUpDate !== undefined) {
      if (nextFollowUpDate === null || nextFollowUpDate === "") {
        relationship.nextFollowUpDate = undefined;
      } else {
        const parsed = parseOptionalFollowUpDateInput(nextFollowUpDate);
        if (!parsed.ok) return res.status(400).json({ message: parsed.error });
        relationship.nextFollowUpDate = parsed.date;
      }
    }

    await relationship.save();

    return res.json({ relationship: serializeRelationship(relationship) });
  } catch (err) {
    console.error("[PartnerIntroductionPatch] error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
