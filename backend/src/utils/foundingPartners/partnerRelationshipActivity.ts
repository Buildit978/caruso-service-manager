import type { HydratedDocument } from "mongoose";
import type { IPartnerProspectRelationship } from "../../models/partnerProspectRelationship.model";

/** Update real-world relationship dates after a partner logs activity. */
export async function applyPartnerProspectRelationshipActivity(
  relationship: HydratedDocument<IPartnerProspectRelationship>,
  activityDate: Date,
  options?: { nextFollowUpDate?: Date | null }
): Promise<void> {
  if (!relationship.firstContactDate) {
    relationship.firstContactDate = activityDate;
  }

  const currentLast = relationship.lastVisitDate;
  if (!currentLast || activityDate.getTime() > new Date(currentLast).getTime()) {
    relationship.lastVisitDate = activityDate;
  }

  if (options && "nextFollowUpDate" in options) {
    relationship.nextFollowUpDate = options.nextFollowUpDate ?? undefined;
  }

  await relationship.save();
}
