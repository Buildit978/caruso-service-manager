import type { CommunicationNoteType } from "../../models/communicationNote.model";
import {
  parseActivityDateInput,
  parseActivityTimeInput,
  type DateParseResult,
  type OptionalDateParseResult,
} from "./activityDates";

export type VisitType =
  | "walkIn"
  | "phone"
  | "email"
  | "textWhatsApp"
  | "demo"
  | "followUp"
  | "referral"
  | "other";

export type InterestLevel =
  | "cold"
  | "cool"
  | "warm"
  | "warmInterested"
  | "hot"
  | "busy"
  | "busyWarm"
  | "busyInterested"
  | "customer"
  | "unknown";

export const VISIT_TYPES: VisitType[] = [
  "walkIn",
  "phone",
  "email",
  "textWhatsApp",
  "demo",
  "followUp",
  "referral",
  "other",
];

export const INTEREST_LEVELS: InterestLevel[] = [
  "cold",
  "cool",
  "warm",
  "warmInterested",
  "hot",
  "busy",
  "busyWarm",
  "busyInterested",
  "customer",
  "unknown",
];

const MAX_PRIMARY_CONTACT_LENGTH = 200;
const MAX_DURATION_LENGTH = 32;
const MAX_FIELD_INTELLIGENCE_OBSERVATION_LENGTH = 2000;

export interface FieldIntelligenceInput {
  observation?: string;
}

export interface InteractionWriteInput {
  activityDate?: string;
  activityTime?: string;
  primaryContact?: string;
  visitType?: string;
  duration?: string;
  interestLevel?: string;
  summary?: string;
  /** Legacy note type (admin internal notes, backward compatibility). */
  type?: string;
}

export interface ParsedInteractionFields {
  activityDate: Date;
  activityTime: string;
  primaryContact?: string;
  visitType: VisitType;
  legacyType: CommunicationNoteType;
  duration?: string;
  interestLevel?: InterestLevel;
  summary: string;
}

function toIso(date: Date | undefined | null): string | undefined {
  if (date == null) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function visitTypeToLegacyType(visitType: VisitType): CommunicationNoteType {
  switch (visitType) {
    case "walkIn":
      return "walkIn";
    case "phone":
      return "call";
    case "email":
    case "textWhatsApp":
      return "email";
    case "demo":
      return "demo";
    case "followUp":
      return "followUp";
    case "referral":
    case "other":
      return "meeting";
    default:
      return "walkIn";
  }
}

export function legacyTypeToVisitType(type: string | undefined): VisitType | undefined {
  switch (type) {
    case "walkIn":
      return "walkIn";
    case "call":
      return "phone";
    case "email":
      return "email";
    case "demo":
      return "demo";
    case "followUp":
      return "followUp";
    case "meeting":
      return "other";
    default:
      return undefined;
  }
}

export function resolveVisitType(input: InteractionWriteInput, allowInternal = false): VisitType | "internalNote" {
  if (allowInternal && input.type === "internalNote") return "internalNote";
  if (input.visitType && VISIT_TYPES.includes(input.visitType as VisitType)) {
    return input.visitType as VisitType;
  }
  const fromLegacy = legacyTypeToVisitType(input.type);
  if (fromLegacy) return fromLegacy;
  return "walkIn";
}

export function parseInterestLevel(value: string | undefined | null): InterestLevel | undefined {
  if (value == null || String(value).trim() === "") return undefined;
  const trimmed = String(value).trim() as InterestLevel;
  return INTEREST_LEVELS.includes(trimmed) ? trimmed : undefined;
}

export function parseOptionalTrimmed(
  value: string | undefined | null,
  maxLength: number,
  fieldLabel: string
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value == null || String(value).trim() === "") {
    return { ok: true, value: undefined };
  }
  const trimmed = String(value).trim();
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${fieldLabel} is too long` };
  }
  return { ok: true, value: trimmed };
}

export function parseInteractionFields(
  input: InteractionWriteInput,
  options?: { allowInternal?: boolean; summaryRequired?: boolean }
): { ok: true; fields: ParsedInteractionFields } | { ok: false; error: string } {
  const allowInternal = options?.allowInternal === true;
  const summaryRequired = options?.summaryRequired !== false;

  const resolvedVisit = resolveVisitType(input, allowInternal);
  if (resolvedVisit === "internalNote") {
    const dateParsed = parseActivityDateInput(input.activityDate);
    if (!dateParsed.ok) return dateParsed;
    const timeParsed = parseActivityTimeInput(input.activityTime);
    if (!timeParsed.ok) return timeParsed;

    const summaryTrim = input.summary ? String(input.summary).trim() : "";
    if (summaryRequired && !summaryTrim) return { ok: false, error: "summary is required" };

    return {
      ok: true,
      fields: {
        activityDate: dateParsed.date,
        activityTime: timeParsed.time,
        visitType: "other",
        legacyType: "internalNote",
        summary: summaryTrim,
      },
    };
  }

  const dateParsed = parseActivityDateInput(input.activityDate);
  if (!dateParsed.ok) return dateParsed;

  const timeParsed = parseActivityTimeInput(input.activityTime);
  if (!timeParsed.ok) return timeParsed;

  const primaryParsed = parseOptionalTrimmed(input.primaryContact, MAX_PRIMARY_CONTACT_LENGTH, "primaryContact");
  if (!primaryParsed.ok) return primaryParsed;

  const durationParsed = parseOptionalTrimmed(input.duration, MAX_DURATION_LENGTH, "duration");
  if (!durationParsed.ok) return durationParsed;

  const summaryTrim = input.summary ? String(input.summary).trim() : "";
  if (summaryRequired && !summaryTrim) return { ok: false, error: "summary is required" };

  const visitType = resolvedVisit as VisitType;
  const interestLevel = parseInterestLevel(input.interestLevel);

  return {
    ok: true,
    fields: {
      activityDate: dateParsed.date,
      activityTime: timeParsed.time,
      primaryContact: primaryParsed.value,
      visitType,
      legacyType: visitTypeToLegacyType(visitType),
      duration: durationParsed.value,
      interestLevel,
      summary: summaryTrim,
    },
  };
}

export function parseFieldIntelligenceInput(
  value: FieldIntelligenceInput | null | undefined
): { ok: true; fieldIntelligence: { observation: string } | undefined } | { ok: false; error: string } {
  if (value == null) return { ok: true, fieldIntelligence: undefined };

  const observationRaw = value.observation;
  if (observationRaw == null || String(observationRaw).trim() === "") {
    return { ok: true, fieldIntelligence: undefined };
  }

  const trimmed = String(observationRaw).trim();
  if (trimmed.length > MAX_FIELD_INTELLIGENCE_OBSERVATION_LENGTH) {
    return { ok: false, error: "Observation is too long" };
  }

  return { ok: true, fieldIntelligence: { observation: trimmed } };
}

export function parseAmendmentText(
  text: unknown
): { ok: true; text: string } | { ok: false; error: string } {
  const trim = text != null ? String(text).trim() : "";
  if (!trim) return { ok: false, error: "text is required" };
  if (trim.length > 2000) return { ok: false, error: "text must be 2000 characters or fewer" };
  return { ok: true, text: trim };
}

export function serializeInteractionNote(note: {
  _id: { toString(): string };
  partnerId?: { toString(): string };
  prospectId?: { toString(): string };
  relationshipProtectionId?: { toString(): string };
  type: string;
  summary: string;
  isMeaningful?: boolean;
  activityDate?: Date;
  activityTime?: string;
  primaryContact?: string;
  visitType?: string;
  duration?: string;
  interestLevel?: string;
  followUpDate?: Date;
  amendments?: Array<{
    text: string;
    createdAt?: Date;
    createdBy?: { toString(): string };
  }>;
  fieldIntelligence?: { observation?: string };
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: { toString(): string };
}) {
  const visitType = note.visitType ?? legacyTypeToVisitType(note.type);
  return {
    id: note._id.toString(),
    partnerId: note.partnerId?.toString(),
    prospectId: note.prospectId?.toString(),
    relationshipProtectionId: note.relationshipProtectionId?.toString(),
    type: note.type,
    summary: note.summary,
    isMeaningful: note.isMeaningful === true,
    activityDate: toIso(note.activityDate),
    activityTime: note.activityTime ?? undefined,
    primaryContact: note.primaryContact ?? undefined,
    visitType,
    duration: note.duration ?? undefined,
    interestLevel: note.interestLevel ?? undefined,
    followUpDate: toIso(note.followUpDate),
    amendments: (note.amendments ?? []).map((amendment) => ({
      text: amendment.text,
      createdAt: toIso(amendment.createdAt),
      createdBy: amendment.createdBy?.toString(),
    })),
    fieldIntelligence:
      note.fieldIntelligence?.observation?.trim()
        ? { observation: note.fieldIntelligence.observation.trim() }
        : undefined,
    createdBy: note.createdBy?.toString(),
    createdAt: toIso(note.createdAt),
    updatedAt: toIso(note.updatedAt),
  };
}

export function buildInteractionCreatePayload(
  fields: ParsedInteractionFields,
  extras: {
    partnerId?: unknown;
    prospectId?: unknown;
    relationshipProtectionId?: unknown;
    isMeaningful?: boolean;
    followUpDate?: Date;
    fieldIntelligence?: { observation: string };
    createdBy: unknown;
  }
) {
  return {
    partnerId: extras.partnerId,
    prospectId: extras.prospectId,
    relationshipProtectionId: extras.relationshipProtectionId,
    type: fields.legacyType,
    summary: fields.summary,
    activityDate: fields.activityDate,
    activityTime: fields.activityTime,
    primaryContact: fields.primaryContact,
    visitType: fields.legacyType === "internalNote" ? undefined : fields.visitType,
    duration: fields.duration,
    interestLevel: fields.interestLevel,
    isMeaningful: extras.isMeaningful,
    followUpDate: extras.followUpDate,
    fieldIntelligence: extras.fieldIntelligence,
    createdBy: extras.createdBy,
  };
}

export function parseInteractionPatchInput(
  input: InteractionWriteInput & { followUpDate?: string | null }
):
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; error: string } {
  const patch: Record<string, unknown> = {};

  if (input.summary !== undefined) {
    const summaryTrim = String(input.summary).trim();
    if (!summaryTrim) return { ok: false, error: "summary is required" };
    patch.summary = summaryTrim;
  }

  if (input.activityDate !== undefined || input.activityTime !== undefined) {
    const dateParsed = parseActivityDateInput(input.activityDate);
    if (!dateParsed.ok) return dateParsed;
    patch.activityDate = dateParsed.date;

    const timeParsed = parseActivityTimeInput(input.activityTime);
    if (!timeParsed.ok) return timeParsed;
    patch.activityTime = timeParsed.time;
  }

  if (input.primaryContact !== undefined) {
    const primaryParsed = parseOptionalTrimmed(input.primaryContact, MAX_PRIMARY_CONTACT_LENGTH, "primaryContact");
    if (!primaryParsed.ok) return primaryParsed;
    patch.primaryContact = primaryParsed.value;
  }

  if (input.duration !== undefined) {
    const durationParsed = parseOptionalTrimmed(input.duration, MAX_DURATION_LENGTH, "duration");
    if (!durationParsed.ok) return durationParsed;
    patch.duration = durationParsed.value;
  }

  if (input.interestLevel !== undefined) {
    if (input.interestLevel === null || String(input.interestLevel).trim() === "") {
      patch.interestLevel = undefined;
    } else {
      const level = parseInterestLevel(input.interestLevel);
      if (!level) return { ok: false, error: "Invalid interestLevel" };
      patch.interestLevel = level;
    }
  }

  if (input.visitType !== undefined || input.type !== undefined) {
    const resolved = resolveVisitType(input, true);
    if (resolved === "internalNote") {
      patch.type = "internalNote";
      patch.visitType = undefined;
    } else {
      patch.visitType = resolved;
      patch.type = visitTypeToLegacyType(resolved);
    }
  }

  if (input.followUpDate !== undefined) {
    if (input.followUpDate === null || input.followUpDate === "") {
      patch.followUpDate = undefined;
    } else {
      const parsed: DateParseResult = { ok: false, error: "Invalid followUpDate" };
      const d = new Date(input.followUpDate);
      if (!Number.isNaN(d.getTime())) {
        patch.followUpDate = d;
      } else {
        return parsed;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No updatable fields provided" };
  }

  return { ok: true, patch };
}
