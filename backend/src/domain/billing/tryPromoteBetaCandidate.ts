/**
 * Tries to promote a beta candidate account to beta tester (isBetaTester=true).
 * Only promotes if: candidate eligible, within 7-day window, activation threshold met,
 * and fewer than 10 current beta testers. Idempotent and safe under concurrency.
 */
import { Types } from "mongoose";
import { Account } from "../../models/account.model";

const BETA_SLOTS_ID = "betaTesterSlots";
const BETA_MAX = 10;
const CANDIDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BETA_TRIAL_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const WORK_ORDERS_THRESHOLD = 3;
const INVOICES_THRESHOLD = 3;

export type TryPromoteBetaCandidateResult = { promoted: boolean };

/**
 * Ensures the beta-tester slot counter document exists and is in sync with
 * current Account.isBetaTester count. Caller must have already confirmed
 * the account is a candidate so we only init when missing.
 */
async function ensureSlotCounter(): Promise<void> {
  const coll = Account.db.collection<{ _id: string; count: number }>(BETA_SLOTS_ID);
  const doc = await coll.findOne({ _id: BETA_SLOTS_ID });
  if (doc != null) return;
  const count = await Account.countDocuments({ isBetaTester: true });
  try {
    await coll.insertOne({ _id: BETA_SLOTS_ID, count });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 11000) {
      return;
    }
    throw err;
  }
}

/**
 * Atomically claim one beta slot (only if count < 10). Returns true if a slot was claimed.
 */
async function claimSlot(): Promise<boolean> {
  const coll = Account.db.collection<{ _id: string; count: number }>(BETA_SLOTS_ID);
  const result = await coll.findOneAndUpdate(
    { _id: BETA_SLOTS_ID, count: { $lt: BETA_MAX } },
    { $inc: { count: 1 } },
    { returnDocument: "after" }
  );
  return result != null && result.count <= BETA_MAX;
}

/**
 * Release a previously claimed slot (e.g. when account update failed).
 */
async function releaseSlot(): Promise<void> {
  const coll = Account.db.collection<{ _id: string; count: number }>(BETA_SLOTS_ID);
  await coll.updateOne({ _id: BETA_SLOTS_ID, count: { $gt: 0 } }, { $inc: { count: -1 } });
}

/**
 * Try to promote the given account to beta tester. Only promotes when:
 * - betaCandidate === true, isBetaTester !== true, betaCandidateSince exists
 * - now <= betaCandidateSince + 7 days
 * - betaActivation.workOrdersCreated >= 3 and betaActivation.invoicesCreated >= 3
 * - current beta tester count < 10 (enforced via atomic slot counter)
 * On promotion: sets isBetaTester=true, betaActivatedAt=now, trialEndsAt=betaCandidateSince+60d, betaCandidate=false.
 * Idempotent: already-promoted accounts are not updated again.
 */
export async function tryPromoteBetaCandidate(
  accountId: Types.ObjectId | string
): Promise<TryPromoteBetaCandidateResult> {
  const id = typeof accountId === "string" ? accountId : accountId.toString();
  if (!Types.ObjectId.isValid(id)) return { promoted: false };

  const account = await Account.findById(id)
    .select("betaCandidate isBetaTester betaCandidateSince betaActivation")
    .lean();

  if (
    !account ||
    account.betaCandidate !== true ||
    account.isBetaTester === true ||
    !account.betaCandidateSince
  ) {
    return { promoted: false };
  }

  const now = new Date();
  const since = new Date(account.betaCandidateSince);
  const windowEnd = new Date(since.getTime() + CANDIDATE_WINDOW_MS);
  if (now > windowEnd) {
    await Account.updateOne(
      {
        _id: new Types.ObjectId(id),
        betaCandidate: true,
        isBetaTester: { $ne: true },
        betaCandidateSince: { $exists: true },
      },
      { $set: { betaCandidate: false } }
    );
    return { promoted: false };
  }

  const wo = (account.betaActivation?.workOrdersCreated ?? 0) >= WORK_ORDERS_THRESHOLD;
  const inv = (account.betaActivation?.invoicesCreated ?? 0) >= INVOICES_THRESHOLD;
  if (!wo || !inv) return { promoted: false };

  await ensureSlotCounter();
  const slotClaimed = await claimSlot();
  if (!slotClaimed) return { promoted: false };

  const trialEndsAt = new Date(since.getTime() + BETA_TRIAL_DAYS_MS);
  const updateResult = await Account.updateOne(
    {
      _id: new Types.ObjectId(id),
      betaCandidate: true,
      isBetaTester: { $ne: true },
      betaCandidateSince: { $exists: true },
    },
    {
      $set: {
        isBetaTester: true,
        betaActivatedAt: now,
        trialEndsAt,
        betaCandidate: false,
      },
    }
  );

  if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
    await releaseSlot();
    return { promoted: false };
  }

  return { promoted: true };
}

/** Filter + window for beta candidate (within 7 days of betaCandidateSince). */
function betaCandidateInWindowFilter(accountId: Types.ObjectId | string) {
  const id = typeof accountId === "string" ? accountId : accountId.toString();
  const windowStart = new Date(Date.now() - CANDIDATE_WINDOW_MS);
  return {
    _id: new Types.ObjectId(id),
    betaCandidate: true,
    isBetaTester: { $ne: true },
    betaCandidateSince: { $exists: true, $gte: windowStart },
  };
}

/**
 * Best-effort: increment Account.betaActivation.workOrdersCreated by 1 when account
 * is a beta candidate in window, then try to promote. Never throws; logs on error.
 */
export async function trackBetaWorkOrderCreated(
  accountId: Types.ObjectId | string
): Promise<void> {
  try {
    if (!Types.ObjectId.isValid(typeof accountId === "string" ? accountId : accountId.toString())) {
      return;
    }
    await Account.updateOne(betaCandidateInWindowFilter(accountId), {
      $inc: { "betaActivation.workOrdersCreated": 1 },
    });
    await tryPromoteBetaCandidate(accountId);
  } catch (err) {
    console.error("[trackBetaWorkOrderCreated]", err);
  }
}

/**
 * Best-effort: increment Account.betaActivation.invoicesCreated by 1 when account
 * is a beta candidate in window, then try to promote. Never throws; logs on error.
 */
export async function trackBetaInvoiceCreated(
  accountId: Types.ObjectId | string
): Promise<void> {
  try {
    if (!Types.ObjectId.isValid(typeof accountId === "string" ? accountId : accountId.toString())) {
      return;
    }
    await Account.updateOne(betaCandidateInWindowFilter(accountId), {
      $inc: { "betaActivation.invoicesCreated": 1 },
    });
    await tryPromoteBetaCandidate(accountId);
  } catch (err) {
    console.error("[trackBetaInvoiceCreated]", err);
  }
}
