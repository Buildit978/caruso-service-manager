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
