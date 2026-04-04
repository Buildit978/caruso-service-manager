import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  fetchAdminAccountById,
  fetchAdminAudits,
  fetchAdminAccountUsers,
  fetchAdminAccountEvents,
  postQuarantine,
  deleteQuarantine,
  postThrottle,
  deleteThrottle,
  postForceLogout,
  patchBillingExempt,
  patchAccountTags,
  patchAdminAccountNotes,
  getAdminRole,
  healthFlagsForDisplay,
  healthFlagLabel,
  type AdminAccountItem,
  type AdminAccountUser,
  type AdminAuditItem,
  type AdminAccountEventItem,
  type HttpError,
} from "../../api/admin";
import AdminLayout from "./AdminLayout";
import "./Admin.css";

type SheetKind = "quarantine" | "throttle" | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function copyToClipboard(value: string): void {
  if (!value || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value);
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  "workorder.created": "Work order created",
  "workorder.updated": "Work order updated",
  "estimate.created": "Estimate created",
  "estimate.converted": "Estimate converted",
  "invoice.created": "Invoice created",
  invoice_create_skipped_existing: "Invoice create skipped (existing)",
  "invoice.sent": "Invoice sent",
  invoice_payment_recorded: "Invoice payment recorded",
  invoice_emailed_failed: "Invoice email failed",
  invoice_emailed_success: "Invoice emailed",
  "customer.created": "Customer created",
  "vehicle.created": "Vehicle created",
};

function formatActivityEventType(type: string): string {
  if (EVENT_TYPE_LABELS[type]) return EVENT_TYPE_LABELS[type];
  if (!type) return "Event";
  return type.replace(/\./g, " · ").replace(/_/g, " ");
}

function formatEventDetailLine(ev: AdminAccountEventItem): string | null {
  const parts: string[] = [];
  if (ev.entity?.kind && ev.entity?.id) {
    const shortId = ev.entity.id.length > 10 ? `${ev.entity.id.slice(0, 8)}…` : ev.entity.id;
    parts.push(`${ev.entity.kind}: ${shortId}`);
  }
  const meta = ev.meta;
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    const status = (meta as Record<string, unknown>).status;
    if (typeof status === "string" && status.trim()) parts.push(`status ${status}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Frontend-only assisted actions from healthFlags (compose only; nothing is sent from the app). */
type AssistedActionKind = "email" | "guide";

type AssistedFlagMeta = {
  message: string;
  kind: AssistedActionKind;
};

/** Draft copy for Mailchimp / manual send — `{{shopName}}`, `{{ownerName}}`, `{{ownerEmail}}`, `{{accountSlug}}`. */
type EmailTemplate = {
  subject: string;
  body: string;
  actionLabel: string;
};

const BRAND_NAME = "Shop Service Manager";

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  new_signup: {
    actionLabel: "Prepare welcome email",
    subject: `Welcome to ${BRAND_NAME} — let's get you set up`,
    body: `Hi {{ownerName}},

Thanks for signing up — we're glad {{shopName}} is on ${BRAND_NAME}. A few quick steps to get value right away:

• Confirm your shop details and team members
• Create your first work order when a job comes in
• Send an invoice when you're ready to get paid

If you have questions, just reply to this email.

— ${BRAND_NAME} team`,
  },
  inactive_3d: {
    actionLabel: "Prepare check-in email",
    subject: "Quick check-in",
    body: `Hi {{ownerName}},

We noticed things have been quiet on {{shopName}} in ${BRAND_NAME} over the last few days. If anything is blocking you (setup, training, or a bug), we'd like to help.

Want a short call or a pointer to docs? Reply here and we'll follow up.

— ${BRAND_NAME} team`,
  },
  inactive_7d: {
    actionLabel: "Prepare stronger check-in",
    subject: "We're here if you need anything",
    body: `Hi {{ownerName}},

We haven't seen activity on {{shopName}} in ${BRAND_NAME} for about a week. Before you move on, is there something we should fix or clarify?

If you're pausing intentionally, no problem — if you're stuck, tell us what's going on and we'll do our best to unblock you.

— ${BRAND_NAME} team`,
  },
  no_first_workorder: {
    actionLabel: "Guide to create first work order",
    subject: `Create your first work order in ${BRAND_NAME}`,
    body: `Hi {{ownerName}},

A simple path to your first work order in ${BRAND_NAME}:

1. Open Work orders (or Jobs, depending on your workspace)
2. Click New / Create work order
3. Add customer & vehicle (or minimal details), then save

Once that first work order exists, estimates and invoicing get much easier. If anything in the UI is unclear, reply with a screenshot and we'll guide you.

— ${BRAND_NAME} team`,
  },
  no_first_invoice: {
    actionLabel: "Guide to create first invoice",
    subject: `Create your first invoice in ${BRAND_NAME}`,
    body: `Hi {{ownerName}},

To send your first invoice from ${BRAND_NAME}:

1. From a completed work order or customer, choose the option to create an invoice (or open Invoices → New)
2. Confirm line items and totals
3. Send or download the PDF for your customer

If billing is blocked by setup (tax, numbering, etc.), tell us what's missing and we'll point you to the right place.

— ${BRAND_NAME} team`,
  },
  trial_ending: {
    actionLabel: "Prepare trial reminder",
    subject: `Your ${BRAND_NAME} trial is ending soon`,
    body: `Hi {{ownerName}},

Your ${BRAND_NAME} trial for {{shopName}} is ending soon. To keep uninterrupted access, please add or confirm billing in your account settings.

If you need more time or have questions about plans, reply here.

— ${BRAND_NAME} team`,
  },
  billing_attention: {
    actionLabel: "Prepare billing email",
    subject: "Billing — action needed",
    body: `Hi {{ownerName}},

We're reaching out because billing for {{shopName}} in ${BRAND_NAME} needs attention (for example: past due or payment issue). Please update your payment method or billing details in account settings, or reply to this email if something looks wrong on our side.

— ${BRAND_NAME} team`,
  },
};

/** Replace {{shopName}}, {{ownerName}}, {{ownerEmail}}, {{accountSlug}} in draft strings. */
function applyEmailTemplate(template: string, ctx: { shopName: string; ownerName: string; ownerEmail: string; accountSlug: string }): string {
  const shopName = ctx.shopName.trim() || "your shop";
  const ownerName = ctx.ownerName.trim() || "there";
  const ownerEmail = ctx.ownerEmail.trim();
  const accountSlug = ctx.accountSlug.trim();
  return template
    .replace(/\{\{shopName\}\}/g, shopName)
    .replace(/\{\{ownerName\}\}/g, ownerName)
    .replace(/\{\{ownerEmail\}\}/g, ownerEmail || "[email not on file]")
    .replace(/\{\{accountSlug\}\}/g, accountSlug || "—");
}

function emailContextFromAccount(acct: AdminAccountItem): { shopName: string; ownerName: string; ownerEmail: string; accountSlug: string } {
  return {
    shopName: acct.shopName || acct.name || acct.slug || "",
    ownerName: acct.primaryOwner?.name?.trim() || acct.primaryOwnerDisplayName?.trim() || "",
    ownerEmail: acct.primaryOwner?.email?.trim() || "",
    accountSlug: acct.slug?.trim() || "",
  };
}

/** Placeholder URL — swap for your team’s Mailchimp campaign or audience page if desired. */
const ADMIN_MAILCHIMP_EXTERNAL_URL = "https://mailchimp.com/";

const HEALTH_FLAG_ASSISTED: Record<string, AssistedFlagMeta> = {
  new_signup: { message: "New signup — shop may need onboarding.", kind: "email" },
  inactive_3d: { message: "No meaningful activity in several days.", kind: "email" },
  inactive_7d: { message: "Inactive for a week — higher risk of churn.", kind: "email" },
  no_first_workorder: { message: "No work order created yet.", kind: "guide" },
  no_first_invoice: { message: "No invoice created yet.", kind: "guide" },
  trial_ending: { message: "Trial period is ending soon.", kind: "email" },
  billing_attention: { message: "Billing needs attention (e.g. past due or similar).", kind: "email" },
};

export default function AdminAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<AdminAccountItem | null>(null);
  const [audits, setAudits] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [minutes, setMinutes] = useState("60");
  const [note, setNote] = useState("");
  const isSuperAdmin = getAdminRole() === "superadmin";

  const [users, setUsers] = useState<AdminAccountUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>("");
  const [userActiveFilter, setUserActiveFilter] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [userSearchApplied, setUserSearchApplied] = useState("");

  const [tagsInput, setTagsInput] = useState("");
  const [tagsSaving, setTagsSaving] = useState(false);
  const [billingExemptSaving, setBillingExemptSaving] = useState(false);

  const [activityEvents, setActivityEvents] = useState<AdminAccountEventItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [adminNotesSaving, setAdminNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  /** When true, do not overwrite the textarea from server-driven `account.adminNotes` (avoids snap-back on refetch). */
  const adminNotesTouchedRef = useRef(false);

  /** Session-only: hide assisted suggestion cards (not persisted). */
  const [dismissedAssistedFlagIds, setDismissedAssistedFlagIds] = useState<string[]>([]);
  const [assistedEmailModal, setAssistedEmailModal] = useState<{
    flagId: string;
    subject: string;
    body: string;
  } | null>(null);

  const loadAccount = useCallback(() => {
    if (!accountId) return;
    setError(null);
    fetchAdminAccountById(accountId)
      .then(setAccount)
      .catch((err) => setError((err as HttpError).message ?? "Failed to load account"))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setAccount(null);
    loadAccount();
  }, [accountId, loadAccount]);

  useEffect(() => {
    if (!accountId) return;
    fetchAdminAudits(accountId, { limit: 50 })
      .then((res) => setAudits(res.items))
      .catch(() => setAudits([]));
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    setActivityLoading(true);
    fetchAdminAccountEvents(accountId, { limit: 50 })
      .then((res) => setActivityEvents(res.items))
      .catch(() => setActivityEvents([]))
      .finally(() => setActivityLoading(false));
  }, [accountId]);

  useEffect(() => {
    adminNotesTouchedRef.current = false;
  }, [accountId]);

  useEffect(() => {
    setDismissedAssistedFlagIds([]);
    setAssistedEmailModal(null);
  }, [accountId]);

  useEffect(() => {
    if (adminNotesTouchedRef.current) return;
    setAdminNotesDraft(account?.adminNotes ?? "");
  }, [account?.accountId, account?.adminNotes]);

  const loadUsers = useCallback(() => {
    if (!accountId) return;
    setUsersLoading(true);
    const params: { role?: string; isActive?: boolean; search?: string } = {};
    if (userRoleFilter && userRoleFilter !== "all") params.role = userRoleFilter;
    if (userActiveFilter === "active") params.isActive = true;
    else if (userActiveFilter === "inactive") params.isActive = false;
    if (userSearchApplied) params.search = userSearchApplied;
    fetchAdminAccountUsers(accountId, params)
      .then((res) => setUsers(res.items))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [accountId, userRoleFilter, userActiveFilter, userSearchApplied]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (account?.accountTags) setTagsInput(account.accountTags.join(", "));
    else setTagsInput("");
  }, [account?.accountId, account?.accountTags]);

  const tagsIncludeExemptKind = (tags: string[] | undefined) => {
    if (!tags?.length) return false;
    const lower = tags.map((t) => t.toLowerCase());
    return lower.includes("demo") || lower.includes("sales") || lower.includes("internal");
  };

  const displayHealthFlags = healthFlagsForDisplay(account?.healthFlags);

  const assistedForFlags = displayHealthFlags
    .map((flagId) => {
      const def = HEALTH_FLAG_ASSISTED[flagId];
      if (!def) return null;
      return { flagId, ...def };
    })
    .filter((x): x is { flagId: string } & AssistedFlagSuggestion => x != null);

  const assistedVisible = assistedForFlags.filter((s) => !dismissedAssistedFlagIds.includes(s.flagId));

  function openAssistedEmailModal(flagId: string) {
    if (!account) return;
    const tpl = EMAIL_TEMPLATES[flagId];
    if (!tpl) return;
    const ctx = emailContextFromAccount(account);
    setAssistedEmailModal({
      flagId,
      subject: applyEmailTemplate(tpl.subject, ctx),
      body: applyEmailTemplate(tpl.body, ctx),
    });
  }

  function handleAssistedCopyDraft() {
    if (!assistedEmailModal) return;
    const text = `Subject: ${assistedEmailModal.subject}\n\n${assistedEmailModal.body}`;
    copyToClipboard(text);
    setSuccessMessage("Copied subject and body to clipboard.");
  }

  function handleAssistedCopyAndOpenMailchimp() {
    handleAssistedCopyDraft();
    window.open(ADMIN_MAILCHIMP_EXTERNAL_URL, "_blank", "noopener,noreferrer");
  }

  // DEV_DEBUG: temporary logs to trace billingExempt toggle flow; remove when done.
  const DEV_DEBUG = import.meta.env.DEV;

  function handleBillingExemptToggle() {
    if (DEV_DEBUG) console.log("[billingExempt] 1. handler fired");
    if (!accountId || !account) {
      if (DEV_DEBUG) console.log("[billingExempt] 1b. early return: no accountId or account");
      return;
    }
    const next = !account.billingExempt;
    if (!next && tagsIncludeExemptKind(account.accountTags)) {
      const ok = window.confirm(
        "This account has tags demo, sales, or internal. Turning off Billing Exempt may conflict with that. Continue anyway?"
      );
      if (!ok) {
        if (DEV_DEBUG) console.log("[billingExempt] 1c. early return: user cancelled confirm");
        return;
      }
    }
    if (DEV_DEBUG) console.log("[billingExempt] 2. calling patchBillingExempt, next=", next);
    setBillingExemptSaving(true);
    setActionError(null);
    patchBillingExempt(accountId, {
      billingExempt: next,
      billingExemptReason: next ? (account.billingExemptReason ?? "demo") : undefined,
    })
      .then(() => {
        if (DEV_DEBUG) console.log("[billingExempt] 3. success: setSuccessMessage + loadAccount");
        setActionError(null);
        setSuccessMessage(next ? "Billing exempt enabled." : "Billing exempt disabled.");
        loadAccount();
      })
      .catch((err) => {
        if (DEV_DEBUG) console.log("[billingExempt] 4. catch: error displayed", err);
        const httpErr = err as HttpError;
        const data = httpErr.data as { code?: string; message?: string; blockingTags?: string[] } | undefined;
        const msg =
          httpErr.status === 409 && data?.code === "BILLING_EXEMPT_TAG_BLOCK" && Array.isArray(data.blockingTags)
            ? `Remove demo/sales/internal tag(s) first: ${data.blockingTags.join(", ")}`
            : httpErr.message ?? "Failed";
        setActionError(msg);
      })
      .finally(() => setBillingExemptSaving(false));
  }

  function handleAdminNotesSave(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setNotesError(null);
    setAdminNotesSaving(true);
    const trimmed = adminNotesDraft.trim();
    patchAdminAccountNotes(accountId, { adminNotes: trimmed === "" ? null : trimmed })
      .then((res) => {
        adminNotesTouchedRef.current = false;
        setAccount((prev) =>
          prev
            ? {
                ...prev,
                adminNotes: res.adminNotes,
              }
            : prev
        );
        setAdminNotesDraft(res.adminNotes ?? "");
        setSuccessMessage("Internal notes saved.");
      })
      .catch((err) => setNotesError((err as HttpError).message ?? "Failed to save notes"))
      .finally(() => setAdminNotesSaving(false));
  }

  function handleTagsSave(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !account) return;
    const tags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    setTagsSaving(true);
    setActionError(null);
    patchAccountTags(accountId, { tags })
      .then((updated) => {
        setActionError(null);
        setAccount((prev) => (prev ? { ...prev, ...updated } : updated));
        setSuccessMessage("Tags updated.");
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed to save tags."))
      .finally(() => setTagsSaving(false));
  }

  function closeSheet() {
    setSheet(null);
    setActionError(null);
    setMinutes("60");
    setNote("");
  }

  function handleQuarantineSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    const mins = Math.max(1, Math.min(10080, parseInt(minutes, 10) || 60));
    const until = new Date(Date.now() + mins * 60 * 1000).toISOString();
    setActionLoading(true);
    setActionError(null);
    postQuarantine(accountId, { until, note: note.trim() || undefined })
      .then(() => {
        closeSheet();
        loadAccount();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
      .finally(() => setActionLoading(false));
  }

  function handleQuarantineClear(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setActionLoading(true);
    setActionError(null);
    deleteQuarantine(accountId, { note: note.trim() || undefined })
      .then(() => {
        closeSheet();
        loadAccount();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
      .finally(() => setActionLoading(false));
  }

  function handleThrottleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    const mins = Math.max(1, Math.min(10080, parseInt(minutes, 10) || 60));
    const until = new Date(Date.now() + mins * 60 * 1000).toISOString();
    setActionLoading(true);
    setActionError(null);
    postThrottle(accountId, { until, note: note.trim() || undefined })
      .then(() => {
        closeSheet();
        loadAccount();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
      .finally(() => setActionLoading(false));
  }

  function handleThrottleClear(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setActionLoading(true);
    setActionError(null);
    deleteThrottle(accountId, { note: note.trim() || undefined })
      .then(() => {
        closeSheet();
        loadAccount();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
      .finally(() => setActionLoading(false));
  }

  function handleForceLogoutClick() {
    if (!accountId) return;
    const confirmed = window.confirm(
      "Force logout will invalidate all sessions for this account. Users will need to sign in again. Continue?"
    );
    if (!confirmed) return;
    setActionLoading(true);
    setActionError(null);
    setSuccessMessage(null);
    postForceLogout(accountId)
      .then(() => {
        setActionError(null);
        setSuccessMessage("All users signed out.");
        loadAccount();
      })
      .catch((err) => {
        setActionError((err as HttpError).message ?? "Failed");
      })
      .finally(() => setActionLoading(false));
  }

  if (!accountId) {
    return (
      <AdminLayout title="Account" showBack>
        <p>Missing account ID.</p>
      </AdminLayout>
    );
  }

  const displayName = account?.name || account?.slug || accountId;

  return (
    <AdminLayout title={displayName} showBack>
      {loading && <p className="admin-detail-loading">Loading…</p>}
      {error && <p className="admin-gate-error admin-detail-error">{error}</p>}
      {successMessage && <p className="admin-detail-success" role="status">{successMessage}</p>}
      {!loading && account && (
        <>
          <div className="admin-detail-section admin-detail-identity">
            <h3>Identity</h3>
            <dl className="admin-detail-dl">
              <dt>Shop Name</dt>
              <dd>{account.shopName ?? account.name ?? "—"}</dd>
              <dt>Shop Code</dt>
              <dd className="admin-detail-copy-row">
                <span>{account.shopCode ?? account.slug ?? "—"}</span>
                {(account.shopCode ?? account.slug) && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary admin-btn-small"
                    onClick={() => copyToClipboard(account.shopCode ?? account.slug ?? "")}
                    aria-label="Copy shop code"
                  >
                    Copy
                  </button>
                )}
              </dd>
              <dt>Primary Owner</dt>
              <dd>
                {account.primaryOwner
                  ? [account.primaryOwner.name, account.primaryOwner.email].filter(Boolean).join(" · ")
                  : "—"}
              </dd>
              {account.primaryOwner?.email && (
                <>
                  <dt>Owner Email</dt>
                  <dd className="admin-detail-copy-row">
                    <span>{account.primaryOwner.email}</span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-small"
                      onClick={() => copyToClipboard(account.primaryOwner!.email ?? "")}
                      aria-label="Copy owner email"
                    >
                      Copy
                    </button>
                  </dd>
                </>
              )}
              {account.primaryOwner?.phone && (
                <>
                  <dt>WhatsApp</dt>
                  <dd className="admin-detail-copy-row admin-detail-whatsapp">
                    <span>{account.primaryOwner.phone}</span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-small"
                      onClick={() => copyToClipboard(account.primaryOwner?.phone ?? "")}
                      aria-label="Copy phone"
                    >
                      Copy
                    </button>
                  </dd>
                </>
              )}
              {account.address && (
                <>
                  <dt>Address</dt>
                  <dd className="admin-detail-copy-row">
                    <span className="admin-detail-address">{account.address}</span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-small"
                      onClick={() => copyToClipboard(account.address ?? "")}
                      aria-label="Copy address"
                    >
                      Copy
                    </button>
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div className="admin-detail-section">
            <h3>Account</h3>
            <dl className="admin-detail-dl">
              <dt>Name</dt>
              <dd>{account.name || "—"}</dd>
              <dt>Slug</dt>
              <dd>{account.slug || "—"}</dd>
              <dt>Region</dt>
              <dd>{account.region || "—"}</dd>
              <dt>Status</dt>
              <dd>{account.isActive ? "Active" : "Inactive"}</dd>
              <dt>Billing status</dt>
              <dd>
                {account.billingExempt ? (
                  <span className="admin-badge admin-badge-exempt">Exempt</span>
                ) : account.billingStatus ? (
                  <span className={`admin-badge admin-badge-billing admin-badge-billing-${account.billingStatus}`}>
                    {account.billingStatus === "past_due" ? "Past due" : account.billingStatus === "canceled" ? "Canceled" : "Active"}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Trial ends</dt>
              <dd>{formatDateTime(account.trialEndsAt)}</dd>
              <dt>Grace ends</dt>
              <dd>{formatDateTime(account.graceEndsAt)}</dd>
              <dt>Current period ends</dt>
              <dd>{formatDateTime(account.currentPeriodEnd)}</dd>
              <dt>Created</dt>
              <dd>{formatDate(account.createdAt)}</dd>
              <dt>Last Active</dt>
              <dd>{formatDateTime(account.lastActiveAt)}</dd>
              <dt>ID</dt>
              <dd className="admin-detail-id">{accountId}</dd>
            </dl>
          </div>

          <div className="admin-detail-section">
            <h3>Health</h3>
            <p className="admin-detail-muted">
              Internal operational signals derived from shop activity and billing fields (admin only, not shown to customers).
            </p>
            {displayHealthFlags.length === 0 ? (
              <p className="admin-detail-muted">No health flags at this time.</p>
            ) : (
              <div className="admin-health-badges admin-health-badges-detail">
                {displayHealthFlags.map((id) => (
                  <span key={id} className="admin-badge admin-badge-health" title={id}>
                    {healthFlagLabel(id)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="admin-detail-section">
            <h3>Suggested Actions</h3>
            <p className="admin-detail-muted">
              Assisted mode: ideas only. Nothing is sent automatically — use your normal tools after deciding.
            </p>
            {displayHealthFlags.length === 0 ? (
              <p className="admin-detail-muted">No actions needed.</p>
            ) : assistedForFlags.length === 0 ? (
              <p className="admin-detail-muted">No suggested actions for current health flags.</p>
            ) : assistedVisible.length === 0 ? (
              <p className="admin-detail-muted">All suggestions dismissed for this session.</p>
            ) : (
              <ul className="admin-suggest-list">
                {assistedVisible.map((s) => (
                  <li key={s.flagId} className="admin-suggest-item">
                    <div className="admin-suggest-item-head">
                      <span className="admin-badge admin-badge-health" title={s.flagId}>
                        {healthFlagLabel(s.flagId)}
                      </span>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary admin-btn-small"
                        aria-label={`Dismiss suggestion for ${s.flagId}`}
                        onClick={() =>
                          setDismissedAssistedFlagIds((prev) => (prev.includes(s.flagId) ? prev : [...prev, s.flagId]))
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="admin-suggest-message">{s.message}</p>
                    <p className="admin-detail-muted admin-suggest-action-line">
                      {EMAIL_TEMPLATES[s.flagId]?.actionLabel ?? "Suggested action"}
                    </p>
                    <div className="admin-suggest-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary admin-btn-small"
                        onClick={() => openAssistedEmailModal(s.flagId)}
                      >
                        {s.kind === "guide" ? "Prepare guide" : "Prepare email"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-detail-section">
            <h3>Internal admin notes</h3>
            <p className="admin-detail-muted">Visible only in admin tools. Not shown to shop users.</p>
            <form onSubmit={handleAdminNotesSave} className="admin-detail-tags-form admin-detail-notes-form">
              <div className="admin-form-group">
                <label htmlFor="admin-internal-notes">Notes</label>
                <textarea
                  id="admin-internal-notes"
                  className="admin-input admin-detail-notes-textarea"
                  value={adminNotesDraft}
                  onChange={(e) => {
                    adminNotesTouchedRef.current = true;
                    setAdminNotesDraft(e.target.value);
                  }}
                  placeholder="Internal notes for this account…"
                  disabled={adminNotesSaving}
                  aria-label="Internal admin notes"
                />
              </div>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={adminNotesSaving}>
                {adminNotesSaving ? "…" : "Save notes"}
              </button>
            </form>
            {notesError && <p className="admin-gate-error admin-detail-action-error">{notesError}</p>}
          </div>

          {isSuperAdmin && (
            <>
              <div className="admin-detail-section">
                <h3>Billing Exempt (Demo)</h3>
                <p className="admin-detail-muted">Superadmin only. When on, account is not billed.</p>
                <button
                  type="button"
                  className={`admin-btn ${account.billingExempt ? "admin-btn-secondary" : "admin-btn-primary"}`}
                  onClick={handleBillingExemptToggle}
                  disabled={billingExemptSaving}
                >
                  {billingExemptSaving ? "…" : account.billingExempt ? "Turn off Billing Exempt" : "Turn on Billing Exempt (Demo)"}
                </button>
                {actionError && <p className="admin-gate-error admin-detail-action-error">{actionError}</p>}
              </div>
              <div className="admin-detail-section">
                <h3>Tags</h3>
                <p className="admin-detail-muted">Comma-separated. demo, sales, internal will force Billing Exempt on save.</p>
                <form onSubmit={handleTagsSave} className="admin-detail-tags-form">
                  <input
                    type="text"
                    className="admin-input"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. demo, sales"
                    aria-label="Account tags"
                    disabled={tagsSaving}
                  />
                  <button type="submit" className="admin-btn admin-btn-primary" disabled={tagsSaving}>
                    {tagsSaving ? "…" : "Save tags"}
                  </button>
                  {tagsSaving && <span className="admin-detail-muted">Saving…</span>}
                </form>
                {account.accountTags?.length ? (
                  <p className="admin-detail-muted">Current: {account.accountTags.join(", ")}</p>
                ) : null}
              </div>
            </>
          )}
          <div className="admin-detail-section">
            <h3>Seats</h3>
            <dl className="admin-detail-dl admin-detail-counts">
              <dt>Owners</dt>
              <dd>{account.seats?.owner ?? 0}</dd>
              <dt>Managers</dt>
              <dd>{account.seats?.manager ?? 0}</dd>
              <dt>Technicians</dt>
              <dd>{account.seats?.technician ?? 0}</dd>
              <dt>Total</dt>
              <dd>{account.seats?.total ?? (account.seats ? (account.seats.owner ?? 0) + (account.seats.manager ?? 0) + (account.seats.technician ?? 0) : 0)}</dd>
            </dl>
          </div>
          <div className="admin-detail-section">
            <h3>Users</h3>
            <div className="admin-detail-users-toolbar">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="admin-select"
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="technician">Technician</option>
              </select>
              <select
                value={userActiveFilter}
                onChange={(e) => setUserActiveFilter(e.target.value)}
                className="admin-select"
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <input
                type="search"
                placeholder="Search name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setUserSearchApplied(userSearch)}
                className="admin-input"
                aria-label="Search users"
              />
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setUserSearchApplied(userSearch)}
              >
                Search
              </button>
            </div>
            {usersLoading ? (
              <p className="admin-detail-muted">Loading users…</p>
            ) : (
              <div className="admin-detail-table-wrap">
                <table className="admin-detail-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="admin-detail-muted">No users match.</td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.email}</td>
                          <td>{u.name}</td>
                          <td>{u.role}</td>
                          <td>{u.isActive ? "Active" : "Inactive"}</td>
                          <td>
                            {u.mustChangePassword && (
                              <span className="admin-badge admin-badge-warning" title="Must change password">Must change</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-detail-section">
            <h3>Counts</h3>
            <dl className="admin-detail-dl admin-detail-counts">
              <dt>Work orders</dt>
              <dd>{account.counts.workOrders}</dd>
              <dt>Completed work orders</dt>
              <dd>{account.counts.completedWorkOrders ?? 0}</dd>
              <dt>Invoices</dt>
              <dd>{account.counts.invoices}</dd>
              <dt>Customers</dt>
              <dd>{account.counts.customers}</dd>
              <dt>Users</dt>
              <dd>{account.counts.users}</dd>
            </dl>
          </div>

          <div className="admin-detail-section">
            <h3>Customer activity</h3>
            <p className="admin-detail-muted">Recent events from product usage (newest first).</p>
            {activityLoading && <p className="admin-detail-muted">Loading activity…</p>}
            {!activityLoading && (
              <ul className="admin-audit-list">
                {activityEvents.length === 0 && (
                  <li className="admin-audit-item">No customer activity recorded yet.</li>
                )}
                {activityEvents.map((ev) => {
                  const detail = formatEventDetailLine(ev);
                  return (
                    <li key={ev._id} className="admin-audit-item">
                      <time dateTime={ev.createdAt}>{new Date(ev.createdAt).toLocaleString()}</time>
                      {" · "}
                      <strong>{formatActivityEventType(ev.type)}</strong>
                      {ev.actorRole && ` · ${ev.actorRole}`}
                      {detail && (
                        <>
                          <br />
                          <span className="admin-detail-muted admin-detail-activity-meta">
                            {detail}
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="admin-detail-section">
            <h3>Recent audits</h3>
            <ul className="admin-audit-list">
              {audits.length === 0 && <li className="admin-audit-item">No audits yet.</li>}
              {audits.map((a) => (
                <li key={a._id} className="admin-audit-item">
                  <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString()}</time>
                  {" · "}
                  {a.action}
                  {a.actorEmail && ` · ${a.actorEmail}`}
                </li>
              ))}
            </ul>
          </div>

          {isSuperAdmin ? (
            <div className="admin-detail-actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setSheet("quarantine")}
              >
                Quarantine
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setSheet("throttle")}
              >
                Throttle
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={handleForceLogoutClick}
                disabled={actionLoading}
              >
                {actionLoading ? "…" : "Force Logout"}
              </button>
              {actionError && !sheet && <p className="admin-gate-error admin-detail-action-error">{actionError}</p>}
            </div>
          ) : (
            <p className="admin-detail-security-note">Security controls require superadmin.</p>
          )}
        </>
      )}

      {isSuperAdmin && sheet === "quarantine" && (
        <div className="admin-overlay" onClick={() => closeSheet()} role="presentation">
          <div className="admin-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="quarantine-title">
            <div className="admin-sheet-header" id="quarantine-title">Quarantine account</div>
            <form id="quarantine-form" className="admin-sheet-body" onSubmit={handleQuarantineSubmit}>
              <div className="admin-form-group">
                <label htmlFor="quarantine-minutes">Duration (minutes)</label>
                <input
                  id="quarantine-minutes"
                  type="number"
                  min={1}
                  max={10080}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="quarantine-note">Note (optional)</label>
                <textarea
                  id="quarantine-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              {actionError && <p className="admin-gate-error admin-detail-sheet-error">{actionError}</p>}
            </form>
            <div className="admin-sheet-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={closeSheet}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={handleQuarantineClear} disabled={actionLoading}>
                Clear quarantine
              </button>
              <button type="submit" form="quarantine-form" className="admin-btn admin-btn-primary" disabled={actionLoading}>
                {actionLoading ? "…" : "Set quarantine"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSuperAdmin && sheet === "throttle" && (
        <div className="admin-overlay" onClick={() => closeSheet()} role="presentation">
          <div className="admin-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="throttle-title">
            <div className="admin-sheet-header" id="throttle-title">Throttle account</div>
            <form className="admin-sheet-body" onSubmit={handleThrottleSubmit}>
              <div className="admin-form-group">
                <label htmlFor="throttle-minutes">Duration (minutes)</label>
                <input
                  id="throttle-minutes"
                  type="number"
                  min={1}
                  max={10080}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="throttle-note">Note (optional)</label>
                <textarea
                  id="throttle-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              {actionError && <p className="admin-gate-error admin-detail-sheet-error">{actionError}</p>}
            </form>
            <div className="admin-sheet-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={closeSheet}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={handleThrottleClear} disabled={actionLoading}>
                Clear throttle
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={actionLoading} onClick={(e) => { e.preventDefault(); handleThrottleSubmit(e); }}>
                {actionLoading ? "…" : "Set throttle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assistedEmailModal && account && (
        <div
          className="admin-overlay"
          onClick={() => setAssistedEmailModal(null)}
          role="presentation"
        >
          <div
            className="admin-sheet admin-assisted-sheet admin-assisted-email-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="assisted-email-title"
          >
            <div className="admin-sheet-header" id="assisted-email-title">
              {EMAIL_TEMPLATES[assistedEmailModal.flagId]?.actionLabel ?? "Email draft"}
            </div>
            <div className="admin-sheet-body">
              <p className="admin-detail-muted">
                Edit below, then copy into Mailchimp or your mail client. Nothing is sent from this app.
              </p>
              {!account.primaryOwner?.email?.trim() ? (
                <p className="admin-assisted-email-warning" role="status">
                  No primary owner email on file for this account — confirm the recipient when you send from Mailchimp or your mail client.
                </p>
              ) : (
                <p className="admin-detail-muted">
                  Intended recipient: <strong>{account.primaryOwner.email}</strong>
                </p>
              )}
              <div className="admin-form-group">
                <label htmlFor="assisted-email-subject">Subject</label>
                <input
                  id="assisted-email-subject"
                  className="admin-input"
                  value={assistedEmailModal.subject}
                  onChange={(e) =>
                    setAssistedEmailModal((m) => (m ? { ...m, subject: e.target.value } : m))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="assisted-email-body">Body</label>
                <textarea
                  id="assisted-email-body"
                  className="admin-input admin-detail-notes-textarea admin-assisted-email-body"
                  value={assistedEmailModal.body}
                  onChange={(e) =>
                    setAssistedEmailModal((m) => (m ? { ...m, body: e.target.value } : m))
                  }
                  rows={12}
                />
              </div>
            </div>
            <div className="admin-sheet-footer admin-assisted-email-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAssistedCopyDraft}>
                Copy to Clipboard
              </button>
              <a
                href={ADMIN_MAILCHIMP_EXTERNAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn-secondary"
              >
                Open Mailchimp
              </a>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={handleAssistedCopyAndOpenMailchimp}
              >
                Copy & Open Mailchimp
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setAssistedEmailModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
