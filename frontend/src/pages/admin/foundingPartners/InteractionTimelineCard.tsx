import type { FieldInteraction } from "./fieldInteractionUi";
import {
  formatInteractionFollowUp,
  formatInteractionTimestamp,
  getInterestLevelLabel,
  getVisitTypeLabel,
} from "./fieldInteractionUi";
import { formatDateTime } from "./foundingPartnerFormat";

interface InteractionTimelineCardProps {
  interaction: FieldInteraction;
  className?: string;
  showAudit?: boolean;
  meaningfulBadge?: React.ReactNode;
}

export default function InteractionTimelineCard({
  interaction,
  className = "fp-note-item",
  showAudit = false,
  meaningfulBadge,
}: InteractionTimelineCardProps) {
  const interestLabel = getInterestLevelLabel(interaction.interestLevel);
  const amendments = interaction.amendments ?? [];

  return (
    <article className={className}>
      <p className="fp-interaction-timestamp">{formatInteractionTimestamp(interaction)}</p>

      {interaction.primaryContact?.trim() && (
        <p className="fp-interaction-line">
          <span className="fp-interaction-label">Primary Contact:</span> {interaction.primaryContact}
        </p>
      )}

      <p className="fp-interaction-line fp-interaction-visit-type">{getVisitTypeLabel(interaction)}</p>

      {interaction.duration?.trim() && (
        <p className="fp-interaction-line">
          <span className="fp-interaction-label">Duration:</span> {interaction.duration}
        </p>
      )}

      {interestLabel && (
        <p className="fp-interaction-line">
          <span className="fp-interaction-label">Interest:</span> {interestLabel}
        </p>
      )}

      {meaningfulBadge}

      <p className="fp-note-summary">{interaction.summary}</p>

      {amendments.length > 0 && (
        <div className="fp-interaction-amendments">
          {amendments.map((amendment, index) => (
            <div key={`${interaction.id ?? "note"}-amendment-${index}`} className="fp-interaction-amendment">
              <p className="fp-interaction-amendment-label">Clarification</p>
              <p className="fp-interaction-amendment-text">{amendment.text}</p>
              {amendment.createdAt && (
                <p className="fp-note-audit">Added {formatDateTime(amendment.createdAt)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {interaction.followUpDate && (
        <p className="fp-interaction-line fp-interaction-follow-up">
          Follow-up {formatInteractionFollowUp(interaction.followUpDate)}
        </p>
      )}

      {showAudit && interaction.createdAt && (
        <p className="fp-note-audit">Recorded {formatDateTime(interaction.createdAt)}</p>
      )}
    </article>
  );
}
