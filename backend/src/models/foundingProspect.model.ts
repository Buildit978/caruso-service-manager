import { Schema, model, type Document } from "mongoose";

export type FoundingProspectStatus =
  | "new"
  | "contacted"
  | "demoScheduled"
  | "demoCompleted"
  | "trialStarted"
  | "converted"
  | "closedLost"
  | "notFit";

export interface IFoundingProspect extends Document {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  status: FoundingProspectStatus;
  closedReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const foundingProspectSchema = new Schema<IFoundingProspect>(
  {
    businessName: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    location: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "demoScheduled",
        "demoCompleted",
        "trialStarted",
        "converted",
        "closedLost",
        "notFit",
      ],
      default: "new",
      required: true,
    },
    closedReason: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

foundingProspectSchema.index({ status: 1, createdAt: -1 });
foundingProspectSchema.index({
  businessName: "text",
  contactName: "text",
  email: "text",
  phone: "text",
  website: "text",
});

export const FoundingProspect = model<IFoundingProspect>("FoundingProspect", foundingProspectSchema);
