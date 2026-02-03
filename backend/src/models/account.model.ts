import { Schema, model, type Document, Types } from "mongoose";

export type AccountRegion = "Canada" | "TT";

export interface IAccount extends Document {
  name: string;
  slug?: string;          // e.g. "carusos-service-center"
  region?: AccountRegion; // Canada | TT for admin filtering
  contactName?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  lastActiveAt?: Date;
  emailsSentCount: number;
  lastEmailSentAt?: Date;
  throttleUntil?: Date;
  quarantineUntil?: Date;
  securityNote?: string;
  lastSecurityActionAt?: Date;
  lastSecurityActorId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    region: { type: String, enum: ["Canada", "TT"], required: false },
    contactName: String,
    email: String,
    phone: String,
    isActive: { type: Boolean, default: true, required: true },
    lastActiveAt: Date,
    emailsSentCount: { type: Number, default: 0 },
    lastEmailSentAt: Date,
    throttleUntil: Date,
    quarantineUntil: Date,
    securityNote: String,
    lastSecurityActionAt: Date,
    lastSecurityActorId: Schema.Types.ObjectId,
  },
  {
    timestamps: true,
  }
);

export const Account = model<IAccount>("Account", accountSchema);
