import type { PartnerRelationshipStage } from "../../models/partnerProspectRelationship.model";

/**
 * Advance partner relationship stage based on a new note.
 * Meaningful flag on any note (including the first) → meaningfulConversation immediately.
 * No visit-count rules.
 */
export function advancePartnerRelationshipStage(
  current: PartnerRelationshipStage,
  isMeaningful: boolean
): PartnerRelationshipStage {
  if (isMeaningful) return "meaningfulConversation";
  if (current === "introduced") return "conversation";
  return current;
}

/** Stewardship emerges when meaningful conversation exists (derived, not stored). */
export function isPartnerStewarding(stage: PartnerRelationshipStage): boolean {
  return stage === "meaningfulConversation";
}
