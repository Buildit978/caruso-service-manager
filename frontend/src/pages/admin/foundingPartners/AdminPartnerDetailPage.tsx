import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchFoundingPartnerById,
  fetchRelationshipProtections,
  updateFoundingPartner,
  type FoundingPartnerDetail,
  type FoundingPartnerStatus,
  type RelationshipProtection,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import CommunicationNotesSection from "./CommunicationNotesSection";
import FoundingPartnerShell from "./FoundingPartnerShell";
import {
  PartnerStatusBadge,
  PARTNER_STATUS_OPTIONS,
  LifecycleStatusBadge,
  HealthStatusBadge,
} from "./foundingPartnerBadges";
import { FP_MODULE_TITLE, formatDateTime, apiErrorMessage } from "./foundingPartnerFormat";

export default function AdminPartnerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [partner, setPartner] = useState<FoundingPartnerDetail | null>(null);
  const [stewardedBusinesses, setStewardedBusinesses] = useState<RelationshipProtection[]>([]);
  const [stewardedLoading, setStewardedLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
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
    if (!id) return;
    setLoading(true);
    setStewardedLoading(true);
    setError(null);
    try {
      const [data, stewarded] = await Promise.all([
        fetchFoundingPartnerById(id),
        fetchRelationshipProtections({
          partnerId: id,
          protectionStatus: "approved",
          limit: 100,
        }),
      ]);
      setPartner(data);
      setStewardedBusinesses(stewarded.items);
      setForm({
        name: data.name,
        email: data.email,
        phone: data.phone ?? "",
        region: data.region ?? "",
        status: data.status,
        notes: data.notes ?? "",
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load partner"));
    } finally {
      setLoading(false);
      setStewardedLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await updateFoundingPartner(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        region: form.region.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
      setShowEdit(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update partner"));
    } finally {
      setSaving(false);
    }
  }

  const printedAt = new Date().toLocaleString();

  return (
    <AdminLayout title={FP_MODULE_TITLE} showBack>
      <FoundingPartnerShell variant="list">
        {loading && <p className="fp-loading">Loading partner…</p>}
        {error && <p className="fp-error">{error}</p>}

        {partner && (
          <>
            <div className="fp-print-header">
              {FP_MODULE_TITLE} — Partner: {partner.name}
              <br />
              Printed {printedAt}
            </div>

            <div className="fp-page-header fp-no-print">
              <h2 className="fp-page-title">{partner.name}</h2>
              <div className="fp-detail-actions">
                <button type="button" className="fp-btn fp-btn-secondary" onClick={() => window.print()}>
                  Print
                </button>
                <button type="button" className="fp-btn fp-btn-secondary" onClick={() => setShowEdit(true)}>
                  Edit
                </button>
              </div>
            </div>

            <section className="fp-card fp-print-root">
              <h2 className="fp-section-title">Partner details</h2>
              <dl className="fp-detail-dl">
                <dt>Name</dt>
                <dd>{partner.name}</dd>
                <dt>Email</dt>
                <dd>{partner.email}</dd>
                <dt>Phone</dt>
                <dd>{partner.phone || "—"}</dd>
                <dt>Region</dt>
                <dd>{partner.region || "—"}</dd>
                <dt>Status</dt>
                <dd>
                  <PartnerStatusBadge status={partner.status} />
                </dd>
                <dt>Notes</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{partner.notes || "—"}</dd>
                <dt>Created</dt>
                <dd>{formatDateTime(partner.createdAt)}</dd>
                <dt>Updated</dt>
                <dd>{formatDateTime(partner.updatedAt)}</dd>
                {partner.counts && (
                  <>
                    <dt>Introductions</dt>
                    <dd>{partner.counts.relationshipProtections}</dd>
                    <dt>Relationship history entries</dt>
                    <dd>{partner.counts.communicationNotes}</dd>
                  </>
                )}
              </dl>
            </section>

            <section className="fp-card">
              <h2 className="fp-section-title">Businesses stewarded</h2>
              {stewardedLoading && <p className="fp-loading">Loading businesses…</p>}
              {!stewardedLoading && stewardedBusinesses.length === 0 && (
                <p className="fp-empty">No approved introductions for this partner yet.</p>
              )}
              {!stewardedLoading && stewardedBusinesses.length > 0 && (
                <>
                  <div className="fp-cards">
                    {stewardedBusinesses.map((row) => (
                      <button
                        type="button"
                        key={row.id}
                        className="fp-list-card"
                        onClick={() =>
                          navigate(`/admin/founding-partners/prospects/${row.prospectId}`)
                        }
                      >
                        <div className="fp-list-card-row">
                          <span className="fp-list-card-label">Business</span>
                          <span className="fp-list-card-value">
                            {row.prospectBusinessName ?? row.prospectId}
                          </span>
                        </div>
                        <div className="fp-list-card-row">
                          <span className="fp-list-card-label">Lifecycle</span>
                          <span className="fp-list-card-value">
                            <LifecycleStatusBadge status={row.lifecycleStatus} />
                          </span>
                        </div>
                        {row.healthStatus != null && (
                          <div className="fp-list-card-row">
                            <span className="fp-list-card-label">Health</span>
                            <span className="fp-list-card-value">
                              <HealthStatusBadge status={row.healthStatus} />
                              {row.daysSinceLastActivity != null && (
                                <span className="fp-health-days"> {row.daysSinceLastActivity} d</span>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="fp-list-card-row">
                          <span className="fp-list-card-label">Last activity</span>
                          <span className="fp-list-card-value">
                            {row.lastActivityAt
                              ? formatDateTime(row.lastActivityAt)
                              : "No activity recorded"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="fp-table-wrap">
                    <table className="fp-table" aria-label="Businesses stewarded">
                      <thead>
                        <tr>
                          <th>Business</th>
                          <th>Lifecycle</th>
                          <th>Health</th>
                          <th>Last activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stewardedBusinesses.map((row) => (
                          <tr key={row.id} className="fp-table-row-clickable">
                            <td>
                              <Link
                                className="fp-link"
                                to={`/admin/founding-partners/prospects/${row.prospectId}`}
                              >
                                {row.prospectBusinessName ?? row.prospectId}
                              </Link>
                            </td>
                            <td>
                              <LifecycleStatusBadge status={row.lifecycleStatus} />
                            </td>
                            <td>
                              {row.healthStatus != null ? (
                                <>
                                  <HealthStatusBadge status={row.healthStatus} />
                                  {row.daysSinceLastActivity != null && (
                                    <span className="fp-health-days"> {row.daysSinceLastActivity} d</span>
                                  )}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {row.lastActivityAt ? formatDateTime(row.lastActivityAt) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <CommunicationNotesSection partnerId={partner.id} />

            {showEdit && (
              <div className="admin-overlay fp-overlay fp-no-print" role="dialog" aria-modal="true">
                <div className="admin-sheet">
                  <h3 className="fp-section-title">Edit partner</h3>
                  <form className="fp-form-grid" onSubmit={handleSave}>
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
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="fp-btn fp-btn-secondary"
                        onClick={() => setShowEdit(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </FoundingPartnerShell>
    </AdminLayout>
  );
}
