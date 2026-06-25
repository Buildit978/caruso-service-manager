import type { InterestLevel, VisitType } from "./fieldInteractionUi";
import {
  INTEREST_LEVEL_OPTIONS,
  VISIT_TYPE_OPTIONS,
  currentTimeInputValue,
} from "./fieldInteractionUi";
import { todayDateInputValue } from "./foundingPartnerFormat";

export interface InteractionFormValues {
  activityDate: string;
  activityTime: string;
  primaryContact: string;
  visitType: VisitType;
  duration: string;
  interestLevel: InterestLevel | "";
  summary: string;
}

export function createDefaultInteractionFormValues(
  overrides?: Partial<InteractionFormValues>
): InteractionFormValues {
  return {
    activityDate: todayDateInputValue(),
    activityTime: currentTimeInputValue(),
    primaryContact: "",
    visitType: "walkIn",
    duration: "",
    interestLevel: "",
    summary: "",
    ...overrides,
  };
}

interface InteractionFormFieldsProps {
  values: InteractionFormValues;
  onChange: (patch: Partial<InteractionFormValues>) => void;
  inputClassName?: string;
  selectClassName?: string;
  textareaClassName?: string;
  labelClassName?: string;
  notesLabel?: string;
  showInterestLevel?: boolean;
}

export default function InteractionFormFields({
  values,
  onChange,
  inputClassName = "fp-form-input",
  selectClassName = "fp-form-select",
  textareaClassName = "fp-form-textarea",
  labelClassName = "fp-form-label",
  notesLabel = "Notes",
  showInterestLevel = true,
}: InteractionFormFieldsProps) {
  return (
    <>
      <div className="fp-interaction-datetime-row">
        <label className={labelClassName}>
          Date
          <input
            type="date"
            className={inputClassName}
            value={values.activityDate}
            max={todayDateInputValue()}
            onChange={(e) => onChange({ activityDate: e.target.value })}
            required
          />
        </label>
        <label className={labelClassName}>
          Time
          <input
            type="time"
            className={inputClassName}
            value={values.activityTime}
            onChange={(e) => onChange({ activityTime: e.target.value })}
            required
          />
        </label>
      </div>

      <label className={labelClassName}>
        Primary contact (optional)
        <input
          className={inputClassName}
          value={values.primaryContact}
          onChange={(e) => onChange({ primaryContact: e.target.value })}
          placeholder="Who did you speak with?"
        />
      </label>

      <label className={labelClassName}>
        Visit type
        <select
          className={selectClassName}
          value={values.visitType}
          onChange={(e) => onChange({ visitType: e.target.value as VisitType })}
        >
          {VISIT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName}>
        Duration (optional)
        <input
          className={inputClassName}
          value={values.duration}
          onChange={(e) => onChange({ duration: e.target.value })}
          placeholder="15, 20, 1:00, 45 min"
        />
      </label>

      {showInterestLevel && (
        <label className={labelClassName}>
          Interest level (optional)
          <select
            className={selectClassName}
            value={values.interestLevel}
            onChange={(e) =>
              onChange({ interestLevel: e.target.value as InterestLevel | "" })
            }
          >
            <option value="">—</option>
            {INTEREST_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={labelClassName}>
        {notesLabel}
        <textarea
          className={textareaClassName}
          value={values.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          required
        />
      </label>
    </>
  );
}
