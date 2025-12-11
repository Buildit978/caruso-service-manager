// backend/src/models/vehicle.model.ts
import { Schema, model, type Document, Types } from "mongoose";

export interface IVehicle extends Document {
  accountId: Types.ObjectId;
  customerId: Types.ObjectId;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  licensePlate?: string;
  color?: string;
  notes?: string;
  currentOdometer?: number | null;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      index: true,
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
      required: true,
    },
    vin: { type: String, trim: true },
    year: { type: Number },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    licensePlate: { type: String, trim: true },
    color: { type: String, trim: true },
    notes: { type: String, trim: true },
    
    currentOdometer: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// helpful compound index for queries by account + customer
vehicleSchema.index({ accountId: 1, customerId: 1 });

export const Vehicle = model<IVehicle>("Vehicle", vehicleSchema);
