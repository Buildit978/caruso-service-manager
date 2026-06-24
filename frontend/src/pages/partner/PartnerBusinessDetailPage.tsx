import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createPartnerBusinessNote,
  fetchPartnerBusinessById,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  PARTNER_NOTE_TYPE_OPTIONS,
  type PartnerBusinessDetail,
  type PartnerNoteType,
} from "../../api/partner";
import {
  formatDate,
  formatDateTime,
  formatWebsiteHref,
  formatWebsiteLabel,
} from "../admin/foundingPartners/foundingPartnerFormat";
import {
  HealthStatusBadge,
  LifecycleStatusBadge,
  NoteTypeBadge,
  getProspectStatusLabel,
} from "../admin/foundingPartners/foundingPartnerBadges";

export default function PartnerBusinessDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PartnerBusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [noteType, setNoteType] = useState<PartnerNoteType>("call");
  const [summary, setSummary] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPartnerBusinessById(id);
      setDetail(res);
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setError(partnerApiErrorMessage(err, "Business not found"));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmitNote(e: FormEvent) {
    e.preventDefault();
    if (!id || !summary.trim()) return;
    setSaving(true);
    setNoteError(null);
    try {
      await createPartnerBusinessNote(id, {
        type: noteType,
        summary: summary.trim(),
        followUpDate: followUpDate || undefined,
      });
      setSummary("");
      setFollowUpDate("");
      setShowForm(false);
      await load();
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setNoteError(partnerApiErrorMessage(err, "Failed to add note"));
    } finally {
      setSaving(false);
    }
  }

  const websiteHref = formatWebsiteHref(detail?.business.website);

  return (
    <>
      <Link to="/partner/businesses" className="partner-portal-back">
        ← My Businesses
      </Link>

      {loading && <p className="partner-portal-loading">Loading business…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {detail && (
        <>
          <h1 className="partner-portal-page-title">{detail.business.businessName}</h1>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Business</h2>
            <dl className="partner-portal-dl">
              <dt>Contact</dt>
              <dd>{detail.business.contactName || "—"}</dd>
              <dt>Email</dt>
              <dd>{detail.business.email || "—"}</dd>
              <dt>Phone</dt>
              <dd>{detail.business.phone || "—"}</dd>
              <dt>Location</dt>
              <dd>{detail.business.location || "—"}</dd>
              <dt>Website</dt>
              <dd>
                {websiteHref ? (
                  <a
                    className="partner-portal-external"
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {formatWebsiteLabel(detail.business.website)}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Adoption stage</dt>
              <dd>{getProspectStatusLabel(detail.business.status)}</dd>
            </dl>
          </section>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Relationship</h2>
            <dl className="partner-portal-dl">
              <dt>Lifecycle</dt>
              <dd>
                <LifecycleStatusBadge status={detail.relationship.lifecycleStatus} />
              </dd>
              <dt>Health</dt>
              <dd>
                {detail.relationship.healthStatus != null ? (
                  <>
                    <HealthStatusBadge status={detail.relationship.healthStatus} />
                    {detail.relationship.daysSinceLastActivity != null && (
                      <span style={{ marginLeft: "0.5rem" }}>
                        {detail.relationship.daysSinceLastActivity} days since activity
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Introduced</dt>
              <dd>{formatDateTime(detail.relationship.introducedAt)}</dd>
              <dt>Last activity</dt>
              <dd>
                {detail.relationship.lastActivityAt
                  ? formatDateTime(detail.relationship.lastActivityAt)
                  : "No activity recorded"}
              </dd>
            </dl>
          </section>

          <section className="partner-portal-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <h2 className="partner-portal-card-title" style={{ margin: 0 }}>
                Relationship history
              </h2>
              <button
                type="button"
                className="partner-portal-logout"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Cancel" : "Add note"}
              </button>
            </div>

            {noteError && <p className="partner-portal-error">{noteError}</p>}

            {showForm && (
              <form onSubmit={handleSubmitNote} style={{ marginBottom: "1rem" }}>
                <label className="partner-portal-form-label">
                  Type
                  <select
                    className="partner-portal-form-select"
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as PartnerNoteType)}
                  >
                    {PARTNER_NOTE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t === "walkIn" ? "Walk-in" : t === "followUp" ? "Follow-up" : t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="partner-portal-form-label">
                  Summary
                  <textarea
                    className="partner-portal-form-textarea"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    required
                  />
                </label>
                <label className="partner-portal-form-label">
                  Follow-up date (optional)
                  <input
                    type="date"
                    className="partner-portal-form-input"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  className="partner-portal-btn partner-portal-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save note"}
                </button>
              </form>
            )}

            {detail.notes.length === 0 ? (
              <p className="partner-portal-empty">No relationship history yet.</p>
            ) : (
              detail.notes.map((note) => (
                <div key={note.id} className="partner-portal-note-item">
                  <div className="partner-portal-note-meta">
                    <NoteTypeBadge type={note.type} />
                    <span>{formatDateTime(note.createdAt)}</span>
                    {note.followUpDate && <span>Follow-up {formatDate(note.followUpDate)}</span>}
                  </div>
                  <p className="partner-portal-note-summary">{note.summary}</p>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
