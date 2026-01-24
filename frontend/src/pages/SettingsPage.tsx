// src/pages/SettingsPage.tsx
import { useEffect, useState } from "react";
import {
    fetchSettings,
    updateSettings,
    updateRoleAccess,
    type SettingsResponse,
    type DiscountType,
    type RoleAccess,
} from "../api/settings";
import TokenPanel from "../components/auth/TokenPanel";
import RoleSwitcher from "../components/auth/RoleSwitcher";
import { useSettingsAccess } from "../contexts/SettingsAccessContext";
import { useMe } from "../auth/useMe";
import type { HttpError } from "../api/http";

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsResponse | null>(null);
    const [shopName, setShopName] = useState("");
    const [taxRatePercent, setTaxRatePercent] = useState<number | "">("");
    const [discountType, setDiscountType] = useState<DiscountType>("none");
    const [discountValue, setDiscountValue] = useState<number | "">("");
    const [roleAccess, setRoleAccess] = useState<RoleAccess | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingRoleAccess, setSavingRoleAccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [isForbidden, setIsForbidden] = useState(false);
    const { setHasAccess } = useSettingsAccess();
    const { me } = useMe();
    const isOwner = me?.role === "owner";

    useEffect(() => {
        let isMounted = true;

        async function load() {
            try {
                const data = await fetchSettings();
                if (!isMounted) return;

                // Server confirmed access
                setHasAccess(true);
                setIsForbidden(false);

                setSettings(data);
                setShopName(data.shopName ?? "");
                setRoleAccess(data.roleAccess || { managersEnabled: true, techniciansEnabled: true });

                // taxRate is stored as decimal (0.13) → show as percent (13)
                setTaxRatePercent(
                    typeof data.taxRate === "number"
                        ? Math.round(data.taxRate * 100)
                        : ""
                );

                setDiscountType(data.discountType ?? "none");
                setDiscountValue(
                    typeof data.discountValue === "number" ? data.discountValue : ""
                );

                setError(null);
            } catch (err) {
                console.error("Failed to load settings", err);
                if (!isMounted) return;

                const httpError = err as HttpError;
                
                // Server denied access (403 Forbidden)
                if (httpError.status === 403) {
                    setHasAccess(false);
                    setIsForbidden(true);
                    setError(null); // Don't show generic error, we'll show a specific message
                } else {
                    // Other errors (network, 500, etc.)
                    setError("Unable to load shop settings.");
                    setIsForbidden(false);
                }
            } finally {
                if (!isMounted) return;
                setLoading(false);
            }
        }

        load();

        return () => {
            isMounted = false;
        };
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setSaved(false);
        setError(null);

        try {
            const payload: any = {};

            if (shopName.trim()) {
                payload.shopName = shopName.trim();
            }

            if (taxRatePercent !== "" && !Number.isNaN(taxRatePercent)) {
                payload.taxRate = Number(taxRatePercent); // send as percent (e.g. 13)
            }

            payload.discountType = discountType;

            if (discountValue !== "" && !Number.isNaN(discountValue)) {
                payload.discountValue = Number(discountValue);
            }

            const updated = await updateSettings(payload);
            setSettings(updated);
            setSaved(true);
        } catch (err) {
            console.error("Failed to save settings", err);
            setError("Unable to save settings. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveRoleAccess(e: React.FormEvent) {
        e.preventDefault();
        setSavingRoleAccess(true);
        setError(null);

        try {
            if (!roleAccess) {
                setError("No role access settings to save");
                return;
            }

            const updated = await updateRoleAccess({
                managersEnabled: roleAccess.managersEnabled,
                techniciansEnabled: roleAccess.techniciansEnabled,
            });
            setRoleAccess(updated.roleAccess);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save role access", err);
            setError("Unable to save role access. Please try again.");
        } finally {
            setSavingRoleAccess(false);
        }
    }

    if (loading) {
        return (
            <div className="page">
                <p>Loading settings…</p>
            </div>
        );
    }

    // Server confirmed access denied (403)
    if (isForbidden) {
        return (
            <div className="page">
                <h1 className="page-title">Shop Settings</h1>
                <div
                    style={{
                        maxWidth: "500px",
                        margin: "2rem auto",
                        padding: "1.5rem",
                        border: "1px solid #fbbf24",
                        borderRadius: "0.5rem",
                        background: "rgba(251, 191, 36, 0.1)",
                    }}
                >
                    <h2 style={{ marginTop: 0, color: "#fbbf24", fontSize: "1.2rem" }}>
                        Access Restricted
                    </h2>
                    <p style={{ color: "#e5e7eb", lineHeight: 1.6 }}>
                        Shop settings are available only to owners and managers.
                        If you need access to settings, please contact your administrator.
                    </p>
                </div>

                {/* TokenPanel always available for dev tools */}
                <TokenPanel />
                <RoleSwitcher />
            </div>
        );
    }

    if (error && !settings) {
        return (
            <div className="page">
                <h1 className="page-title">Shop Settings</h1>
                <p style={{ color: "#fca5a5" }}>{error}</p>
                
                {/* TokenPanel always available even on error */}
                <TokenPanel />
                <RoleSwitcher />
            </div>
        );
    }

    return (
        <div className="page">
            <h1 className="page-title">Shop Settings</h1>
            <p className="page-subtitle">
                Configure your shop name, tax rate, and default discount behavior. These
                values will be used for invoices and work orders in the future.
      </p>

            <form
                onSubmit={handleSave}
                style={{
                    maxWidth: "420px",
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                }}
            >
                {/* Shop Name */}
                <div>
                    <label
                        htmlFor="shopName"
                        style={{
                            display: "block",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                        }}
                    >
                        Shop Name
          </label>
                    <input
                        id="shopName"
                        type="text"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "0.5rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                        }}
                    />
                </div>

                {/* Tax Rate */}
                <div>
                    <label
                        htmlFor="taxRate"
                        style={{
                            display: "block",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                        }}
                    >
                        Tax Rate (%)
          </label>
                    <input
                        id="taxRate"
                        type="number"
                        min={0}
                        max={100}
                        value={taxRatePercent}
                        onChange={(e) =>
                            setTaxRatePercent(
                                e.target.value === "" ? "" : Number(e.target.value)
                            )
                        }
                        style={{
                            width: "100%",
                            padding: "0.5rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                        }}
                    />
                    <p
                        style={{
                            fontSize: "0.8rem",
                            color: "#6b7280",
                            marginTop: "0.25rem",
                        }}
                    >
                        Example: enter <strong>13</strong> for 13% HST.
          </p>
                </div>

                {/* Discount Type */}
                <div>
                    <label
                        htmlFor="discountType"
                        style={{
                            display: "block",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                        }}
                    >
                        Default Discount Type
          </label>
                    <select
                        id="discountType"
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                        style={{
                            width: "100%",
                            padding: "0.5rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                        }}
                    >
                        <option value="none">None</option>
                        <option value="percent">Percent (%)</option>
                        <option value="flat">Flat Amount (CAD)</option>
                    </select>
                </div>

                {/* Discount Value */}
                <div>
                    <label
                        htmlFor="discountValue"
                        style={{
                            display: "block",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                        }}
                    >
                        Default Discount Value
          </label>
                    <input
                        id="discountValue"
                        type="number"
                        min={0}
                        value={discountValue}
                        onChange={(e) =>
                            setDiscountValue(
                                e.target.value === "" ? "" : Number(e.target.value)
                            )
                        }
                        style={{
                            width: "100%",
                            padding: "0.5rem 0.6rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #4b5563",
                            background: "#020617",
                            color: "#e5e7eb",
                        }}
                    />
                    <p
                        style={{
                            fontSize: "0.8rem",
                            color: "#6b7280",
                            marginTop: "0.25rem",
                        }}
                    >
                        If type is <strong>Percent</strong>, this is a % (e.g. 10 for 10%).
            If <strong>Flat</strong>, this is a dollar amount in CAD.
          </p>
                </div>

                {error && (
                    <p style={{ color: "#fca5a5", fontSize: "0.9rem" }}>{error}</p>
                )}

                {saved && !error && (
                    <p style={{ color: "#22c55e", fontSize: "0.9rem" }}>
                        Settings saved successfully.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        marginTop: "0.5rem",
                        padding: "0.55rem 0.9rem",
                        borderRadius: "0.5rem",
                        border: "none",
                        background: saving ? "#4b5563" : "#1d4ed8",
                        color: "#e5e7eb",
                        fontWeight: 600,
                        cursor: saving ? "default" : "pointer",
                    }}
                >
                    {saving ? "Saving…" : "Save Settings"}
                </button>
            </form>

            {/* Role Access Section (Owner Only) */}
            {isOwner && roleAccess && (
                <div
                    style={{
                        maxWidth: "420px",
                        margin: "3rem auto 0",
                        padding: "1.5rem",
                        border: "1px solid #1f2937",
                        borderRadius: "0.75rem",
                        background: "#020617",
                    }}
                >
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb" }}>
                        Role Access
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
                        Control access for all managers and technicians in your account. When disabled, users cannot login and existing sessions are blocked.
                    </p>

                    <form onSubmit={handleSaveRoleAccess}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={roleAccess.managersEnabled}
                                    onChange={(e) =>
                                        setRoleAccess({
                                            ...roleAccess,
                                            managersEnabled: e.target.checked,
                                        })
                                    }
                                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                                />
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb" }}>Enable Managers</div>
                                    <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                                        Allow all managers to login and access the system
                                    </div>
                                </div>
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={roleAccess.techniciansEnabled}
                                    onChange={(e) =>
                                        setRoleAccess({
                                            ...roleAccess,
                                            techniciansEnabled: e.target.checked,
                                        })
                                    }
                                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                                />
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb" }}>Enable Technicians</div>
                                    <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                                        Allow all technicians to login and access the system
                                    </div>
                                </div>
                            </label>
                        </div>

                        {error && (
                            <p style={{ color: "#fca5a5", fontSize: "0.9rem", marginBottom: "1rem" }}>{error}</p>
                        )}

                        {saved && !error && (
                            <p style={{ color: "#22c55e", fontSize: "0.9rem", marginBottom: "1rem" }}>
                                Role access updated successfully.
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={savingRoleAccess}
                            style={{
                                marginTop: "0.5rem",
                                padding: "0.55rem 0.9rem",
                                borderRadius: "0.5rem",
                                border: "none",
                                background: savingRoleAccess ? "#4b5563" : "#1d4ed8",
                                color: "#e5e7eb",
                                fontWeight: 600,
                                cursor: savingRoleAccess ? "default" : "pointer",
                            }}
                        >
                            {savingRoleAccess ? "Saving…" : "Save Role Access"}
                        </button>
                    </form>
                </div>
            )}

            {/* Role Access View-Only for Managers */}
            {me?.role === "manager" && roleAccess && (
                <div
                    style={{
                        maxWidth: "420px",
                        margin: "3rem auto 0",
                        padding: "1.5rem",
                        border: "1px solid #1f2937",
                        borderRadius: "0.75rem",
                        background: "#020617",
                    }}
                >
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb" }}>
                        Role Access
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <input
                                type="checkbox"
                                checked={roleAccess.managersEnabled}
                                disabled
                                aria-label="Enable Managers"
                                style={{ width: "18px", height: "18px", cursor: "not-allowed" }}
                            />
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb" }}>Enable Managers</div>
                                <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                                    {roleAccess.managersEnabled ? "Enabled" : "Disabled"}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <input
                                type="checkbox"
                                checked={roleAccess.techniciansEnabled}
                                disabled
                                aria-label="Enable Technicians"
                                style={{ width: "18px", height: "18px", cursor: "not-allowed" }}
                            />
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb" }}>Enable Technicians</div>
                                <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                                    {roleAccess.techniciansEnabled ? "Enabled" : "Disabled"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <TokenPanel />
            <RoleSwitcher />
        </div>
    );
}
