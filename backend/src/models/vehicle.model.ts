import { Schema, model, type Document, Types } from "mongoose";

export interface IVehicle extends Document {
  accountId?: Types.ObjectId;
  // customerId: Types.ObjectId;
  // make: string;
  // model: string;
  // ...
}

const vehicleSchema = new Schema<IVehicle>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      index: true,
      required: false,
    },
    // customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    // ...
  },
  {
    timestamps: true,
  }
);

export const Vehicle = model<IVehicle>("Vehicle", vehicleSchema);
