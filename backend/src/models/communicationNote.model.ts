import { Schema, model, type Document, Types } from "mongoose";

export type CommunicationNoteType =
  | "call"
  | "email"
  | "walkIn"
  | "meeting"
  | "demo"
  | "followUp"
  | "internalNote";

export type VisitType =
  | "walkIn"
  | "phone"
  | "email"
  | "textWhatsApp"
  | "demo"
  | "followUp"
  | "referral"
  | "other";

export type InterestLevel = "cold" | "cool" | "warm" | "hot" | "unknown";

export interface IInteractionAmendment {
  text: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

export interface ICommunicationNote extends Document {
  partnerId?: Types.ObjectId;
  prospectId?: Types.ObjectId;
  relationshipProtectionId?: Types.ObjectId;
  type: CommunicationNoteType;
  summary: string;
  /** Partner attests this note captures a meaningful conversation (evidence-based). */
  isMeaningful?: boolean;
  /** When the visit/conversation/observation actually happened (real-world date). */
  activityDate?: Date;
  /** Local time of the interaction (HH:mm). */
  activityTime?: string;
  /** Person spoken with during this interaction only. */
  primaryContact?: string;
  visitType?: VisitType;
  duration?: string;
  interestLevel?: InterestLevel;
  followUpDate?: Date;
  /** Later clarifications — original interaction summary is not rewritten. */
  amendments?: IInteractionAmendment[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const communicationNoteSchema = new Schema<ICommunicationNote>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "FoundingPartner", index: true },
    prospectId: { type: Schema.Types.ObjectId, ref: "FoundingProspect", index: true },
    relationshipProtectionId: {
      type: Schema.Types.ObjectId,
      ref: "RelationshipProtection",
      index: true,
    },
    type: {
      type: String,
      enum: ["call", "email", "walkIn", "meeting", "demo", "followUp", "internalNote"],
      required: true,
    },
    summary: { type: String, required: true, trim: true },
    isMeaningful: { type: Boolean, default: false, required: false },
    activityDate: { type: Date, index: true },
    activityTime: { type: String, trim: true },
    primaryContact: { type: String, trim: true, maxlength: 200 },
    visitType: {
      type: String,
      enum: ["walkIn", "phone", "email", "textWhatsApp", "demo", "followUp", "referral", "other"],
    },
    duration: { type: String, trim: true, maxlength: 32 },
    interestLevel: {
      type: String,
      enum: ["cold", "cool", "warm", "hot", "unknown"],
    },
    followUpDate: { type: Date },
    amendments: [
      {
        text: { type: String, required: true, trim: true, maxlength: 2000 },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        createdAt: { type: Date, default: Date.now, required: true },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

communicationNoteSchema.index({ partnerId: 1, createdAt: -1 });
communicationNoteSchema.index({ prospectId: 1, createdAt: -1 });
communicationNoteSchema.index({ relationshipProtectionId: 1, createdAt: -1 });

export const CommunicationNote = model<ICommunicationNote>("CommunicationNote", communicationNoteSchema);
