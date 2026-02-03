import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  fetchAdminAccountById,
  fetchAdminAudits,
  postQuarantine,
  deleteQuarantine,
  postThrottle,
  deleteThrottle,
  postForceLogout,
  getAdminRole,
  type AdminAccountItem,
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
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

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
              <dt>Created</dt>
              <dd>{formatDate(account.createdAt)}</dd>
              <dt>Last Active</dt>
              <dd>{formatDateTime(account.lastActiveAt)}</dd>
              <dt>ID</dt>
              <dd className="admin-detail-id">{accountId}</dd>
            </dl>
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
