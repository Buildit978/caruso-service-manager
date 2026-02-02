import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  getAdminRole,
  fetchAdminUsers,
  inviteAdminUser,
  resetAdminUserPassword,
  updateAdminUserRole,
  type AdminUserItem,
  type HttpError,
} from "../../api/admin";
import AdminLayout from "./AdminLayout";
import "./Admin.css";

type SheetKind = "invite" | "role" | null;

function formatCreated(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminUsersPage() {
  const role = getAdminRole();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "superadmin">("admin");

  // Change role
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [roleNewRole, setRoleNewRole] = useState<"admin" | "superadmin">("admin");

  const loadList = () => {
    setError(null);
    fetchAdminUsers()
      .then((res) => setItems(res.items))
      .catch((err) => setError((err as HttpError).message ?? "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (role !== "superadmin") return;
    setLoading(true);
    loadList();
  }, [role]);

  if (role !== "superadmin") {
    return <Navigate to="/admin/accounts" replace />;
  }

  const openInvite = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("admin");
    setActionError(null);
    setSuccess(null);
    setSheet("invite");
  };

  const openChangeRole = (user: AdminUserItem) => {
    setRoleUserId(user.id);
    setRoleNewRole(user.role);
    setActionError(null);
    setSheet("role");
  };

  const closeSheet = () => {
    setSheet(null);
    setActionError(null);
    setRoleUserId(null);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) {
      setActionError("Email is required");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    inviteAdminUser({ email, name: inviteName.trim() || undefined, role: inviteRole })
      .then(() => {
        setSuccess("Invite sent");
        closeSheet();
        loadList();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Invite failed"))
      .finally(() => setActionLoading(false));
  };

  const handleResetPassword = (user: AdminUserItem) => {
    setActionLoading(true);
    setActionError(null);
    resetAdminUserPassword(user.id)
      .then(() => {
        setSuccess(`Password reset email sent to ${user.email}`);
        loadList();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Reset failed"))
      .finally(() => setActionLoading(false));
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleUserId) return;
    setActionLoading(true);
    setActionError(null);
    updateAdminUserRole(roleUserId, { role: roleNewRole })
      .then(() => {
        setSuccess("Role updated");
        closeSheet();
        loadList();
      })
      .catch((err) => setActionError((err as HttpError).message ?? "Update failed"))
      .finally(() => setActionLoading(false));
  };

  return (
    <AdminLayout title="Admin users" showBack={false}>
      {success && (
        <p className="admin-gate-error" style={{ color: "var(--admin-primary, #2563eb)", marginBottom: "1rem" }}>
          {success}
        </p>
      )}
      {loading && <p>Loading…</p>}
      {error && <p className="admin-gate-error" style={{ marginBottom: "1rem" }}>{error}</p>}
      {actionError && !sheet && <p className="admin-gate-error" style={{ marginBottom: "1rem" }}>{actionError}</p>}
      {!loading && !error && (
        <>
          {/* Mobile: stacked cards */}
          <div className="admin-accounts-cards">
            {items.map((u) => (
              <div key={u.id} className="admin-account-card">
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Name</span>
                  <span className="admin-account-card-value">{u.name || "—"}</span>
                </div>
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Email</span>
                  <span className="admin-account-card-value">{u.email}</span>
                </div>
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Role</span>
                  <span className="admin-role-badge" style={{ margin: 0 }}>{u.role}</span>
                </div>
                <div className="admin-account-card-row">
                  <span className="admin-account-card-label">Created</span>
                  <span className="admin-account-card-value">{formatCreated(u.createdAt)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={() => handleResetPassword(u)}
                    disabled={actionLoading}
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={() => openChangeRole(u)}
                    disabled={actionLoading}
                  >
                    Change role
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* md+: table */}
          <table className="admin-accounts-table" aria-label="Admin users">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || "—"}</td>
                  <td>{u.email}</td>
                  <td><span className="admin-role-badge" style={{ margin: 0 }}>{u.role}</span></td>
                  <td>{formatCreated(u.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handleResetPassword(u)}
                      disabled={actionLoading}
                      style={{ marginRight: "0.5rem" }}
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => openChangeRole(u)}
                      disabled={actionLoading}
                    >
                      Change role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && <p>No admin users yet. Invite one below.</p>}

          {/* Sticky bottom: Invite admin */}
          <div className="admin-detail-actions">
            <button type="button" className="admin-btn admin-btn-primary" onClick={openInvite}>
              Invite admin
            </button>
          </div>
        </>
      )}

      {/* Invite sheet */}
      {sheet === "invite" && (
        <div className="admin-overlay" onClick={closeSheet} role="presentation">
          <div className="admin-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="invite-title">
            <div className="admin-sheet-header" id="invite-title">Invite admin</div>
            <form id="invite-form" className="admin-sheet-body" onSubmit={handleInviteSubmit}>
              <div className="admin-form-group">
                <label htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="invite-name">Name (optional)</label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Display name"
                  autoComplete="name"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="invite-role">Role</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "superadmin")}
                  className="admin-form-group input"
                  style={{ minHeight: 44, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--admin-border, #334155)", background: "var(--admin-bg, #0f172a)", color: "var(--admin-fg, #e2e8f0)", width: "100%", fontSize: "1rem" }}
                >
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </div>
              {actionError && <p className="admin-gate-error" style={{ margin: 0 }}>{actionError}</p>}
            </form>
            <div className="admin-sheet-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={closeSheet}>
                Cancel
              </button>
              <button type="submit" form="invite-form" className="admin-btn admin-btn-primary" disabled={actionLoading}>
                {actionLoading ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change role sheet */}
      {sheet === "role" && roleUserId && (
        <div className="admin-overlay" onClick={closeSheet} role="presentation">
          <div className="admin-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="role-title">
            <div className="admin-sheet-header" id="role-title">Change role</div>
            <form id="role-form" className="admin-sheet-body" onSubmit={handleRoleSubmit}>
              <div className="admin-form-group">
                <label htmlFor="role-select">Role</label>
                <select
                  id="role-select"
                  value={roleNewRole}
                  onChange={(e) => setRoleNewRole(e.target.value as "admin" | "superadmin")}
                  style={{ minHeight: 44, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--admin-border, #334155)", background: "var(--admin-bg, #0f172a)", color: "var(--admin-fg, #e2e8f0)", width: "100%", fontSize: "1rem" }}
                >
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </div>
              {actionError && <p className="admin-gate-error" style={{ margin: 0 }}>{actionError}</p>}
            </form>
            <div className="admin-sheet-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={closeSheet}>
                Cancel
              </button>
              <button type="submit" form="role-form" className="admin-btn admin-btn-primary" disabled={actionLoading}>
                {actionLoading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
