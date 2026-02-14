import { Schema, model, type Document, Types } from "mongoose";

export type AccountRegion = "Canada" | "TT";

export type BillingStatus = "active" | "past_due" | "canceled";

export type BillingExemptReason = "demo" | "internal" | "sales";

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
  // Billing / subscription
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: BillingStatus;
  currentPeriodEnd?: Date;
  graceEndsAt?: Date;
  // Billing exempt (demo / internal / sales)
  billingExempt?: boolean;
  billingExemptReason?: BillingExemptReason;
  billingExemptSetAt?: Date;
  billingExemptSetBy?: string;
  // Account tags (demo, sales, internal, etc.) — normalized lowercase/trim/unique
  accountTags: string[];
  // Trial
  trialEndsAt?: Date;
  isBetaTester?: boolean;
  betaCandidate?: boolean;
  betaCandidateSince?: Date;
  betaActivatedAt?: Date;
  betaActivation?: { workOrdersCreated?: number; invoicesCreated?: number };
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
    // Billing / subscription
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    billingStatus: { type: String, enum: ["active", "past_due", "canceled"], required: false },
    currentPeriodEnd: Date,
    graceEndsAt: Date,
    billingExempt: { type: Boolean, default: false },
    billingExemptReason: { type: String, enum: ["demo", "internal", "sales"] },
    billingExemptSetAt: Date,
    billingExemptSetBy: String,
    accountTags: { type: [String], default: () => [] },
    // Trial
    trialEndsAt: Date,
    isBetaTester: Boolean,
    betaCandidate: Boolean,
    betaCandidateSince: Date,
    betaActivatedAt: Date,
    betaActivation: {
      workOrdersCreated: Number,
      invoicesCreated: Number,
    },
  },
  {
    timestamps: true,
  }
);

function normalizeAccountTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(
    tags
      .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
      .filter((t) => t.length > 0)
  )];
}

accountSchema.pre("save", function (next) {
  if (this.isModified("accountTags") && Array.isArray(this.accountTags)) {
    this.accountTags = normalizeAccountTags(this.accountTags);
  }
  next();
});

export { normalizeAccountTags };
export const Account = model<IAccount>("Account", accountSchema);
