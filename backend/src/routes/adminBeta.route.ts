// backend/src/routes/adminBeta.route.ts
import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { Account } from "../models/account.model";
import { Settings } from "../models/settings.model";
import { Event } from "../models/event.model";
import { User } from "../models/user.model";
import { WorkOrder } from "../models/workOrder.model";
import Invoice from "../models/invoice.model";
import { Customer } from "../models/customer.model";
import { trackAdminAudit } from "../utils/trackAdminAudit";

const router = Router();

const EVENTS_MAX_LIMIT = 200;
const EVENTS_DEFAULT_LIMIT = 50;
const EVENTS_DEFAULT_SKIP = 0;
const ADMIN_NOTES_MAX_LEN = 32000;

function parseEventsLimit(query: Request["query"]): number {
  const raw = query.limit;
  if (raw == null || raw === "") return EVENTS_DEFAULT_LIMIT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return EVENTS_DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), EVENTS_MAX_LIMIT);
}

function parseEventsSkip(query: Request["query"]): number {
  const raw = query.skip;
  if (raw == null || raw === "") return EVENTS_DEFAULT_SKIP;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return EVENTS_DEFAULT_SKIP;
  return n;
}

function parseDays(query: Request["query"]): number {
  const raw = query.days;
  if (raw == null || raw === "") return 7;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(Math.max(n, 1), 90);
}

function parseRegion(query: Request["query"]): "Canada" | "TT" | "all" {
  const raw = String(query.region ?? "all").trim();
  if (raw === "Canada" || raw === "TT") return raw;
  return "all";
}

function parseStatus(query: Request["query"]): "active" | "inactive" | "all" {
  const raw = String(query.status ?? "all").trim();
  if (raw === "active" || raw === "inactive") return raw;
  return "all";
}

function parseQ(query: Request["query"]): string | undefined {
  const raw = typeof query.q === "string" ? query.q.trim() : "";
  return raw === "" ? undefined : raw;
}

function parseLimit(query: Request["query"]): number {
  const raw = query.limit;
  if (raw == null || raw === "") return 50;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(Math.max(n, 1), 200);
}

function parseSkip(query: Request["query"]): number {
  const raw = query.skip;
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.max(n, 0), 5000);
}

type SortOption = "createdAt_desc" | "createdAt_asc" | "lastActive_desc";
function parseSort(query: Request["query"]): SortOption {
  const raw = String(query.sort ?? "createdAt_desc").trim();
  if (raw === "createdAt_asc" || raw === "lastActive_desc") return raw;
  return "createdAt_desc";
}

function parseNewOnly(query: Request["query"]): boolean {
  return String(query.newOnly ?? "false").trim().toLowerCase() === "true";
}

function parseNewDays(query: Request["query"]): number {
  const raw = query.newDays;
  if (raw == null || raw === "") return 7;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(Math.max(n, 1), 90);
}

function computeSince(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const HEALTH_MS_HOUR = 60 * 60 * 1000;
const HEALTH_MS_DAY = 24 * HEALTH_MS_HOUR;

/** Customer health signals for admin list/detail only (no persistence). */
function computeHealthFlags(params: {
  now: Date;
  createdAt: Date;
  lastActiveAt?: Date | null;
  billingExempt: boolean;
  billingStatus?: string | null;
  trialEndsAt?: Date | null;
  graceEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  workOrders: number;
  invoices: number;
}): string[] {
  const {
    now,
    createdAt,
    lastActiveAt,
    billingExempt,
    billingStatus,
    trialEndsAt,
    graceEndsAt,
    currentPeriodEnd,
    workOrders,
    invoices,
  } = params;

  const createdMs = createdAt.getTime();
  if (!Number.isFinite(createdMs)) return [];

  const nowMs = now.getTime();
  const agedEnough = nowMs - createdMs >= 48 * HEALTH_MS_HOUR;
  const activityAt =
    lastActiveAt != null && Number.isFinite(lastActiveAt.getTime()) ? lastActiveAt : createdAt;
  const activityMs = activityAt.getTime();

  const flags: string[] = [];

  if (nowMs - createdMs < 7 * HEALTH_MS_DAY) {
    flags.push("new_signup");
  }

  if (agedEnough) {
    if (activityMs < nowMs - 3 * HEALTH_MS_DAY) flags.push("inactive_3d");
    if (activityMs < nowMs - 7 * HEALTH_MS_DAY) flags.push("inactive_7d");
    if (workOrders === 0) flags.push("no_first_workorder");
    if (invoices === 0) flags.push("no_first_invoice");
  }

  if (!billingExempt) {
    if (trialEndsAt != null && Number.isFinite(trialEndsAt.getTime())) {
      const trialEndMs = trialEndsAt.getTime();
      if (nowMs < trialEndMs && trialEndMs <= nowMs + 7 * HEALTH_MS_DAY) {
        const cpeValid =
          currentPeriodEnd != null &&
          Number.isFinite(currentPeriodEnd.getTime()) &&
          currentPeriodEnd.getTime() > nowMs;
        const notActivePaid = billingStatus !== "active" || !cpeValid;
        if (notActivePaid) flags.push("trial_ending");
      }
    }

    let billingAttention = false;
    if (billingStatus === "past_due" || billingStatus === "canceled") {
      billingAttention = true;
    }
    if (graceEndsAt != null && Number.isFinite(graceEndsAt.getTime())) {
      const g = graceEndsAt.getTime();
      if (nowMs < g && g <= nowMs + 7 * HEALTH_MS_DAY) billingAttention = true;
    }
    if (trialEndsAt != null && Number.isFinite(trialEndsAt.getTime()) && trialEndsAt.getTime() <= nowMs) {
      billingAttention = true;
    }
    if (billingAttention) flags.push("billing_attention");
  }

  return flags;
}

/** Tenant roles only (exclude admin/superadmin) for q=email match. */
const TENANT_ROLES = ["owner", "manager", "technician"];

// GET /overview?days=7
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query);
    const since = computeSince(days);
    const sinceISO = since.toISOString();

    const [accountsTotal, accountsActive, accountsInactive, eventsByType] =
      await Promise.all([
        Account.countDocuments({}),
        Account.countDocuments({ isActive: true }),
        Account.countDocuments({ isActive: false }),
        Event.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { type: "$_id", count: 1, _id: 0 } },
        ]),
      ]);

    const eventsTotal = eventsByType.reduce((sum, t) => sum + t.count, 0);

    return res.json({
      range: { days, since: sinceISO },
      accounts: {
        total: accountsTotal,
        active: accountsActive,
        inactive: accountsInactive,
      },
      events: {
        total: eventsTotal,
        byType: eventsByType,
      },
    });
  } catch (err) {
    console.error("[admin/beta] GET /overview error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /accounts — V1 list: days, region, status, q, limit, skip, sort, newOnly, newDays
// q matches: Account.name, Account.slug, Settings.shopName; if q looks like email, also match tenant User.email (accountIds only)
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query);
    const region = parseRegion(req.query);
    const status = parseStatus(req.query);
    const q = parseQ(req.query);
    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const sortOption = parseSort(req.query);
    const newOnly = parseNewOnly(req.query);
    const newDaysNum = parseNewDays(req.query);
    const newSince = new Date(Date.now() - newDaysNum * 24 * 60 * 60 * 1000);
    const since = computeSince(days);
    const sinceISO = since.toISOString();

    const accountFilter: Record<string, unknown> = {};
    if (region !== "all") accountFilter.region = region;
    if (status === "active") accountFilter.isActive = true;
    if (status === "inactive") accountFilter.isActive = false;
    if (newOnly) accountFilter.createdAt = { $gte: newSince };

    if (q) {
      const looksLikeEmail = /@/.test(q) || /^[^\s]*\.[^\s]*$/.test(q) || /^[a-z0-9._%+-]+$/i.test(q);
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (looksLikeEmail) {
        const users = await User.find({
          role: { $in: TENANT_ROLES },
          email: re,
        })
          .select("accountId")
          .lean();
        const ids = [...new Set(users.map((u) => (u as { accountId: Types.ObjectId }).accountId))];
        if (ids.length === 0) {
          return res.json({
            range: { days, since: sinceISO },
            region,
            status,
            q,
            paging: { skip, limit, returned: 0, total: 0 },
            items: [],
          });
        }
        accountFilter._id = { $in: ids };
      } else {
        const allForQ = await Account.find(accountFilter).select("_id name slug").lean();
        const aids = allForQ.map((a) => a._id);
        const settings = await Settings.find({ accountId: { $in: aids } }).select("accountId shopName").lean();
        const settingsByAcc = new Map<string, string>();
        for (const s of settings) {
          const id = String((s as { accountId: Types.ObjectId }).accountId);
          settingsByAcc.set(id, (s as { shopName?: string }).shopName ?? "");
        }
        const matchIds = allForQ.filter((a) => {
          const id = String(a._id);
          const name = (a as { name?: string }).name ?? "";
          const slug = (a as { slug?: string }).slug ?? "";
          const shopName = settingsByAcc.get(id) ?? "";
          return re.test(name) || re.test(slug) || re.test(shopName);
        }).map((a) => a._id);
        if (matchIds.length === 0) {
          return res.json({
            range: { days, since: sinceISO },
            region,
            status,
            q,
            paging: { skip, limit, returned: 0, total: 0 },
            items: [],
          });
        }
        accountFilter._id = { $in: matchIds };
      }
    }

    const sortObj: Record<string, 1 | -1> =
      sortOption === "lastActive_desc"
        ? { lastActiveAt: -1, createdAt: -1 }
        : sortOption === "createdAt_asc"
          ? { createdAt: 1 }
          : { createdAt: -1 };

    const [total, accounts] = await Promise.all([
      Account.countDocuments(accountFilter),
      Account.find(accountFilter).sort(sortObj).skip(skip).limit(limit).lean(),
    ]);

    const accountIds = accounts.map((a) => a._id);

    if (accountIds.length === 0) {
      return res.json({
        range: { days, since: sinceISO },
        region,
        status,
        q: q ?? undefined,
        paging: { skip, limit, returned: 0, total },
        items: [],
      });
    }

    const [countsWo, countsWoCompleted, countsInv, countsCust, countsUsers] = await Promise.all([
      WorkOrder.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { accountId: { $in: accountIds } } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ]),
      WorkOrder.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { accountId: { $in: accountIds }, status: "completed" } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ]),
      Invoice.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { accountId: { $in: accountIds } } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ]),
      Customer.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { accountId: { $in: accountIds } } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ]),
      User.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { accountId: { $in: accountIds }, role: { $in: TENANT_ROLES } } },
        { $group: { _id: "$accountId", count: { $sum: 1 } } },
      ]),
    ]);

    const mapCount = (arr: { _id: Types.ObjectId; count: number }[]) => {
      const m = new Map<string, number>();
      for (const x of arr) m.set(String(x._id), x.count);
      return m;
    };
    const woMap = mapCount(countsWo);
    const woCompletedMap = mapCount(countsWoCompleted);
    const invMap = mapCount(countsInv);
    const custMap = mapCount(countsCust);
    const usersMap = mapCount(countsUsers);

    // Primary owner display name per account (for list column)
    const owners = await User.find({
      accountId: { $in: accountIds },
      role: "owner",
      isActive: true,
    })
      .select("accountId displayName name firstName lastName email")
      .lean();
    const primaryOwnerDisplayByAcc = new Map<string, string>();
    for (const o of owners) {
      const accId = String((o as { accountId: Types.ObjectId }).accountId);
      if (primaryOwnerDisplayByAcc.has(accId)) continue;
      const u = o as { displayName?: string; name?: string; firstName?: string; lastName?: string; email?: string };
      const display =
        (u.displayName && u.displayName.trim()) ||
        u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.email ||
        "—";
      primaryOwnerDisplayByAcc.set(accId, display);
    }

    const healthNow = new Date();
    const items = accounts.map((a) => {
      const id = String(a._id);
      const acc = a as {
        name?: string; slug?: string; region?: "Canada" | "TT"; isActive?: boolean; createdAt?: Date; lastActiveAt?: Date;
        accountTags?: string[]; billingExempt?: boolean; billingExemptReason?: string; billingStatus?: string;
        currentPeriodEnd?: Date; graceEndsAt?: Date; trialEndsAt?: Date; adminNotes?: string;
      };
      const createdAtDate = acc.createdAt as Date | undefined;
      const isNew = !!createdAtDate && new Date(createdAtDate).getTime() >= newSince.getTime();
      const wo = woMap.get(id) ?? 0;
      const inv = invMap.get(id) ?? 0;
      const healthFlags = computeHealthFlags({
        now: healthNow,
        createdAt: acc.createdAt as Date,
        lastActiveAt: acc.lastActiveAt,
        billingExempt: acc.billingExempt === true,
        billingStatus: acc.billingStatus,
        trialEndsAt: acc.trialEndsAt,
        graceEndsAt: acc.graceEndsAt,
        currentPeriodEnd: acc.currentPeriodEnd,
        workOrders: wo,
        invoices: inv,
      });
      return {
        accountId: id,
        name: acc.name,
        slug: acc.slug,
        region: acc.region,
        isActive: acc.isActive ?? true,
        createdAt: (acc.createdAt as Date).toISOString(),
        lastActiveAt: acc.lastActiveAt ? (acc.lastActiveAt as Date).toISOString() : undefined,
        isNew,
        primaryOwnerDisplayName: primaryOwnerDisplayByAcc.get(id) ?? "—",
        accountTags: Array.isArray(acc.accountTags) ? acc.accountTags : [],
        billingExempt: acc.billingExempt === true,
        billingExemptReason: acc.billingExemptReason ?? undefined,
        billingStatus: acc.billingStatus ?? undefined,
        currentPeriodEnd: acc.currentPeriodEnd ? (acc.currentPeriodEnd as Date).toISOString() : undefined,
        graceEndsAt: acc.graceEndsAt ? (acc.graceEndsAt as Date).toISOString() : undefined,
        trialEndsAt: acc.trialEndsAt ? (acc.trialEndsAt as Date).toISOString() : undefined,
        adminNotes:
          typeof acc.adminNotes === "string" && acc.adminNotes.length > 0 ? acc.adminNotes : undefined,
        healthFlags,
        counts: {
          workOrders: wo,
          completedWorkOrders: woCompletedMap.get(id) ?? 0,
          invoices: inv,
          customers: custMap.get(id) ?? 0,
          users: usersMap.get(id) ?? 0,
        },
      };
    });

    return res.json({
      range: { days, since: sinceISO },
      region,
      status,
      q: q ?? undefined,
      paging: { skip, limit, returned: items.length, total },
      items,
    });
  } catch (err) {
    console.error("[admin/beta] GET /accounts error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /accounts/:accountId/events — activity timeline (Event model), newest first
router.get("/accounts/:accountId/events", async (req: Request, res: Response) => {
  try {
    const raw = req.params.accountId;
    if (raw == null || raw === "" || !Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ message: "Invalid accountId" });
    }
    const accountId = new Types.ObjectId(raw);
    const exists = await Account.findById(accountId).select("_id").lean();
    if (!exists) {
      return res.status(404).json({ message: "Account not found" });
    }
    const limit = parseEventsLimit(req.query);
    const skip = parseEventsSkip(req.query);
    const events = await Event.find({ accountId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = events.map((ev) => {
      const doc = ev as {
        _id: Types.ObjectId;
        type: string;
        createdAt: Date;
        actorId?: Types.ObjectId;
        actorRole?: string;
        entity?: { kind: string; id: Types.ObjectId };
        meta?: Record<string, unknown>;
      };
      return {
        _id: String(doc._id),
        type: doc.type,
        createdAt: doc.createdAt.toISOString(),
        actorId: doc.actorId ? String(doc.actorId) : undefined,
        actorRole: doc.actorRole ?? undefined,
        entity: doc.entity
          ? { kind: doc.entity.kind, id: String(doc.entity.id) }
          : undefined,
        meta: doc.meta,
      };
    });

    return res.json({
      paging: { skip, limit, returned: items.length },
      items,
    });
  } catch (err) {
    console.error("[admin/beta] GET /accounts/:accountId/events error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /accounts/:accountId/admin-notes — internal notes (admin + superadmin; not tenant-facing)
router.patch("/accounts/:accountId/admin-notes", async (req: Request, res: Response) => {
  try {
    const raw = req.params.accountId;
    if (raw == null || raw === "" || !Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ message: "Invalid accountId" });
    }
    const accountId = new Types.ObjectId(raw);
    const adminActor = (req as any).adminActor;
    if (!adminActor?._id) return res.status(401).json({ message: "Unauthorized" });

    const body = req.body as { adminNotes?: unknown };
    if (!Object.prototype.hasOwnProperty.call(body ?? {}, "adminNotes")) {
      return res.status(400).json({ message: "adminNotes is required (string or null)" });
    }

    const accountBefore = await Account.findById(accountId).lean();
    if (!accountBefore) return res.status(404).json({ message: "Account not found" });

    const beforeNotes =
      typeof (accountBefore as { adminNotes?: string }).adminNotes === "string"
        ? (accountBefore as { adminNotes?: string }).adminNotes
        : null;

    const rawNotes = body.adminNotes;
    if (rawNotes !== null && typeof rawNotes !== "string") {
      return res.status(400).json({ message: "adminNotes must be a string or null" });
    }

    if (rawNotes === null) {
      await Account.updateOne({ _id: accountId }, { $unset: { adminNotes: "" } });
    } else {
      const trimmed = rawNotes.trim();
      if (trimmed.length > ADMIN_NOTES_MAX_LEN) {
        return res
          .status(400)
          .json({ message: `adminNotes must be at most ${ADMIN_NOTES_MAX_LEN} characters` });
      }
      if (trimmed.length === 0) {
        await Account.updateOne({ _id: accountId }, { $unset: { adminNotes: "" } });
      } else {
        await Account.updateOne({ _id: accountId }, { $set: { adminNotes: trimmed } });
      }
    }

    const updated = await Account.findById(accountId).lean();
    const afterNotes =
      updated &&
      typeof (updated as { adminNotes?: string }).adminNotes === "string" &&
      (updated as { adminNotes?: string }).adminNotes!.length > 0
        ? (updated as { adminNotes?: string }).adminNotes!
        : null;

    await trackAdminAudit({
      adminId: adminActor._id,
      action: "account.admin_notes.update",
      targetAccountId: accountId,
      before: { adminNotes: beforeNotes },
      after: { adminNotes: afterNotes },
      ip: (req as any).auditContext?.ip,
      userAgent: (req as any).auditContext?.userAgent,
    });

    return res.status(200).json({
      accountId: accountId.toString(),
      adminNotes: afterNotes ?? undefined,
    });
  } catch (err) {
    console.error("[admin/beta] PATCH /accounts/:accountId/admin-notes error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /accounts/:accountId — single account detail (same shape as list item + shopName, shopCode, primaryOwner)
router.get("/accounts/:accountId", async (req: Request, res: Response) => {
  try {
    const raw = req.params.accountId;
    if (raw == null || raw === "" || !Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ message: "Invalid accountId" });
    }
    const accountId = new Types.ObjectId(raw);
    const account = await Account.findById(accountId).lean();
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const [settings, primaryOwnerUser, countsWo, countsWoCompleted, countsInv, countsCust, countsUsers, seatsAgg] =
      await Promise.all([
      Settings.findOne({ accountId }).select("shopName invoiceProfile").lean(),
      User.findOne({ accountId, role: "owner", isActive: true }).select("name email firstName lastName phone").lean(),
      WorkOrder.countDocuments({ accountId }),
      WorkOrder.countDocuments({ accountId, status: "completed" }),
      Invoice.countDocuments({ accountId }),
      Customer.countDocuments({ accountId }),
      User.countDocuments({ accountId, role: { $in: TENANT_ROLES } }),
      User.aggregate<{ _id: string; count: number }>([
        { $match: { accountId, isActive: true, role: { $in: TENANT_ROLES } } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
    ]);

    const id = String(account._id);
    const acc = account as {
      name?: string; slug?: string; region?: "Canada" | "TT"; isActive?: boolean; createdAt?: Date; lastActiveAt?: Date;
      accountTags?: string[]; billingExempt?: boolean; billingExemptReason?: string; billingStatus?: string;
      currentPeriodEnd?: Date; graceEndsAt?: Date; trialEndsAt?: Date; adminNotes?: string;
    };
    const owner = primaryOwnerUser as { name?: string; email?: string; firstName?: string; lastName?: string; phone?: string } | null;
    const shopName = (settings as { shopName?: string } | null)?.shopName ?? acc.name ?? undefined;
    const invoiceProfile = (settings as { invoiceProfile?: { address?: string } } | null)?.invoiceProfile;
    const address = invoiceProfile?.address?.trim() || undefined;
    const primaryOwner = owner
      ? {
          name: owner.name || [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.email || "—",
          email: owner.email ?? undefined,
          phone: owner.phone ?? undefined,
        }
      : undefined;

    // Compute seats: active users grouped by role
    const seatsMap = new Map<string, number>();
    for (const item of seatsAgg) {
      seatsMap.set(item._id, item.count);
    }
    const seatsOwner = seatsMap.get("owner") ?? 0;
    const seatsManager = seatsMap.get("manager") ?? 0;
    const seatsTechnician = seatsMap.get("technician") ?? 0;
    const seatsTotal = seatsOwner + seatsManager + seatsTechnician;

    const detailNow = new Date();
    const healthFlags = computeHealthFlags({
      now: detailNow,
      createdAt: acc.createdAt as Date,
      lastActiveAt: acc.lastActiveAt,
      billingExempt: acc.billingExempt === true,
      billingStatus: acc.billingStatus,
      trialEndsAt: acc.trialEndsAt,
      graceEndsAt: acc.graceEndsAt,
      currentPeriodEnd: acc.currentPeriodEnd,
      workOrders: countsWo,
      invoices: countsInv,
    });

    return res.json({
      accountId: id,
      name: acc.name,
      slug: acc.slug,
      shopName: shopName ?? undefined,
      shopCode: acc.slug ?? undefined,
      region: acc.region,
      isActive: acc.isActive ?? true,
      createdAt: (acc.createdAt as Date).toISOString(),
      lastActiveAt: acc.lastActiveAt ? (acc.lastActiveAt as Date).toISOString() : undefined,
      accountTags: Array.isArray(acc.accountTags) ? acc.accountTags : [],
      billingExempt: acc.billingExempt === true,
      billingExemptReason: acc.billingExemptReason ?? undefined,
      billingStatus: acc.billingStatus ?? undefined,
      currentPeriodEnd: acc.currentPeriodEnd ? (acc.currentPeriodEnd as Date).toISOString() : undefined,
      graceEndsAt: acc.graceEndsAt ? (acc.graceEndsAt as Date).toISOString() : undefined,
      trialEndsAt: acc.trialEndsAt ? (acc.trialEndsAt as Date).toISOString() : undefined,
      adminNotes:
        typeof acc.adminNotes === "string" && acc.adminNotes.length > 0 ? acc.adminNotes : undefined,
      healthFlags,
      primaryOwner,
      address,
      seats: {
        owner: seatsOwner,
        manager: seatsManager,
        technician: seatsTechnician,
        total: seatsTotal,
      },
      counts: {
        workOrders: countsWo,
        completedWorkOrders: countsWoCompleted,
        invoices: countsInv,
        customers: countsCust,
        users: countsUsers,
      },
    });
  } catch (err) {
    console.error("[admin/beta] GET /accounts/:accountId error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/*
 * Example curl (token in $ADMIN_TOKEN, x-auth-token):
 *   curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/beta/overview?days=7"
 *   curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/beta/accounts?days=7&region=all&status=all&limit=50&skip=0"
 *   curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/beta/accounts?region=Canada&status=active&q=caruso"
 *   curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/beta/accounts?q=user@example.com"
 *   curl -s -H "x-auth-token: $SUPER_TOKEN" "http://localhost:4000/api/admin/beta/accounts/<ACCOUNT_ID>" | jq
 */

export default router;
