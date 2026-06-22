import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createFoundingPartner,
  fetchFoundingPartners,
  type FoundingPartner,
  type FoundingPartnerStatus,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { PartnerStatusBadge, PARTNER_STATUS_OPTIONS } from "./foundingPartnerBadges";
import { FP_MODULE_TITLE, formatDate, apiErrorMessage } from "./foundingPartnerFormat";

export default function AdminPartnersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FoundingPartner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    region: "",
    status: "active" as FoundingPartnerStatus,
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFoundingPartners({
        q: search || undefined,
        status: status === "all" ? undefined : status,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load partners"));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createFoundingPartner({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        region: form.region.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
      setShowCreate(false);
      navigate(`/admin/founding-partners/partners/${created.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create partner"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title={FP_MODULE_TITLE}>
      <FoundingPartnerShell variant="list">
        <div className="fp-page-header">
          <h2 className="fp-page-title">Partners</h2>
          <button type="button" className="fp-btn fp-btn-primary fp-no-print" onClick={() => setShowCreate(true)}>
            Add partner
          </button>
        </div>

        <div className="fp-filters fp-no-print">
          <label className="fp-filter-label">
            Search
            <input
              className="fp-filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, region"
            />
          </label>
          <label className="fp-filter-label">
            Status
            <select className="fp-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              {PARTNER_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p className="fp-loading">Loading partners…</p>}
        {error && <p className="fp-error">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="fp-empty">No partners match the current filters.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="fp-cards">
              {items.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="fp-list-card"
                  onClick={() => navigate(`/admin/founding-partners/partners/${p.id}`)}
                >
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Name</span>
                    <span className="fp-list-card-value">{p.name}</span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Email</span>
                    <span className="fp-list-card-value">{p.email}</span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Status</span>
                    <span className="fp-list-card-value">
                      <PartnerStatusBadge status={p.status} />
                    </span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Region</span>
                    <span className="fp-list-card-value">{p.region || "—"}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="fp-table-wrap">
              <table className="fp-table" aria-label="Partners">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr
                      key={p.id}
                      className="fp-table-row-clickable"
                      onClick={() => navigate(`/admin/founding-partners/partners/${p.id}`)}
                    >
                      <td>{p.name}</td>
                      <td>{p.email}</td>
                      <td>{p.region || "—"}</td>
                      <td>
                        <PartnerStatusBadge status={p.status} />
                      </td>
                      <td>{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fp-paging">
              Showing {items.length} of {total} partner{total !== 1 ? "s" : ""}
            </p>
          </>
        )}

        {showCreate && (
          <div className="admin-overlay fp-overlay fp-no-print" role="dialog" aria-modal="true">
            <div className="admin-sheet">
              <h3 className="fp-section-title">Add partner</h3>
              <form className="fp-form-grid" onSubmit={handleCreate}>
                <label className="fp-form-label">
                  Name *
                  <input
                    className="fp-form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>
                <label className="fp-form-label">
                  Email *
                  <input
                    type="email"
                    className="fp-form-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>
                <label className="fp-form-label">
                  Phone
                  <input
                    className="fp-form-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
                <label className="fp-form-label">
                  Region
                  <input
                    className="fp-form-input"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                  />
                </label>
                <label className="fp-form-label">
                  Status
                  <select
                    className="fp-form-select"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as FoundingPartnerStatus })
                    }
                  >
                    {PARTNER_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fp-form-label">
                  Notes
                  <textarea
                    className="fp-form-textarea"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
                <div className="fp-form-actions">
                  <button type="submit" className="fp-btn fp-btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Create partner"}
                  </button>
                  <button
                    type="button"
                    className="fp-btn fp-btn-secondary"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </FoundingPartnerShell>
    </AdminLayout>
  );
}
