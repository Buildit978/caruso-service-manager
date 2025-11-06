// src/models/workOrder.model.ts
import { Schema, model, Document, Types } from 'mongoose';

export type WorkOrderStatus = 'open' | 'in_progress' | 'completed' | 'invoiced';

export interface IWorkOrder extends Document {
    customerId: Types.ObjectId;
    date: Date;
    odometer?: number;
    complaint: string;
    diagnosis?: string;
    notes?: string;
    status: WorkOrderStatus;
    createdAt: Date;
    updatedAt: Date;
}

const workOrderSchema = new Schema<IWorkOrder>(
    {
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
        },
    },
    {
        timestamps: true,
    }
);

// helpful index for date-based queries
workOrderSchema.index({ date: -1 });


export const WorkOrder = model<IWorkOrder>('WorkOrder', workOrderSchema);
