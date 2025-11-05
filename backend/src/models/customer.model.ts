// src/models/customer.model.ts
import { Schema, model, Document } from 'mongoose';

export interface ICustomer extends Document {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
    {
        name: { type: String, required: true },
        phone: { type: String },
        email: { type: String },
        address: { type: String },
        notes: { type: String },
    },
    {
        timestamps: true,
    }
);

// 🔥 Named export: Customer
export const Customer = model<ICustomer>('Customer', customerSchema);
