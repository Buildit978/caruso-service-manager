interface ShareWhatYouLearnedFieldsProps {
  enabled: boolean;
  observation: string;
  onEnabledChange: (enabled: boolean) => void;
  onObservationChange: (observation: string) => void;
  checkboxClassName?: string;
  labelClassName?: string;
  textareaClassName?: string;
  sectionClassName?: string;
}

export default function ShareWhatYouLearnedFields({
  enabled,
  observation,
  onEnabledChange,
  onObservationChange,
  checkboxClassName = "partner-portal-checkbox-label",
  labelClassName = "partner-portal-form-label",
  textareaClassName = "partner-portal-form-textarea",
  sectionClassName = "partner-portal-share-learned",
}: ShareWhatYouLearnedFieldsProps) {
  return (
    <div className={sectionClassName}>
      <label className={checkboxClassName}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span>Share What You Learned (optional)</span>
      </label>
      <p className="partner-portal-share-learned-help label-muted-readable">
        Did you learn anything today that could help Shop Service Manager or other repair shops?
      </p>
      {enabled && (
        <label className={labelClassName}>
          What did you learn?
          <textarea
            className={textareaClassName}
            rows={4}
            value={observation}
            onChange={(e) => onObservationChange(e.target.value)}
            placeholder="Share something useful from the visit…"
          />
        </label>
      )}
    </div>
  );
}

export function buildFieldIntelligencePayload(
  enabled: boolean,
  observation: string
): { fieldIntelligence: { observation: string } } | undefined {
  if (!enabled) return undefined;
  const trimmed = observation.trim();
  if (!trimmed) return undefined;
  return { fieldIntelligence: { observation: trimmed } };
}

export function validateShareWhatYouLearned(
  enabled: boolean,
  observation: string
): string | null {
  if (enabled && !observation.trim()) {
    return "Please enter what you learned, or uncheck Share What You Learned.";
  }
  return null;
}
