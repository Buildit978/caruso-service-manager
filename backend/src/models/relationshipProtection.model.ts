import { Schema, model, type Document, Types } from "mongoose";

export type ProtectionStatus = "pending" | "approved" | "declined" | "expired" | "released";

export type RelationshipLifecycleStatus = "new" | "protected" | "connected" | "engaged";

export interface IRelationshipProtection extends Document {
  partnerId: Types.ObjectId;
  prospectId: Types.ObjectId;
  introducedAt: Date;
  protectionStatus: ProtectionStatus;
  lifecycleStatus: RelationshipLifecycleStatus;
  lifecycleStatusUpdatedAt?: Date;
  lifecycleStatusUpdatedBy?: Types.ObjectId;
  protectionExpiresAt?: Date | null;
  evidenceSummary: string;
  approvalNotes?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const relationshipProtectionSchema = new Schema<IRelationshipProtection>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "FoundingPartner", required: true, index: true },
    prospectId: { type: Schema.Types.ObjectId, ref: "FoundingProspect", required: true, index: true },
    introducedAt: { type: Date, required: true, default: () => new Date() },
    protectionStatus: {
      type: String,
      enum: ["pending", "approved", "declined", "expired", "released"],
      default: "pending",
      required: true,
    },
    lifecycleStatus: {
      type: String,
      enum: ["new", "protected", "connected", "engaged"],
      default: "new",
      required: true,
    },
    lifecycleStatusUpdatedAt: { type: Date },
    lifecycleStatusUpdatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    protectionExpiresAt: { type: Date, default: null },
    evidenceSummary: { type: String, required: true, trim: true },
    approvalNotes: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

relationshipProtectionSchema.index({ protectionStatus: 1, protectionExpiresAt: 1 });
relationshipProtectionSchema.index({ prospectId: 1, protectionStatus: 1 });
relationshipProtectionSchema.index({ lifecycleStatus: 1, protectionStatus: 1 });

// Only one pending or approved protection per partner+prospect pair.
relationshipProtectionSchema.index(
  { partnerId: 1, prospectId: 1 },
  {
    unique: true,
    partialFilterExpression: { protectionStatus: { $in: ["pending", "approved"] } },
  }
);

export const RelationshipProtection = model<IRelationshipProtection>(
  "RelationshipProtection",
  relationshipProtectionSchema
);
