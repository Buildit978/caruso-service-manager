import { Schema, model, type Document } from "mongoose";
import { Types } from "mongoose";

export type UserRole = "owner" | "manager" | "technician" | "admin" | "superadmin";

export interface IUser extends Document {
  accountId: Types.ObjectId;
  email: string; // stored lowercase
  firstName?: string;
  lastName?: string;
  phone?: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  tokenInvalidBefore?: Date; // Instant token revocation (for firing/force logout)
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: false,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["owner", "manager", "technician", "admin", "superadmin"],
      required: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    tokenInvalidBefore: {
      type: Date,
      default: null,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index on {accountId, email}
userSchema.index({ accountId: 1, email: 1 }, { unique: true });

export const User = model<IUser>("User", userSchema);
