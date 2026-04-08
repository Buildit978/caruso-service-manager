import { Router, type Request, type Response, type NextFunction } from "express";
import { Types } from "mongoose";
import { Account } from "../models/account.model";
import { Settings } from "../models/settings.model";
import { User } from "../models/user.model";
import { WorkOrder } from "../models/workOrder.model";

const router = Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function requireAutomationSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.AUTOMATION_ONBOARDING_SECRET;
  if (!secret || typeof secret !== "string") {
    return res.status(503).json({ message: "Automation onboarding is not configured" });
  }
  const got = req.header("x-automation-secret");
  if (got !== secret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

router.use(requireAutomationSecret);

function notYetNudged(field: "day3NudgeSentAt" | "day7NudgeSentAt") {
  return {
    $or: [{ [field]: { $exists: false } }, { [field]: null }],
  };
}

/** ~N days ago: 24h window centered on N days after signup */
function signupWindowBounds(days: number): { lower: Date; upper: Date } {
  const now = Date.now();
  return {
    lower: new Date(now - (days + 0.5) * MS_PER_DAY),
    upper: new Date(now - (days - 0.5) * MS_PER_DAY),
  };
}

async function buildOnboardingList(opts: {
  days: number;
  nudgeField: "day3NudgeSentAt" | "day7NudgeSentAt";
}): Promise<
  Array<{
    accountId: string;
    email: string;
    name: string;
    shopName: string;
    createdAt: string;
  }>
> {
  const { lower, upper } = signupWindowBounds(opts.days);

  const accounts = await Account.find({
    isActive: true,
    createdAt: { $gte: lower, $lt: upper },
    ...notYetNudged(opts.nudgeField),
  })
    .select("_id name createdAt")
    .lean();

  const out: Array<{
    accountId: string;
    email: string;
    name: string;
    shopName: string;
    createdAt: string;
  }> = [];

  for (const acc of accounts) {
    const id = acc._id as Types.ObjectId;
    const woCount = await WorkOrder.countDocuments({ accountId: id });
    if (woCount > 0) continue;

    const [settings, owner] = await Promise.all([
      Settings.findOne({ accountId: id }).select("shopName").lean(),
      User.findOne({ accountId: id, role: "owner", isActive: true }).select("email name").lean(),
    ]);

    const shopName =
      (settings && typeof (settings as { shopName?: string }).shopName === "string"
        ? (settings as { shopName: string }).shopName.trim()
        : "") ||
      (typeof acc.name === "string" ? acc.name : "") ||
      "";

    out.push({
      accountId: id.toString(),
      email: owner?.email ?? "",
      name: owner?.name ?? "",
      shopName,
      createdAt: (acc.createdAt as Date).toISOString(),
    });
  }

  return out;
}

/**
 * GET /api/automation/onboarding-status
 * Protected by header x-automation-secret matching AUTOMATION_ONBOARDING_SECRET.
 */
router.get("/onboarding-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [day3, day7] = await Promise.all([
      buildOnboardingList({ days: 3, nudgeField: "day3NudgeSentAt" }),
      buildOnboardingList({ days: 7, nudgeField: "day7NudgeSentAt" }),
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      day3,
      day7,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/automation/onboarding-status/mark-sent
 * Same auth as GET (x-automation-secret).
 */
router.post("/onboarding-status/mark-sent", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, stage } = req.body as { accountId?: unknown; stage?: unknown };
    if (accountId == null || typeof accountId !== "string" || !accountId.trim()) {
      return res.status(400).json({ message: "accountId is required" });
    }
    if (!Types.ObjectId.isValid(accountId.trim())) {
      return res.status(400).json({ message: "accountId must be a valid id" });
    }
    if (stage !== "day3" && stage !== "day7") {
      return res.status(400).json({ message: 'stage is required and must be "day3" or "day7"' });
    }

    const field = stage === "day3" ? "day3NudgeSentAt" : "day7NudgeSentAt";
    const now = new Date();
    const result = await Account.updateOne(
      { _id: new Types.ObjectId(accountId.trim()) },
      { $set: { [field]: now } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Account not found" });
    }

    return res.status(200).json({
      ok: true,
      accountId: accountId.trim(),
      stage,
      [field]: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
