import type { Request, Response, NextFunction } from "express";
import { Account } from "../models/account.model";

/**
 * Requires account billing to be active, in trial, or within grace.
 * Uses req.accountId (set by requireAuth). Does not assume req.account exists.
 * Allow (in order):
 *   0. billingExempt === true (demo/internal/sales)
 *   1. billingStatus === "active"
 *   2. trialEndsAt exists AND trialEndsAt > now
 *   3. billingStatus === "past_due" AND graceEndsAt > now
 * Otherwise: 402 with BILLING_LOCKED payload.
 * 401 if no accountId or account not found.
 */
export async function requireBillingActive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const accountId = (req as any).accountId;
  if (!accountId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const account = await Account.findById(accountId)
    .select("billingStatus graceEndsAt currentPeriodEnd trialEndsAt billingExempt")
    .lean();

  if (!account) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (account.billingExempt === true) {
    next();
    return;
  }

  const { billingStatus, graceEndsAt, currentPeriodEnd, trialEndsAt } =
    account;
  const now = new Date();

  if (billingStatus === "active") {
    next();
    return;
  }

  if (trialEndsAt && new Date(trialEndsAt) > now) {
    next();
    return;
  }

  if (
    billingStatus === "past_due" &&
    graceEndsAt &&
    new Date(graceEndsAt) > now
  ) {
    next();
    return;
  }

  res.status(402).json({
    code: "BILLING_LOCKED",
    message:
      billingStatus === "past_due"
        ? "Subscription is past due and grace period has ended"
        : "Subscription is not active",
    billingStatus: billingStatus ?? null,
    graceEndsAt: graceEndsAt ? new Date(graceEndsAt).toISOString() : null,
    currentPeriodEnd: currentPeriodEnd
      ? new Date(currentPeriodEnd).toISOString()
      : null,
    trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
  });
}

/**
 * Alias for requireBillingActive.
 * V1 keeps behavior identical while giving routes a clearer name.
 */
export async function requireActiveBilling(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return requireBillingActive(req, res, next);
}

