import { useState, type FormEvent } from "react";
import type { PartnerInteraction } from "../../api/partner";
import InteractionTimelineCard from "../admin/foundingPartners/InteractionTimelineCard";

type PartnerInteractionTimelineItemProps = {
  interaction: PartnerInteraction;
  className?: string;
  meaningfulBadge?: React.ReactNode;
  onAmendmentSaved: (updated: PartnerInteraction) => void;
  onAddAmendment: (noteId: string, text: string) => Promise<PartnerInteraction>;
};

export default function PartnerInteractionTimelineItem({
  interaction,
  className,
  meaningfulBadge,
  onAmendmentSaved,
  onAddAmendment,
}: PartnerInteractionTimelineItemProps) {
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!interaction.id || !text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await onAddAmendment(interaction.id, text.trim());
      onAmendmentSaved(updated);
      setText("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save clarification");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="partner-portal-interaction-item">
      <InteractionTimelineCard
        interaction={interaction}
        className={className}
        meaningfulBadge={meaningfulBadge}
      />

      {!showForm ? (
        <button
          type="button"
          className="partner-portal-link-btn"
          onClick={() => setShowForm(true)}
        >
          Add clarification
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="partner-portal-amendment-form">
          <p className="partner-portal-amendment-help label-muted-readable">
            Clarifications are added later. The original interaction stays as recorded.
          </p>
          {error && <p className="partner-portal-error">{error}</p>}
          <label className="partner-portal-form-label">
            Clarification
            <textarea
              className="partner-portal-form-textarea"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </label>
          <div className="partner-portal-form-actions">
            <button
              type="submit"
              className="partner-portal-btn partner-portal-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save clarification"}
            </button>
            <button
              type="button"
              className="partner-portal-btn partner-portal-btn-secondary"
              onClick={() => {
                setShowForm(false);
                setText("");
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
