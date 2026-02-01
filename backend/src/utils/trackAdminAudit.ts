import { Types } from "mongoose";
import { AdminAudit } from "../models/adminAudit.model";

export async function trackAdminAudit(args: {
  adminId: Types.ObjectId;
  action: string;
  targetAccountId: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  note?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await AdminAudit.create({
      adminId: args.adminId,
      action: args.action,
      targetAccountId: args.targetAccountId,
      before: args.before,
      after: args.after,
      note: args.note,
      ip: args.ip,
      userAgent: args.userAgent,
    });
  } catch {
    // Swallow; audit must not block admin flows.
  }
}
