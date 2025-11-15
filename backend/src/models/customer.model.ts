// src/models/customer.model.ts
import { Schema, model, Document } from "mongoose";

export interface ICustomer extends Document {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    fullName: string;
}

const customerSchema = new Schema<ICustomer>(
    {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true },
        address: { type: String, trim: true },
        notes: { type: String, trim: true },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual field for convenience
customerSchema.virtual("fullName").get(function () {
    return `${this.firstName} ${this.lastName}`.trim();
});

export const Customer = model<ICustomer>("Customer", customerSchema);
