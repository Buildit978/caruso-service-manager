import { formatDate } from "./foundingPartnerFormat";

export type VisitType =
  | "walkIn"
  | "phone"
  | "email"
  | "textWhatsApp"
  | "demo"
  | "followUp"
  | "referral"
  | "other";

export type InterestLevel =
  | "cold"
  | "cool"
  | "warm"
  | "warmInterested"
  | "hot"
  | "busy"
  | "busyWarm"
  | "busyInterested"
  | "customer"
  | "unknown";

export interface FieldInteraction {
  id?: string;
  type?: string;
  summary: string;
  isMeaningful?: boolean;
  activityDate?: string | null;
  activityTime?: string | null;
  primaryContact?: string | null;
  visitType?: VisitType | string | null;
  duration?: string | null;
  interestLevel?: InterestLevel | string | null;
  followUpDate?: string | null;
  amendments?: Array<{
    text: string;
    createdAt?: string | null;
    createdBy?: string | null;
  }>;
  createdAt?: string | null;
  createdByName?: string | null;
}

export const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: "walkIn", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "textWhatsApp", label: "Text / WhatsApp" },
  { value: "demo", label: "Demo" },
  { value: "followUp", label: "Follow-up" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export const INTEREST_LEVEL_OPTIONS: { value: InterestLevel; label: string }[] = [
  { value: "cold", label: "Cold – Not interested" },
  { value: "cool", label: "Cool – Curious" },
  { value: "warm", label: "Warm" },
  { value: "warmInterested", label: "Warm – Interested" },
  { value: "hot", label: "Hot – Wants demo" },
  { value: "busy", label: "Busy" },
  { value: "busyWarm", label: "Busy – Warm" },
  { value: "busyInterested", label: "Busy – Interested" },
  { value: "customer", label: "Customer" },
];

/** Legacy saved values not offered in current dropdowns. */
const LEGACY_INTEREST_LEVEL_LABELS: Record<string, string> = {
  unknown: "Unknown / not discussed",
};

const LEGACY_TYPE_LABELS: Record<string, string> = {
  call: "Phone",
  email: "Email",
  walkIn: "Walk-in",
  meeting: "Other",
  demo: "Demo",
  followUp: "Follow-up",
  internalNote: "Internal",
};

export function currentTimeInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getVisitTypeLabel(interaction: FieldInteraction): string {
  if (interaction.visitType) {
    const match = VISIT_TYPE_OPTIONS.find((o) => o.value === interaction.visitType);
    if (match) return match.label;
  }
  if (interaction.type) {
    return LEGACY_TYPE_LABELS[interaction.type] ?? interaction.type;
  }
  return "Interaction";
}

export function getInterestLevelLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = INTEREST_LEVEL_OPTIONS.find((o) => o.value === value);
  if (match) return match.label;
  return LEGACY_INTEREST_LEVEL_LABELS[value] ?? value;
}

export function formatInteractionTimestamp(interaction: FieldInteraction): string {
  const dateIso = interaction.activityDate ?? interaction.createdAt;
  if (!dateIso) return "—";

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "—";

  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (interaction.activityTime && /^\d{2}:\d{2}$/.test(interaction.activityTime)) {
    const [h, m] = interaction.activityTime.split(":").map(Number);
    const timeDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
    const timePart = timeDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} • ${timePart}`;
  }

  if (interaction.activityDate) return datePart;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatInteractionFollowUp(iso: string | null | undefined): string {
  return formatDate(iso);
}
