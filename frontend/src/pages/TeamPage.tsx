import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../auth/useMe";
import {
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
  reactivateUser,
  type User,
} from "../api/users";
import type { HttpError } from "../api/http";
import TempPasswordModal from "../components/modals/TempPasswordModal";

function formatName(u: User) {
  const first = (u.firstName ?? "").trim();
  const last = (u.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || u.name || u.email;
}

export default function TeamPage() {
  const navigate = useNavigate();
  const { me, loading: meLoading } = useMe();

  const isOwner = me?.role === "owner";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamView, setTeamView] = useState<"active" | "inactive" | "all">("active");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "technician" as "manager" | "technician",
  });
  const [saving, setSaving] = useState(false);

  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [shopCode, setShopCode] = useState<string | null>(null);
  const [modalEmailSent, setModalEmailSent] = useState<boolean>(true);
  const [modalExpiresAt, setModalExpiresAt] = useState<string | null>(null);

  const activeCounts = useMemo(() => {
    const counts = { manager: 0, technician: 0 };
    for (const u of users) {
      if (!u.isActive) continue;
      if (u.role === "manager") counts.manager += 1;
      if (u.role === "technician") counts.technician += 1;
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (teamView === "active") {
      return users.filter((u) => u.isActive);
    } else if (teamView === "inactive") {
      return users.filter((u) => !u.isActive);
    }
    return users;
  }, [users, teamView]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const resp = await listUsers();
        if (cancelled) return;
        setUsers(resp.users || []);
      } catch (err) {
        const e = err as HttpError;
        if (e?.status === 403) {
          setError("Access restricted. Only owners can manage the team.");
        } else {
          setError(e?.message || "Failed to load team.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (isOwner) {
      load();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  if (meLoading) {
    return <div style={{ padding: "1rem" }}>Loading…</div>;
  }

  if (!me) {
    // Let existing auth flow handle redirect; keep it simple here.
    return <div style={{ padding: "1rem" }}>Not signed in.</div>;
  }

  if (!isOwner) {
    return (
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Team</h1>
        <div
          style={{
            marginTop: "1rem",
            padding: "1.5rem",
            border: "1px solid #1f2937",
            borderRadius: "0.75rem",
            background: "#020617",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#e5e7eb" }}>Access Restricted</h2>
          <p style={{ color: "#9ca3af", lineHeight: 1.6 }}>
            Only owners can manage team members.
          </p>
          <button type="button" onClick={() => navigate("/")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setTempPassword(null);
    setShopCode(null);

    try {
      const resp = await createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
      });

      setTempPassword(resp.tempPassword || null);
      setShopCode(resp.shopCode || null);
      setModalEmailSent(resp.emailSent);
      setModalExpiresAt(null);

      const refreshed = await listUsers();
      setUsers(refreshed.users || []);

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "technician",
      });
    } catch (err) {
      const e = err as HttpError;
      setError((e?.data as any)?.message || e?.message || "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(u: User) {
    if (!u?.id) return;
    if (!window.confirm(`Deactivate ${formatName(u)}?`)) return;

    try {
      await deactivateUser(u.id);
      const refreshed = await listUsers();
      setUsers(refreshed.users || []);
      // Keep current filter selected
    } catch (err) {
      const e = err as HttpError;
      setError((e?.data as any)?.message || e?.message || "Failed to deactivate user.");
    }
  }

  async function handleResetPassword(u: User) {
    if (!u?.id) return;
    if (!window.confirm(`Reset password for ${formatName(u)}?`)) return;

    try {
      const resp = await resetUserPassword(u.id);
      setTempPassword(resp.tempPassword ?? null);
      setShopCode(resp.shopCode ?? null);
      setModalEmailSent(resp.emailSent);
      setModalExpiresAt(resp.expiresAt ?? null);
    } catch (err) {
      const e = err as HttpError;
      setError((e?.data as any)?.message || e?.message || "Failed to reset password.");
    }
  }

  async function handleReactivate(u: User) {
    if (!u?.id) return;
    if (!window.confirm(`Reactivate ${formatName(u)}?`)) return;

    try {
      const resp = await reactivateUser(u.id);
      setTempPassword(resp.tempPassword || null);
      setShopCode(resp.shopCode || null);
      setModalEmailSent(resp.emailSent);
      setModalExpiresAt(null);

      // Refresh list to show updated status
      const refreshed = await listUsers();
      setUsers(refreshed.users || []);
      // Keep current filter selected
    } catch (err) {
      const e = err as HttpError;
      setError((e?.data as any)?.message || e?.message || "Failed to reactivate user.");
    }
  }

  return (
    <div className="page team-page" style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
        <h1 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Team</h1>
        <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
          Active: {activeCounts.manager} manager • {activeCounts.technician} technicians
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: "0.75rem", color: "#fca5a5" }}>{error}</div>
      ) : null}

      <TempPasswordModal
        open={!!tempPassword}
        tempPassword={tempPassword}
        shopCode={shopCode}
        emailSent={modalEmailSent}
        expiresAt={modalExpiresAt}
        onClose={() => {
          setTempPassword(null);
          setShopCode(null);
          setModalEmailSent(true);
          setModalExpiresAt(null);
        }}
      />
      <div className="stack team-stack">
        {/* Left: create */}
        <div
          style={{
            border: "1px solid #1f2937",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "#020617",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#e5e7eb" }}>Add Team Member</h2>

          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>First name</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Last name</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Email</span>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                type="email"
                required
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Phone (optional)</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as any }))}
              >
                <option value="technician">Technician</option>
                <option value="manager">Manager</option>
              </select>
            </label>

            <button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create User"}
            </button>
          </form>
        </div>

        {/* Right: list */}
        <div
          className="team-list"
          style={{
            border: "1px solid #1f2937",
            borderRadius: "0.75rem",
            padding: "1rem",
            background: "#020617",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
            <h2 style={{ marginTop: 0, marginBottom: 0, color: "#e5e7eb" }}>Team Members</h2>
            <button type="button" onClick={async () => {
              try {
                setLoading(true);
                const refreshed = await listUsers();
                setUsers(refreshed.users || []);
              } catch (err) {
                const e = err as HttpError;
                setError((e?.data as any)?.message || e?.message || "Failed to refresh.");
              } finally {
                setLoading(false);
              }
            }}>
              Refresh
            </button>
          </div>

          {/* Filter toggle */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => setTeamView("active")}
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid #374151",
                background: teamView === "active" ? "#3b82f6" : "#111827",
                color: teamView === "active" ? "#ffffff" : "#e5e7eb",
                cursor: "pointer",
                fontWeight: teamView === "active" ? 600 : 400,
              }}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setTeamView("inactive")}
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid #374151",
                background: teamView === "inactive" ? "#3b82f6" : "#111827",
                color: teamView === "inactive" ? "#ffffff" : "#e5e7eb",
                cursor: "pointer",
                fontWeight: teamView === "inactive" ? 600 : 400,
              }}
            >
              Inactive
            </button>
            <button
              type="button"
              onClick={() => setTeamView("all")}
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid #374151",
                background: teamView === "all" ? "#3b82f6" : "#111827",
                color: teamView === "all" ? "#ffffff" : "#e5e7eb",
                cursor: "pointer",
                fontWeight: teamView === "all" ? 600 : 400,
              }}
            >
              All
            </button>
          </div>

          {loading ? (
            <div style={{ color: "#9ca3af" }}>Loading…</div>
          ) : (
            <div className="table-scroll team-reset-scroll" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(filteredUsers || []).map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #1f2937",
                    background: "#111827",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1f2937";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#111827";
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr 1fr auto",
                      gap: "1rem",
                      alignItems: "center",
                    }}
                  >
                    {/* Name column */}
                    <div>
                      <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: "1rem" }}>
                        {formatName(u)}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                        Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </div>

                    {/* Role column */}
                    <div style={{ color: "#e5e7eb", fontSize: "0.9rem" }}>
                      {u.role}
                    </div>

                    {/* Email column */}
                    <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                      {u.email}
                    </div>

                    {/* Phone column */}
                    <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
                      {u.phone || "—"}
                    </div>

                    {/* Status column */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          fontWeight: 600,
                          background: u.isActive ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)",
                          color: u.isActive ? "#22c55e" : "#9ca3af",
                        }}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Actions column */}
                    <div style={{ display: "inline-flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      {u.isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            disabled={u.role === "owner"}
                            style={{
                              padding: "0.4rem 0.75rem",
                              fontSize: "0.85rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #374151",
                              background: u.role === "owner" ? "#1f2937" : "#111827",
                              color: u.role === "owner" ? "#6b7280" : "#e5e7eb",
                              cursor: u.role === "owner" ? "not-allowed" : "pointer",
                            }}
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u)}
                            disabled={u.role === "owner"}
                            style={{
                              padding: "0.4rem 0.75rem",
                              fontSize: "0.85rem",
                              borderRadius: "0.375rem",
                              border: "1px solid #374151",
                              background: u.role === "owner" ? "#1f2937" : "#111827",
                              color: u.role === "owner" ? "#6b7280" : "#e5e7eb",
                              cursor: u.role === "owner" ? "not-allowed" : "pointer",
                            }}
                          >
                            Deactivate
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(u)}
                          disabled={u.role === "owner"}
                          style={{
                            padding: "0.4rem 0.75rem",
                            fontSize: "0.85rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #374151",
                            background: u.role === "owner" ? "#1f2937" : "#111827",
                            color: u.role === "owner" ? "#6b7280" : "#e5e7eb",
                            cursor: u.role === "owner" ? "not-allowed" : "pointer",
                          }}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!filteredUsers || filteredUsers.length === 0) ? (
                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #1f2937",
                    background: "#111827",
                    color: "#9ca3af",
                    textAlign: "center",
                  }}
                >
                  {teamView === "active" && "No active team members."}
                  {teamView === "inactive" && "No inactive team members."}
                  {teamView === "all" && "No team members yet."}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

