// backend/src/models/settings.model.ts
import { Schema, model, type Document } from "mongoose";

export type DiscountType = "none" | "percent" | "flat";

export interface ISettings extends Document {
    shopName: string;
    taxRate: number; // e.g. 0.13 = 13%
    discountType: DiscountType;
    discountValue: number; // percent (0–100) or flat amount in CAD
}

const settingsSchema = new Schema<ISettings>(
    {
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
    },
    {
        timestamps: true,
    }
);

export const Settings = model<ISettings>("Settings", settingsSchema);
