// frontend/src/api/settings.ts
import api from "./client";

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
    const res = await api.get<SettingsResponse>("/settings");
    return res.data;
}

export async function updateSettings(
    payload: UpdateSettingsPayload
): Promise<SettingsResponse> {
    const res = await api.put<SettingsResponse>("/settings", payload);
    return res.data;
}
