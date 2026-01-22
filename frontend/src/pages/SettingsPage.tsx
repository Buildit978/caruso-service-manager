// src/pages/SettingsPage.tsx
import { useEffect, useState } from "react";
import {
    fetchSettings,
    updateSettings,
    type SettingsResponse,
    type DiscountType,
} from "../api/settings";
import TokenPanel from "../components/auth/TokenPanel";
import RoleSwitcher from "../components/auth/RoleSwitcher";
import { useSettingsAccess } from "../contexts/SettingsAccessContext";
import type { HttpError } from "../api/http";

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsResponse | null>(null);
    const [shopName, setShopName] = useState("");
    const [taxRatePercent, setTaxRatePercent] = useState<number | "">("");
    const [discountType, setDiscountType] = useState<DiscountType>("none");
    const [discountValue, setDiscountValue] = useState<number | "">("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [isForbidden, setIsForbidden] = useState(false);
    const { setHasAccess } = useSettingsAccess();

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

            <TokenPanel />
            <RoleSwitcher />
        </div>
    );
}
