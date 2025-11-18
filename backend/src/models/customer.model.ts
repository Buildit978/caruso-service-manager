// src/models/customer.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IVehicle {
    _id?: Types.ObjectId;
    year?: number;
    make?: string;
    model?: string;
    vin?: string;
    licensePlate?: string;
    color?: string;
    notes?: string;
}

export interface ICustomer extends Document {
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    fullName: string;
    vehicles: IVehicle[];
}

const vehicleSchema = new Schema<IVehicle>(
    {
        year: { type: Number },
        make: { type: String, trim: true },
        model: { type: String, trim: true },
        vin: { type: String, trim: true },
        licensePlate: { type: String, trim: true },
        color: { type: String, trim: true },
        notes: { type: String, trim: true },
    },
    {
        _id: true, // subdocuments get _id by default; this just makes it explicit
    }
);

const customerSchema = new Schema<ICustomer>(
    {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true },
        address: { type: String, trim: true },
        notes: { type: String, trim: true },

        // NEW: vehicles array
        vehicles: {
            type: [vehicleSchema],
            default: [],
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual field for convenience
customerSchema.virtual("fullName").get(function (this: ICustomer) {
    return `${this.firstName} ${this.lastName}`.trim();
});

export const Customer = model<ICustomer>("Customer", customerSchema);
