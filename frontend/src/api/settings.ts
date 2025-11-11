// frontend/src/api/settings.ts
export type DiscountType = "none" | "percent" | "flat";

export type SettingsResponse = {
    _id: string;
    shopName: string;
    taxRate: number;        // stored as 0–1 in DB
    discountType: DiscountType;
    discountValue: number;  // 0–100 if percent, or CAD if flat
};

const BASE_URL = "http://localhost:4000";

export async function fetchSettings(): Promise<SettingsResponse> {
    const res = await fetch(`${BASE_URL}/api/settings`);
    if (!res.ok) {
        throw new Error("Failed to load settings");
    }
    return res.json();
}

export type UpdateSettingsPayload = {
    shopName?: string;
    taxRate?: number;         // send as percent (e.g. 13)
    discountType?: DiscountType;
    discountValue?: number;
};

export async function updateSettings(
    payload: UpdateSettingsPayload
): Promise<SettingsResponse> {
    const res = await fetch(`${BASE_URL}/api/settings`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error("Failed to update settings");
    }

    return res.json();
}
