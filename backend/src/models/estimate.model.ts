// backend/src/models/estimate.model.ts
import { Schema, model, Document, Types } from "mongoose";

/* =========================================================
   Types
========================================================= */

export type EstimateStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "approved"
  | "partially_approved"
  | "declined"
  | "expired";

export type EstimateLineItemType = "labour" | "part" | "service";

export type EstimateKind = "client" | "non_client";

/* =========================================================
   Interfaces
========================================================= */

export interface IEstimateLineItem {
  type?: EstimateLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** When status is partially_approved, only items with approved=true are converted */
  approved?: boolean;
}

export interface IEstimate extends Document {
  accountId: Types.ObjectId;

  estimateNumber: string;

  kind: EstimateKind;
  customerId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;

  nonClient?: {
    name?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    vehicle?: {
      year?: number;
      make?: string;
      model?: string;
    };
  };

  items: IEstimateLineItem[];

  status: EstimateStatus;

  convertedToWorkOrderId?: Types.ObjectId;

  internalNotes?: string;
  customerNotes?: string;

  /** Tax rate as percent (e.g. 13 for 13%). Set from Settings.taxRate on create. */
  taxRate?: number;

  sentAt?: Date;

  /** When the estimate email was successfully sent. */
  emailSentAt?: Date;

  /** Last attempt to send/resend email (for cooldown). */
  emailLastAttemptAt?: Date;

  /** Number of email send/resend attempts. */
  emailAttemptCount?: number;

  /** Last email send error message (cleared on success). */
  emailLastError?: string;

  /** Snapshot of estimate data at time of send (customer, vehicle, items, totals). */
  sentSnapshot?: {
    customer: { firstName: string; lastName: string; email?: string; phone?: string };
    vehicle?: { year?: number; make?: string; model?: string; licensePlate?: string; vin?: string };
    items: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    customerNotes?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   Sub-schemas
========================================================= */

const estimateLineItemSchema = new Schema<IEstimateLineItem>(
  {
    type: {
      type: String,
      enum: ["labour", "part", "service"],
      required: false,
    },
    description: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    approved: { type: Boolean, default: true },
  },
  { _id: false }
);

const sentSnapshotCustomerSchema = new Schema(
  {
    firstName: { type: String, required: true, default: "" },
    lastName: { type: String, required: false, default: "" },
    email: { type: String, required: false },
    phone: { type: String, required: false },
  },
  { _id: false }
);

const sentSnapshotVehicleSchema = new Schema(
  {
    year: { type: Number, required: false },
    make: { type: String, required: false },
    model: { type: String, required: false },
    licensePlate: { type: String, required: false },
    vin: { type: String, required: false },
  },
  { _id: false }
);

const sentSnapshotItemSchema = new Schema(
  {
    description: { type: String, required: true, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const nonClientVehicleSchema = new Schema(
  {
    year: { type: Number, required: false },
    make: { type: String, required: false, trim: true },
    model: { type: String, required: false, trim: true },
  },
  { _id: false }
);

const nonClientSchema = new Schema(
  {
    name: { type: String, required: false, trim: true },
    lastName: { type: String, required: false, trim: true },
    phone: { type: String, required: false, trim: true },
    email: { type: String, required: false, trim: true, lowercase: true },
    vehicle: { type: nonClientVehicleSchema, required: false },
  },
  { _id: false }
);

const sentSnapshotSchema = new Schema(
  {
    customer: { type: sentSnapshotCustomerSchema, required: true },
    vehicle: { type: sentSnapshotVehicleSchema, required: false },
    items: {
      type: [sentSnapshotItemSchema],
      required: true,
      default: [],
    },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    customerNotes: { type: String, required: false },
  },
  { _id: false }
);

/* =========================================================
   Main schema
========================================================= */

const estimateSchema = new Schema<IEstimate>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    estimateNumber: {
      type: String,
      required: true,
      trim: true,
    },

    kind: {
      type: String,
      enum: ["client", "non_client"],
      default: "client",
      lowercase: true,
      trim: true,
      required: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },

    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: false,
    },

    nonClient: {
      type: nonClientSchema,
      required: false,
    },

    items: {
      type: [estimateLineItemSchema],
      required: true,
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "approved", "partially_approved", "declined", "expired"],
      default: "draft",
      lowercase: true,
      trim: true,
    },

    convertedToWorkOrderId: {
      type: Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: false,
    },

    internalNotes: {
      type: String,
      required: false,
      trim: true,
    },

    customerNotes: {
      type: String,
      required: false,
      trim: true,
    },

    taxRate: {
      type: Number,
      required: false,
    },

    sentAt: {
      type: Date,
      required: false,
    },

    emailSentAt: {
      type: Date,
      required: false,
    },

    emailLastAttemptAt: {
      type: Date,
      required: false,
    },

    emailAttemptCount: {
      type: Number,
      required: false,
    },

    emailLastError: {
      type: String,
      required: false,
    },

    sentSnapshot: {
      type: sentSnapshotSchema,
      required: false,
    },
  },
  { timestamps: true }
);

/* =========================================================
   Indexes
========================================================= */

estimateSchema.index({ accountId: 1, updatedAt: -1 });
estimateSchema.index({ accountId: 1, customerId: 1 });
estimateSchema.index({ accountId: 1, vehicleId: 1 });

/* =========================================================
   Model export
========================================================= */

export const Estimate = model<IEstimate>("Estimate", estimateSchema);
