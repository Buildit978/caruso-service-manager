import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchFoundingProspectById,
  fetchProspectDuplicates,
  updateFoundingProspect,
  type FoundingProspectDetail,
  type FoundingProspectStatus,
  type DuplicateProspectMatch,
} from "../../../api/adminFoundingPartners";
import AdminLayout from "../AdminLayout";
import CommunicationNotesSection from "./CommunicationNotesSection";
import DuplicateProspectBanner from "./DuplicateProspectBanner";
import FoundingPartnerShell from "./FoundingPartnerShell";
import PendingIntroductionsSection from "./PendingIntroductionsSection";
import RelationshipOwnershipSection from "./RelationshipOwnershipSection";
import { ProspectStatusBadge, PROSPECT_STATUS_OPTIONS } from "./foundingPartnerBadges";
import {
  FP_MODULE_TITLE,
  formatDateTime,
  formatWebsiteHref,
  formatWebsiteLabel,
  apiErrorMessage,
} from "./foundingPartnerFormat";

export default function AdminProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [prospect, setProspect] = useState<FoundingProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
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
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFoundingProspectById(id);
      setProspect(data);
      setForm({
        businessName: data.businessName,
        contactName: data.contactName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        website: data.website ?? "",
        location: data.location ?? "",
        status: data.status,
        closedReason: data.closedReason ?? "",
        notes: data.notes ?? "",
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load prospect"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showEdit || !id) {
      setDuplicates([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetchProspectDuplicates({
          businessName: form.businessName || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          website: form.website || undefined,
          excludeId: id,
        });
        setDuplicates(res.matches);
      } catch {
        setDuplicates([]);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [showEdit, id, form.businessName, form.email, form.phone, form.website]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await updateFoundingProspect(id, {
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
      setShowEdit(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update prospect"));
    } finally {
      setSaving(false);
    }
  }

  const printedAt = new Date().toLocaleString();
  const websiteHref = formatWebsiteHref(prospect?.website);

  return (
    <AdminLayout title={FP_MODULE_TITLE} showBack>
      <FoundingPartnerShell variant="list">
        {loading && <p className="fp-loading">Loading prospect…</p>}
        {error && <p className="fp-error">{error}</p>}

        {prospect && (
          <>
            <div className="fp-print-header">
              {FP_MODULE_TITLE} — Prospect: {prospect.businessName}
              <br />
              Printed {printedAt}
            </div>

            <div className="fp-page-header fp-no-print">
              <h2 className="fp-page-title">{prospect.businessName}</h2>
              <div className="fp-detail-actions">
                <button type="button" className="fp-btn fp-btn-secondary" onClick={() => window.print()}>
                  Print
                </button>
                <button type="button" className="fp-btn fp-btn-secondary" onClick={() => setShowEdit(true)}>
                  Edit
                </button>
                <Link
                  className="fp-btn fp-btn-secondary"
                  to={`/admin/founding-partners/relationship-protections?prospectId=${prospect.id}`}
                >
                  Protections
                </Link>
              </div>
            </div>

            <section className="fp-card fp-print-root">
              <h2 className="fp-section-title">Prospect details</h2>
              <dl className="fp-detail-dl">
                <dt>Business name</dt>
                <dd>{prospect.businessName}</dd>
                <dt>Contact</dt>
                <dd>{prospect.contactName || "—"}</dd>
                <dt>Email</dt>
                <dd>{prospect.email || "—"}</dd>
                <dt>Phone</dt>
                <dd>{prospect.phone || "—"}</dd>
                <dt>Website</dt>
                <dd>
                  {websiteHref ? (
                    <a className="fp-link" href={websiteHref} target="_blank" rel="noopener noreferrer">
                      {formatWebsiteLabel(prospect.website)}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Location</dt>
                <dd>{prospect.location || "—"}</dd>
                <dt>Status</dt>
                <dd>
                  <ProspectStatusBadge status={prospect.status} />
                </dd>
                <dt>Closed reason</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{prospect.closedReason || "—"}</dd>
                <dt>Notes</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{prospect.notes || "—"}</dd>
                <dt>Created</dt>
                <dd>{formatDateTime(prospect.createdAt)}</dd>
                <dt>Updated</dt>
                <dd>{formatDateTime(prospect.updatedAt)}</dd>
              </dl>
            </section>

            <RelationshipOwnershipSection ownership={prospect.relationshipOwnership} />
            <PendingIntroductionsSection items={prospect.pendingIntroductions ?? []} />

            <CommunicationNotesSection
              prospectId={prospect.id}
              onNoteAdded={() => load()}
            />

            {showEdit && (
              <div className="admin-overlay fp-overlay fp-no-print" role="dialog" aria-modal="true">
                <div className="admin-sheet">
                  <h3 className="fp-section-title">Edit prospect</h3>
                  <DuplicateProspectBanner matches={duplicates} />
                  <form className="fp-form-grid" onSubmit={handleSave}>
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
                      Closed reason
                      <textarea
                        className="fp-form-textarea"
                        value={form.closedReason}
                        onChange={(e) => setForm({ ...form, closedReason: e.target.value })}
                      />
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
