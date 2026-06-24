import { useCallback, useEffect, useState } from "react";
import {
  createCommunicationNote,
  fetchCommunicationNotes,
  type CommunicationNote,
  type CommunicationNoteType,
} from "../../../api/adminFoundingPartners";
import { NoteTypeBadge, NOTE_TYPE_OPTIONS } from "./foundingPartnerBadges";
import { apiErrorMessage, formatDate, formatDateTime } from "./foundingPartnerFormat";

interface CommunicationNotesSectionProps {
  partnerId?: string;
  prospectId?: string;
  relationshipProtectionId?: string;
  onNoteAdded?: () => void;
}

export default function CommunicationNotesSection({
  partnerId,
  prospectId,
  relationshipProtectionId,
  onNoteAdded,
}: CommunicationNotesSectionProps) {
  const [notes, setNotes] = useState<CommunicationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<CommunicationNoteType>("internalNote");
  const [summary, setSummary] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCommunicationNotes({
        partnerId,
        prospectId,
        relationshipProtectionId,
        limit: 50,
      });
      setNotes(res.items);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load relationship history"));
    } finally {
      setLoading(false);
    }
  }, [partnerId, prospectId, relationshipProtectionId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCommunicationNote({
        partnerId,
        prospectId,
        relationshipProtectionId,
        type,
        summary: summary.trim(),
        followUpDate: followUpDate || undefined,
      });
      setSummary("");
      setFollowUpDate("");
      setShowForm(false);
      await loadNotes();
      onNoteAdded?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add note"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fp-card fp-print-root">
      <div className="fp-detail-header">
        <h2 className="fp-section-title">Relationship history</h2>
        <button
          type="button"
          className="fp-btn fp-btn-secondary fp-btn-sm fp-no-print"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "Add note"}
        </button>
      </div>

      {error && <p className="fp-error fp-no-print">{error}</p>}

      {showForm && (
        <form className="fp-form-grid fp-no-print" onSubmit={handleSubmit}>
          <label className="fp-form-label">
            Type
            <select
              className="fp-form-select"
              value={type}
              onChange={(e) => setType(e.target.value as CommunicationNoteType)}
            >
              {NOTE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="fp-form-label">
            Summary
            <textarea
              className="fp-form-textarea"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </label>
          <label className="fp-form-label">
            Follow-up date (optional)
            <input
              type="date"
              className="fp-form-input"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </label>
          <div className="fp-form-actions">
            <button type="submit" className="fp-btn fp-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="fp-loading">Loading relationship history…</p>}
      {!loading && notes.length === 0 && <p className="fp-empty">No relationship history yet.</p>}
      {!loading && notes.length > 0 && (
        <ul className="fp-notes-list">
          {notes.map((note) => (
            <li key={note.id} className="fp-note-item">
              <div className="fp-note-meta">
                <NoteTypeBadge type={note.type} />
                <span>{formatDateTime(note.createdAt)}</span>
                {note.createdByName && <span>by {note.createdByName}</span>}
                {note.followUpDate && <span>Follow-up {formatDate(note.followUpDate)}</span>}
              </div>
              <p className="fp-note-summary">{note.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
