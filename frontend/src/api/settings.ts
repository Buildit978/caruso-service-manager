// frontend/src/api/settings.ts
import { http } from "./http";

export type DiscountType = "none" | "percent" | "flat";

export type Permissions = {
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
};

export type RoleAccess = {
    managersEnabled: boolean;
    techniciansEnabled: boolean;
};

export type SettingsResponse = {
    _id: string;
    shopName: string;
    taxRate: number;        // stored as 0–1 in DB
    discountType: DiscountType;
    discountValue: number;  // 0–100 if percent, or CAD if flat
    permissions: Permissions; // Deprecated but kept for migration
    roleAccess: RoleAccess; // V1 role kill-switch
};

export type UpdateSettingsPayload = {
    shopName?: string;
    taxRate?: number;         // send as percent (e.g. 13)
    discountType?: DiscountType;
    discountValue?: number;
};

export type UpdatePermissionsPayload = {
    permissions: Partial<Permissions>;
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

export async function updatePermissions(
    payload: UpdatePermissionsPayload
): Promise<SettingsResponse> {
    return await http<SettingsResponse>("/settings/permissions", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

export type UpdateRoleAccessPayload = {
    managersEnabled?: boolean;
    techniciansEnabled?: boolean;
};

export type RoleAccessResponse = {
    roleAccess: RoleAccess;
};

export async function updateRoleAccess(
    payload: UpdateRoleAccessPayload
): Promise<RoleAccessResponse> {
    return await http<RoleAccessResponse>("/settings/role-access", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}
