// backend/src/models/vehicle.model.ts
import { Schema, model, Types, type InferSchemaType } from "mongoose";

const vehicleSchema = new Schema(
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

export type IVehicle = InferSchemaType<typeof vehicleSchema>;
export const Vehicle = model<IVehicle>("Vehicle", vehicleSchema);
