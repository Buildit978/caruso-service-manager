import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createFoundingProspect,
  fetchFoundingProspects,
  fetchProspectDuplicates,
  type FoundingProspect,
  type FoundingProspectStatus,
  type DuplicateProspectMatch,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import DuplicateProspectBanner from "./DuplicateProspectBanner";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { ProspectStatusBadge, PROSPECT_STATUS_OPTIONS } from "./foundingPartnerBadges";
import {
  FP_MODULE_TITLE,
  formatDate,
  formatWebsiteHref,
  formatWebsiteLabel,
  apiErrorMessage,
} from "./foundingPartnerFormat";

export default function AdminProspectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FoundingProspect[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateProspectMatch[]>([]);
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    location: "",
    status: "new" as FoundingProspectStatus,
    closedReason: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFoundingProspects({
        q: search || undefined,
        status: status === "all" ? undefined : status,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load prospects"));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showCreate) {
      setDuplicates([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      if (!form.businessName && !form.email && !form.phone && !form.website) {
        setDuplicates([]);
        return;
      }
      try {
        const res = await fetchProspectDuplicates({
          businessName: form.businessName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          website: form.website || undefined,
        });
        setDuplicates(res.matches);
      } catch {
        setDuplicates([]);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [showCreate, form.businessName, form.email, form.phone, form.website]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createFoundingProspect({
        businessName: form.businessName.trim(),
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        location: form.location.trim() || undefined,
        status: form.status,
        closedReason: form.closedReason.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setShowCreate(false);
      navigate(`/admin/founding-partners/prospects/${created.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create prospect"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title={FP_MODULE_TITLE}>
      <FoundingPartnerShell variant="list">
        <div className="fp-page-header">
          <h2 className="fp-page-title">Prospects</h2>
          <button type="button" className="fp-btn fp-btn-primary fp-no-print" onClick={() => setShowCreate(true)}>
            Add prospect
          </button>
        </div>

        <div className="fp-filters fp-no-print">
          <label className="fp-filter-label">
            Search
            <input
              className="fp-filter-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Business, contact, website…"
            />
          </label>
          <label className="fp-filter-label">
            Status
            <select className="fp-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              {PROSPECT_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && <p className="fp-loading">Loading prospects…</p>}
        {error && <p className="fp-error">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="fp-empty">No prospects match the current filters.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="fp-cards">
              {items.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className="fp-list-card"
                  onClick={() => navigate(`/admin/founding-partners/prospects/${p.id}`)}
                >
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Business</span>
                    <span className="fp-list-card-value">{p.businessName}</span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Protected by</span>
                    <span className="fp-list-card-value">{p.protectedBy || "—"}</span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Status</span>
                    <span className="fp-list-card-value">
                      <ProspectStatusBadge status={p.status} />
                    </span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Website</span>
                    <span className="fp-list-card-value">{formatWebsiteLabel(p.website)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="fp-table-wrap">
              <table className="fp-table" aria-label="Prospects">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Protected By</th>
                    <th>Status</th>
                    <th>Contact</th>
                    <th>Website</th>
                    <th>Location</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr
                      key={p.id}
                      className="fp-table-row-clickable"
                      onClick={() => navigate(`/admin/founding-partners/prospects/${p.id}`)}
                    >
                      <td>{p.businessName}</td>
                      <td>{p.protectedBy || "—"}</td>
                      <td>
                        <ProspectStatusBadge status={p.status} />
                      </td>
                      <td>{p.contactName || p.email || "—"}</td>
                      <td>
                        {p.website ? (
                          <a
                            className="fp-link"
                            href={formatWebsiteHref(p.website) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatWebsiteLabel(p.website)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{p.location || "—"}</td>
                      <td>{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fp-paging">
              Showing {items.length} of {total} prospect{total !== 1 ? "s" : ""}
            </p>
          </>
        )}

        {showCreate && (
          <div className="admin-overlay fp-overlay fp-no-print" role="dialog" aria-modal="true">
            <div className="admin-sheet">
              <h3 className="fp-section-title">Add prospect</h3>
              <DuplicateProspectBanner matches={duplicates} />
              <form className="fp-form-grid" onSubmit={handleCreate}>
                <label className="fp-form-label">
                  Business name *
                  <input
                    className="fp-form-input"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    required
                  />
                </label>
                <label className="fp-form-label">
                  Contact name
                  <input
                    className="fp-form-input"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </label>
                <label className="fp-form-label">
                  Email
                  <input
                    type="email"
                    className="fp-form-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                  Website
                  <input
                    className="fp-form-input"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="example.com"
                  />
                </label>
                <label className="fp-form-label">
                  Location
                  <input
                    className="fp-form-input"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </label>
                <label className="fp-form-label">
                  Status
                  <select
                    className="fp-form-select"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as FoundingProspectStatus })
                    }
                  >
                    {PROSPECT_STATUS_OPTIONS.map((s) => (
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
                    {saving ? "Saving…" : "Create prospect"}
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
