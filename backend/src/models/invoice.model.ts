// backend/src/models/invoice.model.ts
import { model, type Document, type Types } from "mongoose";
import mongoose, { Schema } from "mongoose";



export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type FinancialStatus = "paid" | "partial" | "due" | "void"; // ✅ NEW
export type PaymentMethod = "cash" | "card" | "e-transfer" | "cheque";
export type InvoiceEmailStatus = "never_sent" | "sending" | "sent" | "failed";

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

export interface IInvoiceProfileSnapshot {
  shopName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export type InvoiceEmailMeta = {
  status: InvoiceEmailStatus;
  lastTo?: string;
  lastSentAt?: Date;
  lastMessageId?: string;
  lastError?: string;
  attempts?: number;
};

export interface IInvoice extends Document {
  accountId: Types.ObjectId;

  invoiceNumber: string;
  status: InvoiceStatus;

  // ✅ NEW: canonical financial truth
  financialStatus: FinancialStatus;

  // ✅ lifecycle stamps (used for snapshot locking + finance status)
  sentAt?: Date;
  paidAt?: Date;
  voidedAt?: Date;
  voidReason?: string;

  payments: Array<{
    method: PaymentMethod;
    reference?: string;
    amount: number;
    paidAt: Date; // ✅ match schema truth
  }>;

  paidAmount: number; // total paid so far
  balanceDue: number; // total - paidAmount

  workOrderId: Types.ObjectId;
  customerId: Types.ObjectId;

  customerSnapshot: IInvoiceCustomerSnapshot;
  vehicleSnapshot?: IInvoiceVehicleSnapshot;
  invoiceProfileSnapshot?: IInvoiceProfileSnapshot;

  issueDate: Date;
  dueDate?: Date;

  lineItems: IInvoiceLineItem[];

  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  notes?: string;

  // ✅ email meta
  email?: InvoiceEmailMeta;

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

const InvoicePaymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["cash", "card", "e-transfer", "cheque"],
      required: true,
    },
    reference: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0.01 },
    paidAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);




const InvoiceSchema = new Schema(
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
      trim: true,
    },

    status: {
      type: String,
      enum: ["draft", "sent", "paid", "void"],
      default: "draft",
      lowercase: true,
      trim: true,
      index: true,
    },

    // ✅ NEW: canonical financial status (backend truth)
    financialStatus: {
      type: String,
      enum: ["paid", "partial", "due", "void"],
      default: "due",
      lowercase: true,
      trim: true,
      index: true,
    },

    // ✅ lifecycle stamps
    sentAt: { type: Date },
    paidAt: { type: Date },
    voidedAt: { type: Date },
    voidReason: { type: String, trim: true },

    payments: {
      type: [InvoicePaymentSchema],
      required: true,
      default: [],
    },

    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, default: 0, min: 0 },

    kind: {
      type: String,
      enum: ["standard", "deposit", "final", "credit", "revision"],
      default: "standard",
      index: true,
    },

    revision: { type: Number, default: 0, min: 0 },

    parentInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },

    workOrderId: {
      type: Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true,
      index: true,
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

    invoiceProfileSnapshot: {
      shopName: String,
      logoUrl: String,
      address: String,
      phone: String,
      email: String,
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

    // Email tracking
    email: {
      status: {
        type: String,
        enum: ["never_sent", "sending", "sent", "failed"],
        default: "never_sent",
      },
      lastTo: { type: String, default: "" },
      lastSentAt: { type: Date },
      lastMessageId: { type: String, default: "" },
      lastError: { type: String, default: "" },
      attempts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

    // ✅ Guard: void invoices must always have financialStatus === "void"
    InvoiceSchema.pre("save", function (next) {
      // `this` is the invoice doc
      if (this.status === "void" && this.financialStatus !== "void") {
        this.financialStatus = "void";
      }
      next();
    });


export type Invoice = mongoose.InferSchemaType<typeof InvoiceSchema>;
export type InvoiceDoc = mongoose.HydratedDocument<Invoice>;

// Indexes
InvoiceSchema.index({ accountId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ accountId: 1, workOrderId: 1 }); // not unique
InvoiceSchema.index({ accountId: 1, createdAt: -1 });
InvoiceSchema.index({ accountId: 1, status: 1, createdAt: -1 }); // helpful for finance views
InvoiceSchema.index({ accountId: 1, status: 1, paidAt: -1 });
InvoiceSchema.index({ accountId: 1, status: 1, sentAt: -1 });

// ✅ NEW (optional but helpful): finance filtering/sorting
InvoiceSchema.index({ accountId: 1, financialStatus: 1, createdAt: -1 });

const InvoiceModel = mongoose.model<Invoice>("Invoice", InvoiceSchema);
export default InvoiceModel;
