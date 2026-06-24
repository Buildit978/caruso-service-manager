import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createPartnerIntroductionNote,
  fetchPartnerIntroductionById,
  isPartnerUnauthorized,
  partnerApiErrorMessage,
  PARTNER_NOTE_TYPE_OPTIONS,
  PARTNER_RELATIONSHIP_STAGE_LABELS,
  type PartnerDuplicateMatch,
  type PartnerIntroductionDetail,
  type PartnerNoteType,
} from "../../api/partner";
import { formatDateTime } from "../admin/foundingPartners/foundingPartnerFormat";
import { NoteTypeBadge } from "../admin/foundingPartners/foundingPartnerBadges";
import "./partnerPortal.css";

function StageBadge({ stage }: { stage: PartnerIntroductionDetail["relationship"]["stage"] }) {
  return (
    <span className={`partner-portal-stage-badge partner-portal-stage-badge-${stage}`}>
      {PARTNER_RELATIONSHIP_STAGE_LABELS[stage]}
    </span>
  );
}

export default function PartnerIntroductionDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const possibleDuplicates =
    (location.state as { possibleDuplicates?: PartnerDuplicateMatch[] } | null)?.possibleDuplicates ?? [];
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PartnerIntroductionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [noteType, setNoteType] = useState<PartnerNoteType>("walkIn");
  const [summary, setSummary] = useState("");
  const [isMeaningful, setIsMeaningful] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPartnerIntroductionById(id);
      setDetail(res);
    } catch (err) {
      if (isPartnerUnauthorized(err)) {
        navigate("/partner/login", { replace: true });
        return;
      }
      setError(partnerApiErrorMessage(err, "Introduction not found"));
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
      await createPartnerIntroductionNote(id, {
        type: noteType,
        summary: summary.trim(),
        isMeaningful,
      });
      setSummary("");
      setIsMeaningful(false);
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

  return (
    <>
      <Link to="/partner/introductions" className="partner-portal-back">
        ← Introductions
      </Link>

      {loading && <p className="partner-portal-loading">Loading…</p>}
      {error && <p className="partner-portal-error">{error}</p>}

      {detail && (
        <>
          <h1 className="partner-portal-page-title">{detail.business.businessName}</h1>
          <div className="partner-portal-business-meta partner-portal-detail-meta">
            <StageBadge stage={detail.relationship.stage} />
            {detail.relationship.isStewarding && (
              <span className="partner-portal-stewarding-pill">Stewarding this relationship</span>
            )}
          </div>

          {possibleDuplicates.length > 0 && (
            <section className="partner-portal-card partner-portal-warn-card">
              <h2 className="partner-portal-card-title">Possible duplicates</h2>
              <p className="partner-portal-intro-copy">These existing records may match this business.</p>
              <ul className="partner-portal-duplicate-list">
                {possibleDuplicates.map((d) => (
                  <li key={d.prospectId}>
                    {d.businessName} ({d.confidence}: {d.matchedOn.join(", ")})
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="partner-portal-card partner-portal-meaningful-hero">
            <h2 className="partner-portal-card-title">Last meaningful conversation</h2>
            {detail.lastMeaningfulConversation ? (
              <>
                <p className="partner-portal-meaningful-date">
                  {formatDateTime(detail.lastMeaningfulConversation.createdAt)}
                </p>
                <p className="partner-portal-note-summary">{detail.lastMeaningfulConversation.summary}</p>
              </>
            ) : (
              <p className="partner-portal-empty">
                No meaningful conversation recorded yet. Mark a note as meaningful when the owner shares real business
                context — even on your first meeting.
              </p>
            )}
          </section>

          {detail.relationship.isStewarding && (
            <p className="partner-portal-stewarding-banner">
              You are stewarding this relationship. Relationship protection is reviewed and granted by admin separately.
            </p>
          )}

          <section className="partner-portal-card">
            <div className="partner-portal-section-header">
              <h2 className="partner-portal-card-title">Add new note</h2>
              <button
                type="button"
                className="partner-portal-logout"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Hide" : "Show"}
              </button>
            </div>

            {noteError && <p className="partner-portal-error">{noteError}</p>}

            {showForm && (
              <form onSubmit={handleSubmitNote}>
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
                  What did you talk about?
                  <textarea
                    className="partner-portal-form-textarea"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    required
                  />
                </label>
                <label className="partner-portal-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isMeaningful}
                    onChange={(e) => setIsMeaningful(e.target.checked)}
                  />
                  <span>
                    This was a meaningful conversation — the owner shared business context, challenges, goals, or plans
                  </span>
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
          </section>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Conversation history</h2>
            {detail.notes.length === 0 ? (
              <p className="partner-portal-empty">No notes yet.</p>
            ) : (
              detail.notes.map((note) => (
                <div key={note.id} className="partner-portal-note-item">
                  <div className="partner-portal-note-meta">
                    <NoteTypeBadge type={note.type} />
                    {note.isMeaningful && (
                      <span className="partner-portal-meaningful-pill">Meaningful</span>
                    )}
                    <span>{formatDateTime(note.createdAt)}</span>
                  </div>
                  <p className="partner-portal-note-summary">{note.summary}</p>
                </div>
              ))
            )}
          </section>

          <section className="partner-portal-card">
            <h2 className="partner-portal-card-title">Business details</h2>
            <dl className="partner-portal-dl">
              <dt>Owner</dt>
              <dd>{detail.business.contactName || "—"}</dd>
              <dt>Phone</dt>
              <dd>{detail.business.phone || "—"}</dd>
              <dt>Email</dt>
              <dd>{detail.business.email || "—"}</dd>
              <dt>Address</dt>
              <dd>{detail.business.location || "—"}</dd>
              <dt>Introduced</dt>
              <dd>{formatDateTime(detail.relationship.introducedAt)}</dd>
            </dl>
          </section>
        </>
      )}
    </>
  );
}
