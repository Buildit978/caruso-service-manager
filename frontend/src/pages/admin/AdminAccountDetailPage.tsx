import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  fetchAdminAccountById,
  fetchAdminAudits,
  fetchAdminAccountUsers,
  postQuarantine,
  deleteQuarantine,
  postThrottle,
  deleteThrottle,
  postForceLogout,
  patchBillingExempt,
  patchAccountTags,
  getAdminRole,
  type AdminAccountItem,
  type AdminAccountUser,
  type AdminAuditItem,
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

  function handleBillingExemptToggle() {
    if (!accountId || !account) return;
    const next = !account.billingExempt;
    if (!next && tagsIncludeExemptKind(account.accountTags)) {
      const ok = window.confirm(
        "This account has tags demo, sales, or internal. Turning off Billing Exempt may conflict with that. Continue anyway?"
      );
      if (!ok) return;
    }
    setBillingExemptSaving(true);
    setActionError(null);
    patchBillingExempt(accountId, {
      billingExempt: next,
      billingExemptReason: next ? (account.billingExemptReason ?? "demo") : undefined,
    })
      .then(() => {
        setSuccessMessage(next ? "Billing exempt enabled." : "Billing exempt disabled.");
        loadAccount();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
      .finally(() => setBillingExemptSaving(false));
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
              <dt>Created</dt>
              <dd>{formatDate(account.createdAt)}</dd>
              <dt>Last Active</dt>
              <dd>{formatDateTime(account.lastActiveAt)}</dd>
              <dt>ID</dt>
              <dd className="admin-detail-id">{accountId}</dd>
            </dl>
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
              <dt>Invoices</dt>
              <dd>{account.counts.invoices}</dd>
              <dt>Customers</dt>
              <dd>{account.counts.customers}</dd>
              <dt>Users</dt>
              <dd>{account.counts.users}</dd>
            </dl>
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
    </AdminLayout>
  );
}
