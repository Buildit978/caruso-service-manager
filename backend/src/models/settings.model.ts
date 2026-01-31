// backend/src/models/settings.model.ts
import { Schema, model, type Document } from "mongoose";
import { Types } from "mongoose";

export type DiscountType = "none" | "percent" | "flat";

export interface IPermissions {
  manager: {
    canManageUsers: boolean;
    canEditSettingsName: boolean;
    canSeeFinancials: boolean;
  };
  technician: {
    canChangeStatus: boolean;
    canPostInternalMessages: boolean;
    canEditLineItemsQty: boolean;
    canEditLineItemDesc: boolean;
  };
}

export interface IRoleAccess {
    managersEnabled: boolean;
    techniciansEnabled: boolean;
}

export interface IInvoiceProfile {
    shopName?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
}

export interface ISettings extends Document {
    accountId: Types.ObjectId;
    shopName: string;
    taxRate: number; // e.g. 0.13 = 13%
    discountType: DiscountType;
    discountValue: number; // percent (0–100) or flat amount in CAD
    permissions: IPermissions; // Deprecated but kept for migration
    roleAccess: IRoleAccess; // V1 role kill-switch
    invoiceProfile?: IInvoiceProfile;
}

const settingsSchema = new Schema<ISettings>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            index: true,
        },
        shopName: {
            type: String,
            default: "Caruso's Service Center",
            trim: true,
        },
        taxRate: {
            type: Number,
            default: 0.13, // 13%
            min: 0,
            max: 1,
        },
        discountType: {
            type: String,
            enum: ["none", "percent", "flat"],
            default: "none",
        },
        discountValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        roleAccess: {
            type: {
                managersEnabled: { type: Boolean, default: true },
                techniciansEnabled: { type: Boolean, default: true },
            },
            default: () => ({
                managersEnabled: true,
                techniciansEnabled: true,
            }),
            required: true,
        },
        invoiceProfile: {
            shopName: String,
            logoUrl: String,
            address: String,
            phone: String,
            email: String,
            taxId: String,
        },
        permissions: {
            type: {
                manager: {
                    canManageUsers: { type: Boolean, default: true },
                    canEditSettingsName: { type: Boolean, default: false },
                    canSeeFinancials: { type: Boolean, default: true },
                },
                technician: {
                    canChangeStatus: { type: Boolean, default: true },
                    canPostInternalMessages: { type: Boolean, default: true },
                    canEditLineItemsQty: { type: Boolean, default: true },
                    canEditLineItemDesc: { type: Boolean, default: true },
                },
            },
            default: () => ({
                manager: {
                    canManageUsers: true,
                    canEditSettingsName: false,
                    canSeeFinancials: true,
                },
                technician: {
                    canChangeStatus: true,
                    canPostInternalMessages: true,
                    canEditLineItemsQty: true,
                    canEditLineItemDesc: true,
                },
            }),
        },
    },
    {
        timestamps: true,
    }
);

// Unique index on accountId (one settings per account)
settingsSchema.index({ accountId: 1 }, { unique: true });

export const Settings = model<ISettings>("Settings", settingsSchema);
