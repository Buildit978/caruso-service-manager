import { Schema, model, type Document, Types } from "mongoose";

export type FoundingPartnerStatus = "active" | "paused" | "inactive";

export interface IFoundingPartner extends Document {
  name: string;
  email: string;
  phone?: string;
  region?: string;
  status: FoundingPartnerStatus;
  notes?: string;
  userId?: Types.ObjectId;
  portalEnabledAt?: Date;
  portalDisabledAt?: Date | null;
  lastPortalLoginAt?: Date;
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
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    portalEnabledAt: { type: Date },
    portalDisabledAt: { type: Date, default: null },
    lastPortalLoginAt: { type: Date },
  },
  { timestamps: true }
);

foundingPartnerSchema.index({ email: 1 }, { unique: true });
foundingPartnerSchema.index({ status: 1, createdAt: -1 });
foundingPartnerSchema.index({ userId: 1 }, { unique: true, sparse: true });

export const FoundingPartner = model<IFoundingPartner>("FoundingPartner", foundingPartnerSchema);
