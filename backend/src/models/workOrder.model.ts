// src/models/workOrder.model.ts
import { Schema, model, Document, Types } from "mongoose";


/* =========================================================
   Types
========================================================= */

export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "invoiced"
  | "cancelled";

export type LineItemType = "labour" | "part" | "service";

/* =========================================================
   Interfaces
========================================================= */

export interface ILineItem {
  type: LineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IWorkOrderVehicle {
  vehicleId?: Types.ObjectId; // subdoc _id from customer.vehicles
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  licensePlate?: string;
  color?: string;
  notes?: string;
}

export interface IWorkOrder extends Document {
  accountId?: Types.ObjectId;

  customerId: Types.ObjectId;
  invoiceId?: Types.ObjectId;

  date: Date;

    // Lifecycle timestamps
  openedAt?: Date;
  completedAt?: Date;
  invoicedAt?: Date;
  cancelledAt?: Date;
  closedAt?: Date;

  // Odometer lifecycle (new)
  odometerIn?: number;
  odometerOut?: number;
  serviceOdometer?: number; // mileage reference for the service record


  // NOTE: current model uses a single "odometer".
  // We'll evolve this later to odometerIn/odometerOut without breaking you now.
  odometer?: number;

  complaint: string;
  diagnosis?: string;
  notes?: string;

  status: WorkOrderStatus;

  vehicle?: IWorkOrderVehicle;

  lineItems: ILineItem[];
  taxRate: number;

  subtotal?: number;
  taxAmount?: number;
  total?: number;

  createdAt: Date;
  updatedAt: Date;
}

/* =========================================================
   Sub-schemas
========================================================= */

const workOrderVehicleSchema = new Schema<IWorkOrderVehicle>(
  {
    vehicleId: { type: Schema.Types.ObjectId },
    year: Number,
    make: String,
    model: String,
    vin: String,
    licensePlate: String,
    color: String,
    notes: String,
  },
  { _id: false }
);

const lineItemSchema = new Schema<ILineItem>(
  {
    type: {
      type: String,
      enum: ["labour", "part", "service"],
      required: true,
    },
    description: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

/* =========================================================
   Main schema
========================================================= */

const workOrderSchema = new Schema<IWorkOrder>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      index: true,
      required: true,
    },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: false,
      index: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    date: { type: Date, default: Date.now },
    odometer: { type: Number },

        // Lifecycle timestamps
    openedAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date },
    onHoldAt: { type: Date },
    completedAt: { type: Date },
    invoicedAt: { type: Date },
    cancelledAt: { type: Date },
    closedAt: { type: Date },

    // Odometer lifecycle (new)
    odometerIn: { type: Number },
    odometerOut: { type: Number },
    serviceOdometer: { type: Number },


    complaint: { type: String, required: true },
    diagnosis: { type: String },
    notes: { type: String },

    status: {
      type: String,
      enum: ["open", "in_progress", "on_hold", "completed", "invoiced", "cancelled"], // ✅ add cancelled here too
      default: "open",
      lowercase: true,
      trim: true,
    },

    lineItems: { type: [lineItemSchema], default: [] },
    taxRate: { type: Number, default: 13 },

    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    vehicle: workOrderVehicleSchema,
  },
  { timestamps: true }
);

/* =========================================================
   Indexes
========================================================= */

// helpful index for date-based queries
workOrderSchema.index({ date: -1 });
workOrderSchema.index({ accountId: 1, status: 1, createdAt: -1 });
workOrderSchema.index({ accountId: 1, openedAt: -1 });


/* =========================================================
   Model export
========================================================= */

export const WorkOrder = model<IWorkOrder>("WorkOrder", workOrderSchema);
