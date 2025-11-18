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
}


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
    vehicle?: IWorkOrderVehicle;
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
    },
    { _id: false }
);

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

        vehicle: workOrderVehicleSchema,
    },
    {
        timestamps: true,
    }
);

// helpful index for date-based queries
workOrderSchema.index({ date: -1 });


export const WorkOrder = model<IWorkOrder>('WorkOrder', workOrderSchema);
