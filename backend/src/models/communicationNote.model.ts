import { Schema, model, type Document, Types } from "mongoose";

export type CommunicationNoteType =
  | "call"
  | "email"
  | "walkIn"
  | "meeting"
  | "demo"
  | "followUp"
  | "internalNote";

export interface ICommunicationNote extends Document {
  partnerId?: Types.ObjectId;
  prospectId?: Types.ObjectId;
  relationshipProtectionId?: Types.ObjectId;
  type: CommunicationNoteType;
  summary: string;
  followUpDate?: Date;
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
    followUpDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

communicationNoteSchema.index({ partnerId: 1, createdAt: -1 });
communicationNoteSchema.index({ prospectId: 1, createdAt: -1 });
communicationNoteSchema.index({ relationshipProtectionId: 1, createdAt: -1 });

export const CommunicationNote = model<ICommunicationNote>("CommunicationNote", communicationNoteSchema);
