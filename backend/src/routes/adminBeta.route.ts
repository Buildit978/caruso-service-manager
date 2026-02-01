// backend/src/routes/adminBeta.route.ts
import { Router, type Request, type Response } from "express";
import { Account } from "../models/account.model";
import { Settings } from "../models/settings.model";
import { Event } from "../models/event.model";

const router = Router();

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

function parseLimit(query: Request["query"]): number {
  const raw = query.limit;
  if (raw == null || raw === "") return 200;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 200;
  return Math.min(Math.max(n, 1), 500);
}

function parseSkip(query: Request["query"]): number {
  const raw = query.skip;
  if (raw == null || raw === "") return 0;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.max(n, 0), 5000);
}

function computeSince(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

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

// GET /accounts?days=7&region=Canada|TT|all&limit=200&skip=0
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const days = parseDays(req.query);
    const region = parseRegion(req.query);
    const limit = parseLimit(req.query);
    const skip = parseSkip(req.query);
    const since = computeSince(days);
    const sinceISO = since.toISOString();

    const accounts = await Account.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const accountIds = accounts.map((a) => a._id);

    const eventMatch: Record<string, unknown> = {
    createdAt: { $gte: since },
    accountId: { $in: accountIds },
  };

    if (region !== "all") {
      eventMatch["meta.region"] = region;
    }

    const usageAggPipeline = [
      { $match: eventMatch },
      {
        $group: {
          _id: { accountId: "$accountId", type: "$type" },
          count: { $sum: 1 },
          lastAt: { $max: "$createdAt" },
        },
      },
      {
        $group: {
          _id: "$_id.accountId",
          byType: { $push: { type: "$_id.type", count: "$count" } },
          lastEventAt: { $max: "$lastAt" },
          totalEvents: { $sum: "$count" },
        },
      },
    ];

    const [settings, usageAgg] = await Promise.all([
      accountIds.length > 0
        ? Settings.find({ accountId: { $in: accountIds } }).lean()
        : Promise.resolve([]),
      Event.aggregate(usageAggPipeline).exec(),
    ]);

    const settingsMap = new Map<string, { shopName?: string; roleAccess?: { managersEnabled: boolean; techniciansEnabled: boolean } }>();
    for (const s of settings) {
      const id = String((s as any).accountId);
      settingsMap.set(id, {
        shopName: (s as any).shopName,
        roleAccess: (s as any).roleAccess,
      });
    }

    const usageMap = new Map<string, { lastEventAt?: Date; totalEvents: number; byType: Record<string, number> }>();
    for (const u of usageAgg) {
      const id = String(u._id);
      const byType: Record<string, number> = {};
      for (const t of u.byType) {
        byType[t.type] = t.count;
      }
      usageMap.set(id, {
        lastEventAt: u.lastEventAt,
        totalEvents: u.totalEvents ?? 0,
        byType,
      });
    }

    const items = accounts.map((a) => {
      const id = String(a._id);
      const s = settingsMap.get(id);
      const u = usageMap.get(id) ?? { totalEvents: 0, byType: {} };
      return {
        accountId: id,
        name: a.name,
        slug: a.slug,
        isActive: a.isActive ?? true,
        createdAt: (a.createdAt as Date).toISOString(),
        lastActiveAt: a.lastActiveAt ? (a.lastActiveAt as Date).toISOString() : undefined,
        shopName: s?.shopName,
        roleAccess: s?.roleAccess,
        usage: {
          lastEventAt: u.lastEventAt ? new Date(u.lastEventAt).toISOString() : undefined,
          totalEvents: u.totalEvents,
          byType: u.byType,
        },
      };
    });

    return res.json({
      range: { days, since: sinceISO },
      region,
      paging: { skip, limit, returned: items.length },
      items,
    });
  } catch (err) {
    console.error("[admin/beta] GET /accounts error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/*
 * Example curl (token in $ADMIN_TOKEN, x-auth-token):
 *   curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/beta/overview?days=7"
 *   curl -H "x-auth-token: $ADMIN_TOKEN" "http://localhost:4000/api/admin/beta/accounts?days=7&region=all"
 */

export default router;
