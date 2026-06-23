import type {
  FoundingPartnerStatus,
  FoundingProspectStatus,
  ProtectionStatus,
  RelationshipLifecycleStatus,
  CommunicationNoteType,
} from "../../../api/adminFoundingPartners";

const PARTNER_LABELS: Record<FoundingPartnerStatus, string> = {
  active: "Active",
  paused: "Paused",
  inactive: "Inactive",
};

const PROSPECT_LABELS: Record<FoundingProspectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  demoScheduled: "Demo scheduled",
  demoCompleted: "Demo completed",
  trialStarted: "Trial started",
  converted: "Converted",
  closedLost: "Closed lost",
  notFit: "Not a fit",
};

const PROTECTION_LABELS: Record<ProtectionStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  expired: "Expired",
  released: "Released",
};

const LIFECYCLE_LABELS: Record<RelationshipLifecycleStatus, string> = {
  new: "New",
  protected: "Protected",
  connected: "Connected",
  engaged: "Engaged",
};

const NOTE_LABELS: Record<CommunicationNoteType, string> = {
  call: "Call",
  email: "Email",
  walkIn: "Walk-in",
  meeting: "Meeting",
  demo: "Demo",
  followUp: "Follow-up",
  internalNote: "Internal note",
};

export function PartnerStatusBadge({ status }: { status: FoundingPartnerStatus | string }) {
  const label = PARTNER_LABELS[status as FoundingPartnerStatus] ?? status;
  return <span className={`fp-badge fp-badge-partner fp-badge-partner-${status}`}>{label}</span>;
}

export function ProspectStatusBadge({ status }: { status: FoundingProspectStatus | string }) {
  const label = PROSPECT_LABELS[status as FoundingProspectStatus] ?? status;
  return <span className={`fp-badge fp-badge-prospect fp-badge-prospect-${status}`}>{label}</span>;
}

export function ProtectionStatusBadge({ status }: { status: ProtectionStatus | string }) {
  const label = PROTECTION_LABELS[status as ProtectionStatus] ?? status;
  return (
    <span className={`fp-badge fp-badge-protection fp-badge-protection-${status}`}>{label}</span>
  );
}

export function LifecycleStatusBadge({ status }: { status: RelationshipLifecycleStatus | string }) {
  const label = LIFECYCLE_LABELS[status as RelationshipLifecycleStatus] ?? status;
  return (
    <span className={`fp-badge fp-badge-lifecycle fp-badge-lifecycle-${status}`}>{label}</span>
  );
}

export function NoteTypeBadge({ type }: { type: CommunicationNoteType | string }) {
  const label = NOTE_LABELS[type as CommunicationNoteType] ?? type;
  return <span className="fp-badge fp-badge-note">{label}</span>;
}

export const PROSPECT_STATUS_OPTIONS: FoundingProspectStatus[] = [
  "new",
  "contacted",
  "demoScheduled",
  "demoCompleted",
  "trialStarted",
  "converted",
  "closedLost",
  "notFit",
];

export const PARTNER_STATUS_OPTIONS: FoundingPartnerStatus[] = ["active", "paused", "inactive"];

export const LIFECYCLE_STATUS_OPTIONS: RelationshipLifecycleStatus[] = [
  "new",
  "protected",
  "connected",
  "engaged",
];

const LIFECYCLE_ORDER: RelationshipLifecycleStatus[] = ["new", "protected", "connected", "engaged"];

export function getNextLifecycleStatus(
  current: RelationshipLifecycleStatus
): RelationshipLifecycleStatus | null {
  const idx = LIFECYCLE_ORDER.indexOf(current);
  if (idx < 0 || idx >= LIFECYCLE_ORDER.length - 1) return null;
  return LIFECYCLE_ORDER[idx + 1];
}

export function getLifecycleLabel(status: RelationshipLifecycleStatus | string): string {
  return LIFECYCLE_LABELS[status as RelationshipLifecycleStatus] ?? status;
}

export const NOTE_TYPE_OPTIONS: CommunicationNoteType[] = [
  "call",
  "email",
  "walkIn",
  "meeting",
  "demo",
  "followUp",
  "internalNote",
];
