// backend/src/models/workOrderMessage.model.ts
import { Schema, model, Types } from "mongoose";

export type WorkOrderMessageChannel = "internal" | "customer";

export interface WorkOrderMessage {
  accountId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  channel: WorkOrderMessageChannel;
  body: string;

  actor: {
    id: Types.ObjectId;
    nameSnapshot: string;
    roleSnapshot: "owner" | "manager" | "technician";
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

    body: { type: String, required: true, trim: true },

    actor: {
      id: { type: Schema.Types.ObjectId, required: true },
      nameSnapshot: { type: String, required: true },
      roleSnapshot: {
        type: String,
        enum: ["owner", "manager", "technician"],
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

// Fast fetch per WO
WorkOrderMessageSchema.index({ accountId: 1, workOrderId: 1, createdAt: -1 });

export const WorkOrderMessageModel = model<WorkOrderMessage>(
  "WorkOrderMessage",
  WorkOrderMessageSchema
);
