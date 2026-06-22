import { Schema, model, type Document, Types } from "mongoose";

export type FoundingPartnerEntityType =
  | "partner"
  | "prospect"
  | "relationshipProtection"
  | "communicationNote";

export interface IFoundingPartnerAuditLog extends Document {
  actorId: Types.ObjectId;
  action: string;
  entityType: FoundingPartnerEntityType;
  entityId: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  createdAt: Date;
}

const foundingPartnerAuditLogSchema = new Schema<IFoundingPartnerAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, index: true },
    entityType: {
      type: String,
      enum: ["partner", "prospect", "relationshipProtection", "communicationNote"],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

foundingPartnerAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
foundingPartnerAuditLogSchema.index({ actorId: 1, createdAt: -1 });

export const FoundingPartnerAuditLog = model<IFoundingPartnerAuditLog>(
  "FoundingPartnerAuditLog",
  foundingPartnerAuditLogSchema
);
