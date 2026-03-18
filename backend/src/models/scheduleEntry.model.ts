// backend/src/models/scheduleEntry.model.ts
import { Schema, model, Document, Types } from "mongoose";

/* =========================================================
   Types
========================================================= */

export type ScheduleEntryStatus = "scheduled" | "cancelled";

/* =========================================================
   Interfaces
========================================================= */

export interface IScheduleEntry extends Document {
  accountId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  scheduledDate: Date; // YYYY-MM-DD (stored as Date at midnight UTC)
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  technicianId?: Types.ObjectId | null;
  status: ScheduleEntryStatus;
  notes?: string;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   Schema
========================================================= */

const scheduleEntrySchema = new Schema<IScheduleEntry>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      index: true,
      required: true,
    },
    workOrderId: {
      type: Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true,
      index: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
    },
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "cancelled"],
      default: "scheduled",
      lowercase: true,
      trim: true,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

/* =========================================================
   Indexes
========================================================= */

scheduleEntrySchema.index({ accountId: 1, scheduledDate: 1, technicianId: 1 });
scheduleEntrySchema.index({ accountId: 1, startAt: 1, endAt: 1 });
// V1: one active schedule per work order
scheduleEntrySchema.index(
  { workOrderId: 1, status: 1 },
  { partialFilterExpression: { status: "scheduled" } }
);

/* =========================================================
   Model export
========================================================= */

export const ScheduleEntry = model<IScheduleEntry>(
  "ScheduleEntry",
  scheduleEntrySchema
);
