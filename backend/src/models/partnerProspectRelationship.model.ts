import { Schema, model, type Document, Types } from "mongoose";

export type PartnerRelationshipStage = "introduced" | "conversation" | "meaningfulConversation";

export interface IPartnerProspectRelationship extends Document {
  partnerId: Types.ObjectId;
  prospectId: Types.ObjectId;
  stage: PartnerRelationshipStage;
  introducedAt: Date;
  stageUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const partnerProspectRelationshipSchema = new Schema<IPartnerProspectRelationship>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "FoundingPartner", required: true, index: true },
    prospectId: { type: Schema.Types.ObjectId, ref: "FoundingProspect", required: true, index: true },
    stage: {
      type: String,
      enum: ["introduced", "conversation", "meaningfulConversation"],
      default: "introduced",
      required: true,
    },
    introducedAt: { type: Date, required: true, default: () => new Date() },
    stageUpdatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

partnerProspectRelationshipSchema.index({ partnerId: 1, prospectId: 1 }, { unique: true });
partnerProspectRelationshipSchema.index({ partnerId: 1, stageUpdatedAt: -1 });

export const PartnerProspectRelationship = model<IPartnerProspectRelationship>(
  "PartnerProspectRelationship",
  partnerProspectRelationshipSchema
);
