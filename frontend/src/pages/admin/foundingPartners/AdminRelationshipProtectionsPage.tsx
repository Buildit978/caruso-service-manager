import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createRelationshipProtection,
  fetchFoundingPartners,
  fetchFoundingProspects,
  fetchRelationshipProtections,
  type FoundingPartner,
  type FoundingProspect,
  type RelationshipProtection,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import FoundingPartnerShell from "./FoundingPartnerShell";
import { ProtectionStatusBadge } from "./foundingPartnerBadges";
import { FP_MODULE_TITLE, formatDate, fromDatetimeLocalValue, apiErrorMessage } from "./foundingPartnerFormat";

export default function AdminRelationshipProtectionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProspectId = searchParams.get("prospectId") ?? "";
  const initialPartnerId = searchParams.get("partnerId") ?? "";

  const [items, setItems] = useState<RelationshipProtection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<FoundingPartner[]>([]);
  const [prospects, setProspects] = useState<FoundingProspect[]>([]);
  const [form, setForm] = useState({
    partnerId: initialPartnerId,
    prospectId: initialProspectId,
    introducedAt: "",
    evidenceSummary: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRelationshipProtections({
        protectionStatus: status === "all" ? undefined : status,
        prospectId: initialProspectId || undefined,
        partnerId: initialPartnerId || undefined,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load protections"));
    } finally {
      setLoading(false);
    }
  }, [status, initialProspectId, initialPartnerId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showCreate) return;
    Promise.all([
      fetchFoundingPartners({ limit: 200 }),
      fetchFoundingProspects({ limit: 200 }),
    ])
      .then(([pRes, prRes]) => {
        setPartners(pRes.items);
        setProspects(prRes.items);
      })
      .catch(() => {
        setPartners([]);
        setProspects([]);
      });
  }, [showCreate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createRelationshipProtection({
        partnerId: form.partnerId,
        prospectId: form.prospectId,
        introducedAt: fromDatetimeLocalValue(form.introducedAt),
        evidenceSummary: form.evidenceSummary.trim(),
      });
      setShowCreate(false);
      navigate(`/admin/founding-partners/relationship-protections/${created.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create protection"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title={FP_MODULE_TITLE}>
      <FoundingPartnerShell variant="list">
        <div className="fp-page-header">
          <h2 className="fp-page-title">Relationship Protections</h2>
          <button type="button" className="fp-btn fp-btn-primary fp-no-print" onClick={() => setShowCreate(true)}>
            Record introduction
          </button>
        </div>

        <div className="fp-filters fp-no-print">
          <label className="fp-filter-label">
            Status
            <select className="fp-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="released">Released</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>

        {(initialProspectId || initialPartnerId) && (
          <p className="fp-muted fp-no-print">
            Filtered by {initialProspectId ? `prospect ${initialProspectId}` : ""}
            {initialProspectId && initialPartnerId ? " · " : ""}
            {initialPartnerId ? `partner ${initialPartnerId}` : ""}
          </p>
        )}

        {loading && <p className="fp-loading">Loading protections…</p>}
        {error && <p className="fp-error">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="fp-empty">No relationship protections match the current filters.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="fp-cards">
              {items.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="fp-list-card"
                  onClick={() => navigate(`/admin/founding-partners/relationship-protections/${r.id}`)}
                >
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Prospect</span>
                    <span className="fp-list-card-value">{r.prospectBusinessName ?? r.prospectId}</span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Partner</span>
                    <span className="fp-list-card-value">{r.partnerName ?? r.partnerId}</span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Status</span>
                    <span className="fp-list-card-value">
                      <ProtectionStatusBadge status={r.protectionStatus} />
                    </span>
                  </div>
                  <div className="fp-list-card-row">
                    <span className="fp-list-card-label">Introduced</span>
                    <span className="fp-list-card-value">{formatDate(r.introducedAt)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="fp-table-wrap">
              <table className="fp-table" aria-label="Relationship protections">
                <thead>
                  <tr>
                    <th>Prospect</th>
                    <th>Partner</th>
                    <th>Status</th>
                    <th>Introduced</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr
                      key={r.id}
                      className="fp-table-row-clickable"
                      onClick={() => navigate(`/admin/founding-partners/relationship-protections/${r.id}`)}
                    >
                      <td>{r.prospectBusinessName ?? r.prospectId}</td>
                      <td>{r.partnerName ?? r.partnerId}</td>
                      <td>
                        <ProtectionStatusBadge status={r.protectionStatus} />
                      </td>
                      <td>{formatDate(r.introducedAt)}</td>
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fp-paging">
              Showing {items.length} of {total} protection{total !== 1 ? "s" : ""}
            </p>
          </>
        )}

        {showCreate && (
          <div className="admin-overlay fp-overlay fp-no-print" role="dialog" aria-modal="true">
            <div className="admin-sheet">
              <h3 className="fp-section-title">Record introduction</h3>
              <form className="fp-form-grid" onSubmit={handleCreate}>
                <label className="fp-form-label">
                  Partner *
                  <select
                    className="fp-form-select"
                    value={form.partnerId}
                    onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
                    required
                  >
                    <option value="">Select partner</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fp-form-label">
                  Prospect *
                  <select
                    className="fp-form-select"
                    value={form.prospectId}
                    onChange={(e) => setForm({ ...form, prospectId: e.target.value })}
                    required
                  >
                    <option value="">Select prospect</option>
                    {prospects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.businessName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fp-form-label">
                  Introduced date (optional)
                  <input
                    type="datetime-local"
                    className="fp-form-input"
                    value={form.introducedAt}
                    onChange={(e) => setForm({ ...form, introducedAt: e.target.value })}
                  />
                </label>
                <label className="fp-form-label">
                  Evidence summary *
                  <textarea
                    className="fp-form-textarea"
                    value={form.evidenceSummary}
                    onChange={(e) => setForm({ ...form, evidenceSummary: e.target.value })}
                    required
                  />
                </label>
                <div className="fp-form-actions">
                  <button type="submit" className="fp-btn fp-btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Create protection record"}
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
