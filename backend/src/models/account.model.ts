import { Schema, model, type Document } from "mongoose";

export interface IAccount extends Document {
  name: string;
  slug?: string;          // e.g. "carusos-service-center"
  contactName?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  lastActiveAt?: Date;
  emailsSentCount: number;
  lastEmailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    contactName: String,
    email: String,
    phone: String,
    isActive: { type: Boolean, default: true, required: true },
    lastActiveAt: Date,
    emailsSentCount: { type: Number, default: 0 },
    lastEmailSentAt: Date,
  },
  {
    timestamps: true,
  }
);

export const Account = model<IAccount>("Account", accountSchema);
