import { Schema, model, type Document } from "mongoose";
import { Types } from "mongoose";

export interface IAdminAudit extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetAccountId: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  note?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminAuditSchema = new Schema<IAdminAudit>(
  {
    adminId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, index: true },
    targetAccountId: { type: Schema.Types.ObjectId, required: true, index: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    note: String,
    ip: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

adminAuditSchema.index({ targetAccountId: 1, createdAt: -1 });
adminAuditSchema.index({ adminId: 1, createdAt: -1 });

export const AdminAudit = model<IAdminAudit>("AdminAudit", adminAuditSchema);
