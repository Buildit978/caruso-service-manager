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

export type BetaStatus = {
    isBetaTester: boolean;
    trialEndsAt: string | null;
    betaCandidate: boolean;
    betaCandidateSince: string | null;
    betaActivation: { workOrdersCreated: number; invoicesCreated: number };
};

export type SettingsResponse = {
    _id: string;
    shopName: string;
    taxRate: number;        // stored as 0–1 in DB
    discountType: DiscountType;
    discountValue: number;  // 0–100 if percent, or CAD if flat
    permissions: Permissions; // Deprecated but kept for migration
    roleAccess: RoleAccess; // V1 role kill-switch
    shopCode?: string | null; // Account.slug (owner only)
    betaStatus?: BetaStatus; // Owner/manager only, when account is beta tester or candidate
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

export async function deactivateAccount(): Promise<{ ok: boolean }> {
    return await http<{ ok: boolean }>("/settings/account/deactivate", {
        method: "POST",
    });
}

export async function regenerateShopCode(): Promise<{ ok: true; shopCode: string }> {
    return await http<{ ok: true; shopCode: string }>("/settings/account/regenerate-shop-code", {
        method: "POST",
    });
}

export type InvoiceProfile = {
    shopName?: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
};

export async function fetchInvoiceProfile(): Promise<InvoiceProfile> {
    return await http<InvoiceProfile>("/settings/invoice-profile");
}

export async function patchInvoiceProfile(
    payload: Partial<InvoiceProfile>
): Promise<InvoiceProfile> {
    return await http<InvoiceProfile>("/settings/invoice-profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}
