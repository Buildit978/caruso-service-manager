import { useCallback, useEffect, useState } from "react";
import {
  createCommunicationNote,
  fetchCommunicationNotes,
  type CommunicationNote,
  type CommunicationNoteType,
} from "../../../api/adminFoundingPartners";
import { NOTE_TYPE_OPTIONS } from "./foundingPartnerBadges";
import { apiErrorMessage, todayDateInputValue } from "./foundingPartnerFormat";
import InteractionFormFields, {
  createDefaultInteractionFormValues,
  type InteractionFormValues,
} from "./InteractionFormFields";
import InteractionTimelineCard from "./InteractionTimelineCard";

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
  const [interactions, setInteractions] = useState<CommunicationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordAsInternal, setRecordAsInternal] = useState(false);
  const [internalType, setInternalType] = useState<CommunicationNoteType>("internalNote");
  const [followUpDate, setFollowUpDate] = useState("");
  const [form, setForm] = useState<InteractionFormValues>(() => createDefaultInteractionFormValues());

  const loadInteractions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCommunicationNotes({
        partnerId,
        prospectId,
        relationshipProtectionId,
        limit: 50,
      });
      setInteractions(res.items);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load interactions"));
    } finally {
      setLoading(false);
    }
  }, [partnerId, prospectId, relationshipProtectionId]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  function resetForm() {
    setForm(createDefaultInteractionFormValues());
    setFollowUpDate("");
    setRecordAsInternal(false);
    setInternalType("internalNote");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.summary.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCommunicationNote({
        partnerId,
        prospectId,
        relationshipProtectionId,
        type: recordAsInternal ? internalType : undefined,
        visitType: recordAsInternal ? undefined : form.visitType,
        summary: form.summary.trim(),
        activityDate: form.activityDate || todayDateInputValue(),
        activityTime: form.activityTime,
        primaryContact: form.primaryContact.trim() || undefined,
        duration: form.duration.trim() || undefined,
        interestLevel: form.interestLevel || undefined,
        followUpDate: followUpDate || undefined,
      });
      resetForm();
      setShowForm(false);
      await loadInteractions();
      onNoteAdded?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to log interaction"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fp-card fp-print-root">
      <div className="fp-detail-header">
        <h2 className="fp-section-title">Interactions</h2>
        <button
          type="button"
          className="fp-btn fp-btn-secondary fp-btn-sm fp-no-print"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "Log interaction"}
        </button>
      </div>

      {error && <p className="fp-error fp-no-print">{error}</p>}

      {showForm && (
        <form className="fp-form-grid fp-no-print" onSubmit={handleSubmit}>
          <label className="fp-form-label fp-checkbox-row">
            <input
              type="checkbox"
              checked={recordAsInternal}
              onChange={(e) => setRecordAsInternal(e.target.checked)}
            />
            <span>Record as internal admin interaction</span>
          </label>

          {recordAsInternal && (
            <label className="fp-form-label">
              Internal type
              <select
                className="fp-form-select"
                value={internalType}
                onChange={(e) => setInternalType(e.target.value as CommunicationNoteType)}
              >
                {NOTE_TYPE_OPTIONS.filter((t) => t === "internalNote").map((t) => (
                  <option key={t} value={t}>
                    Internal
                  </option>
                ))}
              </select>
            </label>
          )}

          <InteractionFormFields
            values={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            showInterestLevel={!recordAsInternal}
          />

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
              {saving ? "Saving…" : "Save interaction"}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="fp-loading">Loading interactions…</p>}
      {!loading && interactions.length === 0 && <p className="fp-empty">No interactions yet.</p>}
      {!loading && interactions.length > 0 && (
        <ul className="fp-notes-list">
          {interactions.map((interaction) => (
            <li key={interaction.id}>
              <InteractionTimelineCard interaction={interaction} showAudit />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
