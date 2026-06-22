import { Types } from "mongoose";
import {
  FoundingPartnerAuditLog,
  type FoundingPartnerEntityType,
} from "../models/foundingPartnerAuditLog.model";

export async function trackFoundingPartnerAudit(args: {
  actorId: Types.ObjectId;
  action: string;
  entityType: FoundingPartnerEntityType;
  entityId: Types.ObjectId;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await FoundingPartnerAuditLog.create({
      actorId: args.actorId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      before: args.before,
      after: args.after,
    });
  } catch {
    // Swallow; audit must not block admin flows.
  }
}
