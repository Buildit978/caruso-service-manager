import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { Account } from "../../models/account.model";
import { User } from "../../models/user.model";
import { trackAdminAudit } from "../../utils/trackAdminAudit";
import { getAccountAudits } from "../../utils/getAccountAudits";

const router = Router();

const AUDITS_MAX_LIMIT = 200;
const AUDITS_DEFAULT_LIMIT = 50;
const AUDITS_DEFAULT_SKIP = 0;

function parseAuditsLimit(query: Request["query"]): number {
  const raw = query.limit;
  if (raw == null || raw === "") return AUDITS_DEFAULT_LIMIT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return AUDITS_DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), AUDITS_MAX_LIMIT);
}

function parseAuditsSkip(query: Request["query"]): number {
  const raw = query.skip;
  if (raw == null || raw === "") return AUDITS_DEFAULT_SKIP;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return AUDITS_DEFAULT_SKIP;
  return n;
}

const SECURITY_FIELDS = [
  "quarantineUntil",
  "throttleUntil",
  "securityNote",
  "lastSecurityActionAt",
  "lastSecurityActorId",
] as const;

function parseAccountId(param: string | undefined): Types.ObjectId | null {
  if (param == null || param === "" || !Types.ObjectId.isValid(param)) return null;
  return new Types.ObjectId(param);
}

function parseUntil(value: unknown): Date | null {
  if (value == null || typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value.trim());
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (d.getTime() <= Date.now()) return null;
  return d;
}

function securitySubset(account: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SECURITY_FIELDS) {
    if (account[k] !== undefined) out[k] = account[k];
  }
  return out;
}

const TENANT_ROLES = ["owner", "manager", "technician"];

/*
 * GET /api/admin/accounts/:accountId/users?role=&isActive=&search=
 * Returns minimal user fields for the account (tenant users only). accountId param drives results (no cross-tenant).
 */
router.get("/:accountId/users", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });

    const role = typeof req.query.role === "string" && req.query.role.trim() !== "" ? req.query.role.trim() : undefined;
    const isActiveRaw = req.query.isActive;
    const isActive =
      isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

    const filter: Record<string, unknown> = { accountId, role: { $in: TENANT_ROLES } };
    if (role && TENANT_ROLES.includes(role)) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive;
    if (search && search.length > 0) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { email: re },
        { name: re },
        { firstName: re },
        { lastName: re },
      ];
    }

    const users = await User.find(filter)
      .select("_id email name firstName lastName role isActive mustChangePassword")
      .sort({ role: 1, email: 1 })
      .lean();

    const items = users.map((u: any) => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || "—",
      role: u.role,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword === true,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("[admin] GET /accounts/:accountId/users error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/*
 * GET /api/admin/accounts/:accountId/audits?limit=50&skip=0
 * Example: curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/accounts/<accountId>/audits?limit=50&skip=0"
 */
router.get("/:accountId/audits", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });
    const limit = parseAuditsLimit(req.query);
    const skip = parseAuditsSkip(req.query);
    const result = await getAccountAudits(accountId, { limit, skip });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /accounts/:accountId/security/quarantine
router.post("/:accountId/security/quarantine", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });
    const untilDate = parseUntil(req.body?.until);
    if (!untilDate) return res.status(400).json({ message: "Invalid until" });
    const note = req.body?.note as string | undefined;
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });

    const before = securitySubset(account as Record<string, unknown>);
    const now = new Date();
    const set: Record<string, unknown> = {
      quarantineUntil: untilDate,
      lastSecurityActionAt: now,
      lastSecurityActorId: adminActor._id,
    };
    if (note !== undefined) set.securityNote = note;
    else if ((account as any).securityNote != null) set.securityNote = (account as any).securityNote;

    await Account.updateOne({ _id: accountId }, { $set: set });
    const updated = await Account.findById(accountId).lean();
    const after = updated ? securitySubset(updated as Record<string, unknown>) : before;

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "account.quarantine.set",
      targetAccountId: accountId,
      before,
      after,
      note,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, accountId: accountId.toString(), quarantineUntil: untilDate.toISOString() });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /accounts/:accountId/security/quarantine
router.delete("/:accountId/security/quarantine", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });
    const note = req.body?.note as string | undefined;
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });

    const before = securitySubset(account as Record<string, unknown>);
    const now = new Date();
    const update: any = { $unset: { quarantineUntil: "" }, $set: { lastSecurityActionAt: now, lastSecurityActorId: adminActor._id } };
    if (note !== undefined) update.$set.securityNote = note;

    await Account.updateOne({ _id: accountId }, update);
    const updated = await Account.findById(accountId).lean();
    const after = updated ? securitySubset(updated as Record<string, unknown>) : { ...before, quarantineUntil: undefined };

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "account.quarantine.clear",
      targetAccountId: accountId,
      before,
      after,
      note,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, accountId: accountId.toString(), quarantineUntil: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /accounts/:accountId/security/throttle
router.post("/:accountId/security/throttle", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });
    const untilDate = parseUntil(req.body?.until);
    if (!untilDate) return res.status(400).json({ message: "Invalid until" });
    const note = req.body?.note as string | undefined;
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });

    const before = securitySubset(account as Record<string, unknown>);
    const now = new Date();
    const set: Record<string, unknown> = {
      throttleUntil: untilDate,
      lastSecurityActionAt: now,
      lastSecurityActorId: adminActor._id,
    };
    if (note !== undefined) set.securityNote = note;
    else if ((account as any).securityNote != null) set.securityNote = (account as any).securityNote;

    await Account.updateOne({ _id: accountId }, { $set: set });
    const updated = await Account.findById(accountId).lean();
    const after = updated ? securitySubset(updated as Record<string, unknown>) : before;

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "account.throttle.set",
      targetAccountId: accountId,
      before,
      after,
      note,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, accountId: accountId.toString(), throttleUntil: untilDate.toISOString() });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /accounts/:accountId/security/throttle
router.delete("/:accountId/security/throttle", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });
    const note = req.body?.note as string | undefined;
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });

    const before = securitySubset(account as Record<string, unknown>);
    const now = new Date();
    const update: any = { $unset: { throttleUntil: "" }, $set: { lastSecurityActionAt: now, lastSecurityActorId: adminActor._id } };
    if (note !== undefined) update.$set.securityNote = note;

    await Account.updateOne({ _id: accountId }, update);
    const updated = await Account.findById(accountId).lean();
    const after = updated ? securitySubset(updated as Record<string, unknown>) : { ...before, throttleUntil: undefined };

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "account.throttle.clear",
      targetAccountId: accountId,
      before,
      after,
      note,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, accountId: accountId.toString(), throttleUntil: null });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /accounts/:accountId/security/force-logout
router.post("/:accountId/security/force-logout", async (req: Request, res: Response) => {
  try {
    const accountId = parseAccountId(req.params.accountId);
    if (!accountId) return res.status(400).json({ message: "Invalid accountId" });
    const note = req.body?.note as string | undefined;
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });

    const before = {
      lastSecurityActionAt: (account as any).lastSecurityActionAt,
      lastSecurityActorId: (account as any).lastSecurityActorId,
      securityNote: (account as any).securityNote,
    };
    const now = new Date();

    await User.updateMany({ accountId }, { $set: { tokenInvalidBefore: now } });
    const accountSet: Record<string, unknown> = { lastSecurityActionAt: now, lastSecurityActorId: adminActor._id };
    if (note !== undefined) accountSet.securityNote = note;
    await Account.updateOne({ _id: accountId }, { $set: accountSet });
    const updated = await Account.findById(accountId).lean();
    const after = updated
      ? { lastSecurityActionAt: (updated as any).lastSecurityActionAt, lastSecurityActorId: (updated as any).lastSecurityActorId, securityNote: (updated as any).securityNote }
      : before;

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "account.force_logout",
      targetAccountId: accountId,
      before,
      after,
      note,
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({ ok: true, accountId: accountId.toString(), forcedAt: now.toISOString() });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
