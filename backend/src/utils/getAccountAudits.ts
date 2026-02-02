import { Types } from "mongoose";
import { AdminAudit } from "../models/adminAudit.model";
import { User } from "../models/user.model";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const DEFAULT_SKIP = 0;

export interface GetAccountAuditsOptions {
  limit?: number;
  skip?: number;
}

export interface AuditItemResponse {
  _id: string;
  accountId: string;
  action: string;
  createdAt: string;
  actorId: string;
  actorEmail?: string;
  ip?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
}

export interface GetAccountAuditsResult {
  paging: { skip: number; limit: number; returned: number };
  items: AuditItemResponse[];
}

function clampLimit(n: number): number {
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(n), 1), MAX_LIMIT);
}

function clampSkip(n: number): number {
  if (!Number.isFinite(n) || n < 0) return DEFAULT_SKIP;
  return Math.floor(n);
}

export async function getAccountAudits(
  accountId: Types.ObjectId,
  options: GetAccountAuditsOptions = {}
): Promise<GetAccountAuditsResult> {
  const limit = clampLimit(options.limit ?? DEFAULT_LIMIT);
  const skip = clampSkip(options.skip ?? DEFAULT_SKIP);

  const audits = await AdminAudit.find({ targetAccountId: accountId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const adminIds = [...new Set(audits.map((a) => String(a.adminId)))];
  const users =
    adminIds.length > 0
      ? await User.find({ _id: { $in: adminIds.map((id) => new Types.ObjectId(id)) } })
          .select("_id email")
          .lean()
      : [];
  const emailByAdminId = new Map(users.map((u) => [String(u._id), (u as { email?: string }).email]));

  const items: AuditItemResponse[] = audits.map((a) => ({
    _id: String(a._id),
    accountId: String(a.targetAccountId),
    action: a.action,
    createdAt: (a.createdAt as Date).toISOString(),
    actorId: String(a.adminId),
    actorEmail: emailByAdminId.get(String(a.adminId)),
    ip: a.ip,
    userAgent: a.userAgent,
    before: a.before,
    after: a.after,
  }));

  return {
    paging: { skip, limit, returned: items.length },
    items,
  };
}
