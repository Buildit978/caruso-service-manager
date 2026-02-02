import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  fetchAdminAccounts,
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

type SheetKind = "quarantine" | "throttle" | "force-logout-confirm" | null;

export default function AdminAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const location = useLocation();
  const accountFromState = (location.state as { account?: AdminAccountItem })?.account;

  const [account, setAccount] = useState<AdminAccountItem | null>(accountFromState ?? null);
  const [audits, setAudits] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(!accountFromState);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Minutes + note for quarantine/throttle
  const [minutes, setMinutes] = useState("60");
  const [note, setNote] = useState("");
  const isSuperAdmin = getAdminRole() === "superadmin";

  useEffect(() => {
    if (!accountId) return;
    if (accountFromState && accountFromState.accountId === accountId) {
      setAccount(accountFromState);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
      fetchAdminAccounts({ limit: 500 })
        .then((res) => {
          const a = res.items.find((i) => i.accountId === accountId);
          setAccount(a ?? null);
          if (!a) setError("Account not found");
        })
        .catch((err) => {
          setError((err as HttpError).message ?? "Failed to load account");
        })
        .finally(() => setLoading(false));
    }
  }, [accountId, accountFromState?.accountId]);

  useEffect(() => {
    if (!accountId) return;
    fetchAdminAudits(accountId, { limit: 50 })
      .then((res) => setAudits(res.items))
      .catch(() => setAudits([]));
  }, [accountId]);

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
        setAccount((prev) => prev ? { ...prev } : null);
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
        setAccount((prev) => prev ? { ...prev } : null);
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
        setAccount((prev) => prev ? { ...prev } : null);
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
        setAccount((prev) => prev ? { ...prev } : null);
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
      .finally(() => setActionLoading(false));
  }

  function handleForceLogoutConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setActionLoading(true);
    setActionError(null);
    postForceLogout(accountId, { note: note.trim() || undefined })
      .then(() => {
        closeSheet();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Failed"))
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
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {!loading && account && (
        <>
          <div className="admin-detail-section">
            <h3>Account</h3>
            <p style={{ margin: 0 }}>{account.shopName || "—"} · {account.isActive ? "Active" : "Inactive"}</p>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "var(--admin-muted, #94a3b8)" }}>
              ID: {accountId}
            </p>
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

          {/* Sticky bottom action bar (mobile); inline on md+ — superadmin only */}
          {isSuperAdmin && (
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
                onClick={() => setSheet("force-logout-confirm")}
              >
                Force Logout
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal / bottom sheet: Quarantine */}
      {sheet === "quarantine" && (
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
              {actionError && <p style={{ color: "#f87171", margin: 0, fontSize: "0.875rem" }}>{actionError}</p>}
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

      {/* Throttle sheet */}
      {sheet === "throttle" && (
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
              {actionError && <p style={{ color: "#f87171", margin: 0, fontSize: "0.875rem" }}>{actionError}</p>}
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

      {/* Force Logout confirm */}
      {sheet === "force-logout-confirm" && (
        <div className="admin-overlay" onClick={() => closeSheet()} role="presentation">
          <div className="admin-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="force-logout-title">
            <div className="admin-sheet-header" id="force-logout-title">Confirm Force Logout</div>
            <div className="admin-sheet-body">
              <p className="admin-confirm-text">
                Force logout will invalidate all sessions for this account. Users will need to sign in again. Continue?
              </p>
              <div className="admin-form-group">
                <label htmlFor="force-logout-note">Note (optional)</label>
                <textarea
                  id="force-logout-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
              {actionError && <p style={{ color: "#f87171", margin: 0, fontSize: "0.875rem" }}>{actionError}</p>}
            </div>
            <div className="admin-sheet-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={closeSheet}>
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={handleForceLogoutConfirm} disabled={actionLoading}>
                {actionLoading ? "…" : "Force Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
