// src/models/workOrder.model.ts
import { Schema, model, Document, Types } from 'mongoose';

export type WorkOrderStatus = 'open' | 'in_progress' | 'completed' | 'invoiced';

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
  odometer?: number;
  complaint: string;
  diagnosis?: string;
  notes?: string;
  status: WorkOrderStatus;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: IWorkOrderVehicle;

  lineItems: ILineItem[];  // 👈 add this
  taxRate: number;

  subtotal?: number;
  taxAmount?: number;
  total?: number;  // 👈 add this
}


export type LineItemType = "labour" | "part" | "service";


export interface ILineItem {
  type: LineItemType;      // "labour" or "part"
  description: string;
  quantity: number;        // hours for labour, units for parts
  unitPrice: number;       // rate per hour or price per unit
  lineTotal: number;
}



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
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        date: { type: Date, default: Date.now },
        odometer: { type: Number },
        complaint: { type: String, required: true },
        diagnosis: { type: String },
        notes: { type: String },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'completed', 'invoiced'],
            default: 'open',
            lowercase: true,  // normalize any incoming values
            trim: true,
        },
        lineItems: { type: [lineItemSchema], default: [] },
        taxRate: { type: Number, default: 13 },
        
        subtotal: { type: Number, default: 0 },   // 👈
        taxAmount: { type: Number, default: 0 },  // 👈
        total: { type: Number, default: 0 },      // 👈

        vehicle: workOrderVehicleSchema,
    },
    {
        timestamps: true,
    }
);


// helpful index for date-based queries
workOrderSchema.index({ date: -1 });


export const WorkOrder = model<IWorkOrder>('WorkOrder', workOrderSchema);
