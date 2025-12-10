// backend/src/models/invoice.model.ts
import { Schema, model, type Document, type Types } from "mongoose";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface IInvoiceLineItem {
  type?: "labour" | "part" | "service";
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IInvoiceCustomerSnapshot {
  customerId: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface IInvoiceVehicleSnapshot {
  vehicleId?: string;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  licensePlate?: string;
  color?: string;
  notes?: string;
}

export interface IInvoice extends Document {
 
  accountId: Types.ObjectId; 
 
  invoiceNumber: string;
  status: InvoiceStatus;

  workOrderId: Types.ObjectId;
  customerId: Types.ObjectId; // for quick querying
  customerSnapshot: IInvoiceCustomerSnapshot;
  vehicleSnapshot?: IInvoiceVehicleSnapshot;

  issueDate: Date;
  dueDate?: Date;

  lineItems: IInvoiceLineItem[];

  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    type: {
      type: String,
      enum: ["labour", "part", "service"],
      required: false,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const InvoiceCustomerSnapshotSchema = new Schema<IInvoiceCustomerSnapshot>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    firstName: String,
    lastName: String,
    phone: String,
    email: String,
    address: String,
  },
  { _id: false }
);

const InvoiceVehicleSnapshotSchema = new Schema<IInvoiceVehicleSnapshot>(
  {
    vehicleId: String,
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

const InvoiceSchema = new Schema<IInvoice>(
  {
    // 👇 NEW: accountId for multi-tenant scoping
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      // unique: true,  // ❌ remove this — we'll do a compound index instead
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "void"],
      default: "draft",
    },

    workOrderId: {
      type: Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    customerSnapshot: {
      type: InvoiceCustomerSnapshotSchema,
      required: true,
    },
    vehicleSnapshot: {
      type: InvoiceVehicleSnapshotSchema,
      required: false,
    },

    issueDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: false,
    },

    lineItems: {
      type: [InvoiceLineItemSchema],
      required: true,
      default: [],
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    notes: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique per-account invoice numbers
InvoiceSchema.index(
  { accountId: 1, invoiceNumber: 1 },
  { unique: true }
);

// 🚨 Unique invoice per work order
InvoiceSchema.index(
  { accountId: 1, workOrderId: 1 },
  { unique: true }
);

// Optional, helpful for list pages
InvoiceSchema.index({ accountId: 1, createdAt: -1 });


export const Invoice = model<IInvoice>("Invoice", InvoiceSchema);

