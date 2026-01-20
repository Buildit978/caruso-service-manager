// frontend/src/api/settings.ts
import { http } from "./http";

export type DiscountType = "none" | "percent" | "flat";

export type SettingsResponse = {
    _id: string;
    shopName: string;
    taxRate: number;        // stored as 0–1 in DB
    discountType: DiscountType;
    discountValue: number;  // 0–100 if percent, or CAD if flat
};

export type UpdateSettingsPayload = {
    shopName?: string;
    taxRate?: number;         // send as percent (e.g. 13)
    discountType?: DiscountType;
    discountValue?: number;
};

export async function fetchSettings(): Promise<SettingsResponse> {
    return await http<SettingsResponse>("/settings");
}

export async function updateSettings(
    payload: UpdateSettingsPayload
): Promise<SettingsResponse> {
    return await http<SettingsResponse>("/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}
