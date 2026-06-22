import { Schema, model, type Document } from "mongoose";

export type FoundingPartnerStatus = "active" | "paused" | "inactive";

export interface IFoundingPartner extends Document {
  name: string;
  email: string;
  phone?: string;
  region?: string;
  status: FoundingPartnerStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const foundingPartnerSchema = new Schema<IFoundingPartner>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    region: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "paused", "inactive"],
      default: "active",
      required: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

foundingPartnerSchema.index({ email: 1 }, { unique: true });
foundingPartnerSchema.index({ status: 1, createdAt: -1 });

export const FoundingPartner = model<IFoundingPartner>("FoundingPartner", foundingPartnerSchema);
