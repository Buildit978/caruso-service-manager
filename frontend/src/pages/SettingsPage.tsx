// src/pages/SettingsPage.tsx
import { useEffect, useState, useRef } from "react";
import {
    fetchSettings,
    updateSettings,
    updateRoleAccess,
    deactivateAccount,
    fetchInvoiceProfile,
    patchInvoiceProfile,
    regenerateShopCode,
    type SettingsResponse,
    type DiscountType,
    type RoleAccess,
    type InvoiceProfile,
} from "../api/settings";
import TokenPanel from "../components/auth/TokenPanel";
import RoleSwitcher from "../components/auth/RoleSwitcher";
import { useSettingsAccess } from "../contexts/SettingsAccessContext";
import { useMe } from "../auth/useMe";
import type { HttpError } from "../api/http";
import { getBillingLockState, subscribe, isBillingLockedError } from "../state/billingLock";
import { exportCustomers, importCustomers, type ImportSummary } from "../api/customers";
import { updateMe } from "../api/users";
import { clearToken } from "../api/http";
import { useNavigate } from "react-router-dom";

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
    const { me, refetch: refetchMe } = useMe();
    const isOwner = me?.role === "owner";

    // My profile (display name)
    const [displayNameDraft, setDisplayNameDraft] = useState("");
    const [savingDisplayName, setSavingDisplayName] = useState(false);

    // Data Tools state
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportSummary | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    
    // Deactivate shop state
    const [deactivateConfirm, setDeactivateConfirm] = useState("");
    const [deactivating, setDeactivating] = useState(false);
    const [deactivateError, setDeactivateError] = useState<string | null>(null);
    const [shopCode, setShopCode] = useState<string | null>(null);
    const [regeneratingShopCode, setRegeneratingShopCode] = useState(false);
    const [billingLocked, setBillingLocked] = useState(() => getBillingLockState().billingLocked);
    useEffect(() => {
        return subscribe((s) => setBillingLocked(s.billingLocked));
    }, []);
    const navigate = useNavigate();

    useEffect(() => {
        if (me) setDisplayNameDraft(me.displayName ?? "");
    }, [me]);

    // Invoice Profile (owner can edit, manager can view)
    const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile | null>(null);
    const [invoiceProfileDraft, setInvoiceProfileDraft] = useState<InvoiceProfile>({});
    const [savingInvoiceProfile, setSavingInvoiceProfile] = useState(false);

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
                setShopCode(data.shopCode ?? null);

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

                try {
                    const profile = await fetchInvoiceProfile();
                    if (isMounted) {
                        setInvoiceProfile(profile ?? {});
                        setInvoiceProfileDraft(profile ?? {});
                    }
                } catch {
                    if (isMounted) {
                        setInvoiceProfile({});
                        setInvoiceProfileDraft({});
                    }
                }

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
            setError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : "Unable to save settings. Please try again.");
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
            setError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : "Unable to save role access. Please try again.");
        } finally {
            setSavingRoleAccess(false);
        }
    }

    async function handleSaveInvoiceProfile(e: React.FormEvent) {
        e.preventDefault();
        setSavingInvoiceProfile(true);
        setError(null);
        try {
            const updated = await patchInvoiceProfile(invoiceProfileDraft);
            setInvoiceProfile(updated);
            setInvoiceProfileDraft(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save invoice profile", err);
            setError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : "Unable to save invoice profile. Please try again.");
        } finally {
            setSavingInvoiceProfile(false);
        }
    }

    function invoiceProfileField(
        id: string,
        label: string,
        value: string,
        onChange: (v: string) => void,
        helper?: string
    ) {
        const inputStyle = {
            width: "100%" as const,
            padding: "0.5rem 0.6rem",
            borderRadius: "0.375rem",
            border: "1px solid #4b5563",
            background: "#020617",
            color: "#e5e7eb",
        };
        const labelStyle = { display: "block" as const, fontSize: "0.9rem", marginBottom: "0.35rem", color: "#e5e7eb" };
        const helperStyle = { fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" };
        return (
            <div style={{ marginBottom: "1rem" }}>
                <label htmlFor={id} style={labelStyle}>{label}</label>
                {isOwner ? (
                    <input
                        id={id}
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        style={inputStyle}
                    />
                ) : (
                    <div style={{ ...inputStyle, background: "#111827", color: "#9ca3af" }}>{value || "—"}</div>
                )}
                {helper && <p style={helperStyle}>{helper}</p>}
            </div>
        );
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

            <div className="settings-grid">
                {/* My profile — display name for notes and admin */}
                <div className="settings-card">
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb" }}>
                        My profile
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "0.75rem" }}>
                        Shown on internal notes and activity (e.g., Mikey (Account owner)).
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label htmlFor="displayName" style={{ display: "block", fontSize: "0.9rem", color: "#e5e7eb" }}>
                            Display name (nickname)
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayNameDraft}
                            onChange={(e) => setDisplayNameDraft(e.target.value)}
                            maxLength={40}
                            placeholder={me?.name ?? "Your name"}
                            style={{
                                width: "100%",
                                maxWidth: "20rem",
                                padding: "0.5rem 0.6rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #4b5563",
                                background: "#020617",
                                color: "#e5e7eb",
                            }}
                        />
                        <button
                            type="button"
                            disabled={savingDisplayName}
                            onClick={async () => {
                                setSavingDisplayName(true);
                                try {
                                    await updateMe({ displayName: displayNameDraft.trim() || undefined });
                                    await refetchMe();
                                    setSaved(true);
                                    setTimeout(() => setSaved(false), 2000);
                                } catch (err: any) {
                                    setError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : err?.message ?? "Failed to save display name");
                                } finally {
                                    setSavingDisplayName(false);
                                }
                            }}
                            style={{
                                alignSelf: "flex-start",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #4b5563",
                                background: savingDisplayName ? "#4b5563" : "#1d4ed8",
                                color: "#e5e7eb",
                                fontWeight: 600,
                                cursor: savingDisplayName ? "default" : "pointer",
                            }}
                        >
                            {savingDisplayName ? "Saving…" : "Save name"}
                        </button>
                    </div>
                </div>

                {/* Invoice Profile — first (top-left on desktop) */}
                <div className="settings-card">
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb" }}>
                        Invoice Profile
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.25rem" }}>
                        Branding and contact info shown on invoice PDFs.
                    </p>
                    {invoiceProfile !== null && (
                        <form onSubmit={handleSaveInvoiceProfile}>
                            {invoiceProfileField(
                                "invoiceProfile-shopName",
                                "Shop Name",
                                invoiceProfileDraft.shopName ?? "",
                                (v) => setInvoiceProfileDraft((p) => ({ ...p, shopName: v }))
                            )}
                            {invoiceProfileField(
                                "invoiceProfile-logoUrl",
                                "Logo URL",
                                invoiceProfileDraft.logoUrl ?? "",
                                (v) => setInvoiceProfileDraft((p) => ({ ...p, logoUrl: v }))
                            )}
                            {invoiceProfileField(
                                "invoiceProfile-address",
                                "Address",
                                invoiceProfileDraft.address ?? "",
                                (v) => setInvoiceProfileDraft((p) => ({ ...p, address: v }))
                            )}
                            {invoiceProfileField(
                                "invoiceProfile-phone",
                                "Phone",
                                invoiceProfileDraft.phone ?? "",
                                (v) => setInvoiceProfileDraft((p) => ({ ...p, phone: v }))
                            )}
                            {invoiceProfileField(
                                "invoiceProfile-email",
                                "Email",
                                invoiceProfileDraft.email ?? "",
                                (v) => setInvoiceProfileDraft((p) => ({ ...p, email: v }))
                            )}
                            {invoiceProfileField(
                                "invoiceProfile-taxId",
                                "Tax ID",
                                invoiceProfileDraft.taxId ?? "",
                                (v) => setInvoiceProfileDraft((p) => ({ ...p, taxId: v })),
                                "Shows on invoices (optional)."
                            )}
                            {isOwner && (
                                <button
                                    type="submit"
                                    disabled={savingInvoiceProfile}
                                    style={{
                                        marginTop: "0.5rem",
                                        padding: "0.55rem 0.9rem",
                                        borderRadius: "0.5rem",
                                        border: "none",
                                        background: savingInvoiceProfile ? "#4b5563" : "#1d4ed8",
                                        color: "#e5e7eb",
                                        fontWeight: 600,
                                        cursor: savingInvoiceProfile ? "default" : "pointer",
                                    }}
                                >
                                    {savingInvoiceProfile ? "Saving…" : "Save Invoice Profile"}
                                </button>
                            )}
                        </form>
                    )}
                </div>

                {/* Shop name, tax, discount */}
                <div className="settings-card">
            <form
                onSubmit={handleSave}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                }}
            >
                {/* Shop Code (Owner Only) */}
                {isOwner && (
                    <div>
                        <label
                            htmlFor="shopCode"
                            style={{
                                display: "block",
                                fontSize: "0.9rem",
                                marginBottom: "0.25rem",
                                color: "#e5e7eb",
                            }}
                        >
                            Shop Code
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                            <div
                                style={{
                                    flex: 1,
                                    padding: "0.5rem 0.6rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid #4b5563",
                                    background: "#111827",
                                    color: "#e5e7eb",
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    letterSpacing: "0.05em",
                                }}
                            >
                                {shopCode || "—"}
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!window.confirm("Regenerate Shop Code? Staff will need the new code for future logins.")) {
                                        return;
                                    }
                                    setRegeneratingShopCode(true);
                                    try {
                                        const resp = await regenerateShopCode();
                                        setShopCode(resp.shopCode);
                                        setSaved(true);
                                        setTimeout(() => setSaved(false), 2000);
                                    } catch (err: any) {
                                        console.error("Failed to regenerate shop code", err);
                                        if (err?.status === 429) {
                                            setError("Shop Code was recently regenerated. Please wait a few minutes before trying again.");
                                        } else {
                                            setError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : err?.message || "Failed to regenerate shop code");
                                        }
                                    } finally {
                                        setRegeneratingShopCode(false);
                                    }
                                }}
                                disabled={regeneratingShopCode}
                                style={{
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid #4b5563",
                                    background: regeneratingShopCode ? "#4b5563" : "#1d4ed8",
                                    color: "#e5e7eb",
                                    fontSize: "0.85rem",
                                    fontWeight: 600,
                                    cursor: regeneratingShopCode ? "not-allowed" : "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {regeneratingShopCode ? "Regenerating…" : "Regenerate"}
                            </button>
                            {shopCode && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(shopCode);
                                            setSaved(true);
                                            setTimeout(() => setSaved(false), 2000);
                                        } catch (err) {
                                            // Fallback
                                            const textarea = document.createElement("textarea");
                                            textarea.value = shopCode;
                                            textarea.style.position = "fixed";
                                            textarea.style.opacity = "0";
                                            document.body.appendChild(textarea);
                                            textarea.select();
                                            try {
                                                document.execCommand("copy");
                                                setSaved(true);
                                                setTimeout(() => setSaved(false), 2000);
                                            } catch {}
                                            document.body.removeChild(textarea);
                                        }
                                    }}
                                    style={{
                                        padding: "0.5rem 0.75rem",
                                        borderRadius: "0.375rem",
                                        border: "1px solid #4b5563",
                                        background: "transparent",
                                        color: "#e5e7eb",
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Copy
                                </button>
                            )}
                        </div>
                        <p
                            style={{
                                fontSize: "0.8rem",
                                color: "#6b7280",
                                marginTop: "0.25rem",
                            }}
                        >
                            Share this code with your staff. They'll need it to sign in.
                        </p>
                    </div>
                )}

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
                    {isOwner ? (
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
                    ) : (
                        <div
                            style={{
                                width: "100%",
                                padding: "0.5rem 0.6rem",
                                borderRadius: "0.375rem",
                                border: "1px solid #4b5563",
                                background: "#111827",
                                color: "#9ca3af",
                            }}
                        >
                            {shopName || "—"}
                        </div>
                    )}
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
                </div>

            {/* Beta Status — owner/manager only, read-only */}
            {(me?.role === "owner" || me?.role === "manager") && settings?.betaStatus && (
                <div className="settings-card" style={{ margin: 0 }}>
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb" }}>
                        Beta Status
                    </h2>
                    {settings.betaStatus.isBetaTester ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem" }}>
                            <div style={{ fontWeight: 600, color: "#e5e7eb" }}>Beta Tester</div>
                            {settings.betaStatus.trialEndsAt && (
                                <div style={{ color: "#9ca3af" }}>
                                    Trial ends: {new Date(settings.betaStatus.trialEndsAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                                </div>
                            )}
                        </div>
                    ) : settings.betaStatus.betaCandidate ? (
                        (() => {
                            const since = settings.betaStatus.betaCandidateSince ? new Date(settings.betaStatus.betaCandidateSince) : null;
                            const windowEndMs = since ? since.getTime() + 7 * 24 * 60 * 60 * 1000 : 0;
                            const remainingMs = windowEndMs - Date.now();
                            const daysLeft = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                            const wo = settings.betaStatus.betaActivation.workOrdersCreated;
                            const inv = settings.betaStatus.betaActivation.invoicesCreated;
                            return (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.95rem" }}>
                                    <div style={{ fontWeight: 600, color: "#e5e7eb" }}>Beta qualification in progress</div>
                                    <div style={{ color: "#9ca3af" }}>
                                        Work orders: {wo} / 3 · Invoices: {inv} / 3
                                    </div>
                                    <div style={{ color: "#9ca3af" }}>
                                        {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining in qualification window
                                    </div>
                                </div>
                            );
                        })()
                    ) : null}
                </div>
            )}

            {/* Role Access Section (Owner Only) */}
            {isOwner && roleAccess && (
                <div className="settings-card"
                    style={{ margin: 0 }}
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
                <div className="settings-card" style={{ margin: 0 }}>
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

            {/* Data Tools Section (Owner Only) */}
            {isOwner && (
                <div className="settings-card" style={{ margin: 0 }}>
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#e5e7eb" }}>
                        Data Tools
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
                        Export and import customer data in CSV format.
                    </p>

                    {/* Export Section */}
                    <div style={{ marginBottom: "2rem" }}>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "0.75rem" }}>
                            Export Customers
                        </h3>
                        <button
                            type="button"
                            onClick={async () => {
                                setExporting(true);
                                setExportError(null);
                                try {
                                    const { blob, filename } = await exportCustomers();
                                    const blobUrl = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = blobUrl;
                                    link.download = filename || `customers-${new Date().toISOString().split("T")[0]}.csv`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(blobUrl);
                                } catch (err: any) {
                                    console.error("Failed to export customers", err);
                                    setExportError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : err.message || "Failed to export customers");
                                } finally {
                                    setExporting(false);
                                }
                            }}
                            disabled={exporting || billingLocked}
                            style={{
                                padding: "0.55rem 0.9rem",
                                borderRadius: "0.5rem",
                                border: "none",
                                background: exporting || billingLocked ? "#4b5563" : "#1d4ed8",
                                color: "#e5e7eb",
                                fontWeight: 600,
                                cursor: exporting ? "default" : "pointer",
                            }}
                        >
                            {exporting ? "Exporting…" : "Export Customers (CSV)"}
                        </button>
                        {exportError && (
                            <p style={{ color: "#fca5a5", fontSize: "0.9rem", marginTop: "0.5rem" }}>{exportError}</p>
                        )}
                    </div>

                    {/* Import Section */}
                    <div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "0.75rem" }}>
                            Import Customers
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const headers = ["firstName", "lastName", "phone", "email", "address", "notes"];
                                    const sampleRow = ["Jane", "Doe", "8685551234", "jane@example.com", "Scarborough", "VIP customer"];
                                    const csvContent = headers.join(",") + "\n" + sampleRow.join(",") + "\n";
                                    const blob = new Blob([csvContent], { type: "text/csv" });
                                    const blobUrl = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = blobUrl;
                                    link.download = "customers-template.csv";
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(blobUrl);
                                }}
                                style={{
                                    padding: "0.55rem 0.9rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #4b5563",
                                    background: "transparent",
                                    color: "#e5e7eb",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Download CSV Template
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    setImportFile(file);
                                    setImportResult(null);
                                    setImportError(null);
                                }}
                                style={{
                                    padding: "0.5rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #4b5563",
                                    background: "#020617",
                                    color: "#e5e7eb",
                                }}
                            />
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!importFile) {
                                        setImportError("Please select a CSV file");
                                        return;
                                    }
                                    setImporting(true);
                                    setImportError(null);
                                    setImportResult(null);
                                    try {
                                        const result = await importCustomers(importFile);
                                        setImportResult(result);
                                        setImportFile(null);
                                        // Reset file input
                                        if (fileInputRef.current) {
                                            fileInputRef.current.value = "";
                                        }
                                    } catch (err: any) {
                                        console.error("Failed to import customers", err);
                                        setImportError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : err.message || "Failed to import customers");
                                    } finally {
                                        setImporting(false);
                                    }
                                }}
                                disabled={importing || !importFile || billingLocked}
                                style={{
                                    padding: "0.55rem 0.9rem",
                                    borderRadius: "0.5rem",
                                    border: "none",
                                    background: importing || !importFile || billingLocked ? "#4b5563" : "#1d4ed8",
                                    color: "#e5e7eb",
                                    fontWeight: 600,
                                    cursor: importing || !importFile || billingLocked ? "default" : "pointer",
                                }}
                            >
                                {importing ? "Importing…" : "Import CSV"}
                            </button>
                        </div>

                        {/* Import Results */}
                        {importError && (
                            <p style={{ color: "#fca5a5", fontSize: "0.9rem", marginBottom: "1rem" }}>{importError}</p>
                        )}

                        {importResult && (
                            <div
                                style={{
                                    padding: "1rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #374151",
                                    background: "#111827",
                                    marginBottom: "1rem",
                                }}
                            >
                                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "0.75rem" }}>
                                    Import Summary
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
                                    <div style={{ color: "#22c55e" }}>Created: {importResult.created}</div>
                                    <div style={{ color: "#3b82f6" }}>Updated: {importResult.updated}</div>
                                    <div style={{ color: "#fbbf24" }}>Skipped: {importResult.skipped}</div>
                                    <div style={{ color: "#fca5a5" }}>Failed: {importResult.failed}</div>
                                </div>
                                {importResult.errors.length > 0 && (
                                    <div style={{ marginTop: "1rem" }}>
                                        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e5e7eb", marginBottom: "0.5rem" }}>
                                            Errors (showing first 5):
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", color: "#fca5a5" }}>
                                            {importResult.errors.slice(0, 5).map((error, idx) => (
                                                <div key={idx}>
                                                    Row {error.row}: {error.message}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Danger Zone Section (Owner Only) */}
            {isOwner && (
                <div
                    className="settings-card"
                    style={{
                        margin: 0,
                        borderColor: "#dc2626",
                        background: "#1f1f1f",
                    }}
                >
                    <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.2rem", fontWeight: 600, color: "#dc2626" }}>
                        Danger Zone
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.5rem" }}>
                        Deactivating your shop will immediately log out all users and prevent any login attempts. You can reactivate your shop at any time by logging in with your owner credentials.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label
                                htmlFor="deactivateConfirm"
                                style={{
                                    display: "block",
                                    fontSize: "0.9rem",
                                    marginBottom: "0.5rem",
                                    color: "#e5e7eb",
                                }}
                            >
                                Type <strong style={{ color: "#dc2626" }}>DEACTIVATE</strong> to confirm:
                            </label>
                            <input
                                id="deactivateConfirm"
                                type="text"
                                value={deactivateConfirm}
                                onChange={(e) => setDeactivateConfirm(e.target.value)}
                                disabled={deactivating}
                                style={{
                                    width: "100%",
                                    padding: "0.5rem 0.6rem",
                                    borderRadius: "0.375rem",
                                    border: "1px solid #dc2626",
                                    background: "#020617",
                                    color: "#e5e7eb",
                                }}
                            />
                        </div>

                        {deactivateError && (
                            <p style={{ color: "#fca5a5", fontSize: "0.9rem" }}>{deactivateError}</p>
                        )}

                        <button
                            type="button"
                            onClick={async () => {
                                if (deactivateConfirm !== "DEACTIVATE") {
                                    setDeactivateError("Please type DEACTIVATE to confirm");
                                    return;
                                }

                                setDeactivating(true);
                                setDeactivateError(null);

                                try {
                                    await deactivateAccount();
                                    // Clear token and redirect to login
                                    clearToken();
                                    navigate("/login", { replace: true });
                                    // Show message (could use a toast/notification system if available)
                                } catch (err: any) {
                                    console.error("Failed to deactivate account", err);
                                    setDeactivateError(isBillingLockedError(err) ? "Billing is inactive. Update billing to continue." : err.message || "Failed to deactivate account");
                                    setDeactivating(false);
                                }
                            }}
                            disabled={deactivating || deactivateConfirm !== "DEACTIVATE"}
                            style={{
                                padding: "0.55rem 0.9rem",
                                borderRadius: "0.5rem",
                                border: "none",
                                background: deactivating || deactivateConfirm !== "DEACTIVATE" ? "#4b5563" : "#dc2626",
                                color: "#ffffff",
                                fontWeight: 600,
                                cursor: deactivating || deactivateConfirm !== "DEACTIVATE" || billingLocked ? "not-allowed" : "pointer",
                            }}
                        >
                            {deactivating ? "Deactivating…" : "Deactivate Shop"}
                        </button>
                    </div>
                </div>
            )}

            </div>
            {/* end settings-grid */}

            <TokenPanel />
            <RoleSwitcher />
        </div>
    );
}
