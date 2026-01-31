// backend/src/models/workOrderMessage.model.ts
import { Schema, model, Types } from "mongoose";
import type { UserRole } from "./user.model";

export type WorkOrderMessageChannel = "internal" | "customer";
export type WorkOrderMessageVisibility = "internal" | "customer";

export interface WorkOrderMessage {
  accountId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  channel: WorkOrderMessageChannel; // legacy, kept for backward compat
  visibility: WorkOrderMessageVisibility; // new field, preferred
  body: string;

  actor: {
    id: Types.ObjectId;
    nameSnapshot: string;
    roleSnapshot: UserRole;
  };

  meta?: {
    ip?: string;
    userAgent?: string;
  };

  createdAt: Date;
}

const WorkOrderMessageSchema = new Schema<WorkOrderMessage>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, required: true, index: true },

    channel: {
      type: String,
      enum: ["internal", "customer"],
      default: "internal",
      required: true,
    },

    visibility: {
      type: String,
      enum: ["internal", "customer"],
      default: "internal",
      required: true,
      index: true,
    },

    body: { type: String, required: true, trim: true },

    actor: {
      id: { type: Schema.Types.ObjectId, required: true },
      nameSnapshot: { type: String, required: true },
      roleSnapshot: {
        type: String,
        enum: ["owner", "manager", "technician", "superadmin"],
        required: true,
      },
    },

    meta: {
      ip: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // append-only vibe
);

// Pre-save hook: ensure visibility is set (defaults to internal if missing)
// This handles existing messages that may not have visibility field
WorkOrderMessageSchema.pre("save", function (next) {
  if (!this.visibility) {
    // Default to internal for existing messages or when channel is set
    this.visibility = this.channel || "internal";
  }
  next();
});

// Fast fetch per WO
WorkOrderMessageSchema.index({ accountId: 1, workOrderId: 1, createdAt: -1 });
// Index for technician filtering (internal only)
WorkOrderMessageSchema.index({ accountId: 1, workOrderId: 1, visibility: 1, createdAt: -1 });

export const WorkOrderMessageModel = model<WorkOrderMessage>(
  "WorkOrderMessage",
  WorkOrderMessageSchema
);
