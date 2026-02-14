import express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";

import { Account } from "../models/account.model";
import { WebhookEvent } from "../models/webhookEvent.model";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// GET /api/billing/status
router.get("/status", async (req: any, res) => {
  try {
    const accountId = (req as any).accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Missing accountId" });
    }

    const account = await Account.findById(accountId)
      .select("billingStatus currentPeriodEnd graceEndsAt trialEndsAt")
      .lean();

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const now = new Date();

    const billingStatus = account.billingStatus ?? null;
    const trialEndsAtDate = account.trialEndsAt
      ? new Date(account.trialEndsAt)
      : null;
    const graceEndsAtDate = account.graceEndsAt
      ? new Date(account.graceEndsAt)
      : null;
    const currentPeriodEndDate = account.currentPeriodEnd
      ? new Date(account.currentPeriodEnd)
      : null;

    let locked = false;
    let reason: "active" | "trial" | "grace" | "locked" = "locked";
    let lockDate: Date | null = null;

    // 1) Active and safely within current period → fully unlocked
    if (
      billingStatus === "active" &&
      currentPeriodEndDate &&
      currentPeriodEndDate > now
    ) {
      locked = false;
      reason = "active";
      lockDate = null;
    } else {
      // 2) Trial window
      if (trialEndsAtDate && trialEndsAtDate > now) {
        locked = false;
        reason = "trial";
        lockDate = trialEndsAtDate;
      }
      // 3) Past-due grace window
      else if (
        billingStatus === "past_due" &&
        graceEndsAtDate &&
        graceEndsAtDate > now
      ) {
        locked = false;
        reason = "grace";
        lockDate = graceEndsAtDate;
      } else {
        // 4) Fully locked
        locked = true;
        reason = "locked";
        lockDate = null;
      }
    }

    let daysUntilLock: number | null = null;
    if (lockDate) {
      const msDiff = lockDate.getTime() - now.getTime();
      daysUntilLock = Math.ceil(msDiff / 86_400_000);
    }

    let warning: "7_day" | "3_day" | null = null;
    if (!locked && daysUntilLock !== null) {
      if (daysUntilLock <= 3) {
        warning = "3_day";
      } else if (daysUntilLock <= 7) {
        warning = "7_day";
      }
    }

    // Compute lockedContext ONLY when locked === true
    let lockedContext: "trial_ended" | "payment_required" | "past_due_ended" | null = null;
    if (locked) {
      if (trialEndsAtDate && trialEndsAtDate <= now) {
        lockedContext = "trial_ended";
      } else if (billingStatus === "past_due") {
        lockedContext = "past_due_ended";
      } else if (billingStatus === "active") {
        lockedContext = "payment_required";
      } else {
        lockedContext = "payment_required";
      }
    }

    const showBillingCta = locked || warning !== null || reason === "grace";

    return res.json({
      locked,
      reason,
      lockDate: lockDate ? lockDate.toISOString() : null,
      daysUntilLock,
      warning,
      showBillingCta,
      lockedContext,
      billingStatus,
      trialEndsAt: trialEndsAtDate ? trialEndsAtDate.toISOString() : null,
      graceEndsAt: graceEndsAtDate ? graceEndsAtDate.toISOString() : null,
      currentPeriodEnd: currentPeriodEndDate
        ? currentPeriodEndDate.toISOString()
        : null,
    });
  } catch (err: any) {
    console.error("[GET /api/billing/status] error", err);
    return res.status(500).json({ message: "Failed to compute billing status" });
  }
});

router.post("/checkout-session", async (req: any, res) => {
  try {
    const priceId = process.env.STRIPE_PRICE_ID!;
    const appUrl = process.env.APP_URL!;

    if (!priceId || !appUrl) {
      return res.status(500).json({ message: "Billing not configured (missing env vars)" });
    }

    // ✅ Derive identity from existing auth middleware (requireAuth)
    const accountId = (req as any).accountId;
    const actor = (req as any).actor;

    if (!accountId || !actor?._id || !actor?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = actor._id;
    const email = String(actor.email);

    const account = await Account.findById(accountId);
    if (!account) return res.status(404).json({ message: "Account not found" });

    // Create or reuse Stripe Customer
    let customerId = account.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          accountId: String(accountId),
        },
      });
      customerId = customer.id;
      account.stripeCustomerId = customerId;
      await account.save();
    }

    // Create Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(accountId),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings/billing?success=1`,
      cancel_url: `${appUrl}/settings/billing?canceled=1`,
      allow_promotion_codes: false,
      subscription_data: {
        metadata: {
          accountId: String(accountId),
          ownerUserId: String(userId),
        },
      },
      metadata: {
        accountId: String(accountId),
        ownerUserId: String(userId),
      },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout-session error", err);
    return res.status(500).json({ message: "Failed to create checkout session" });
  }
});

router.post("/portal-session", async (req: any, res) => {
  try {
    const accountId = (req as any).accountId;
    const actor = (req as any).actor;
    const appUrl = process.env.APP_URL!;

    if (!accountId || !actor?._id || !actor?.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (actor.role !== "owner") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!appUrl) {
      return res.status(500).json({ message: "Billing not configured (missing APP_URL)" });
    }

    const account = await Account.findById(accountId).select("stripeCustomerId");
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const stripeCustomerId = account.stripeCustomerId;
    if (!stripeCustomerId) {
      return res.status(400).json({ message: "No Stripe customer on file" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("portal-session error", err);
    return res.status(500).json({ message: "Failed to create billing portal session" });
  }
});

function sevenDaysFromNow() {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  return now;
}

async function getSubscriptionById(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription as unknown as Stripe.Subscription;
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const anyInvoice = invoice as any;
  const subscription = anyInvoice.subscription;
  if (!subscription) return undefined;
  return typeof subscription === "string" ? subscription : subscription.id;
}

/** Resolve Account for a subscription: metadata.accountId → stripeSubscriptionId → stripeCustomerId. Returns null if not found. */
async function resolveAccountForSubscription(subscription: {
  id: string;
  metadata?: { accountId?: string } | null;
  customer?: string | { id?: string } | null;
}): Promise<InstanceType<typeof Account> | null> {
  const raw = subscription as any;
  const subId = String(subscription.id || "").trim();
  const customerId =
    typeof raw.customer === "string"
      ? raw.customer.trim()
      : raw.customer?.id
        ? String(raw.customer.id).trim()
        : undefined;

  const accountId = raw.metadata?.accountId;
  if (accountId) {
    const byId = await Account.findById(accountId);
    if (byId) return byId;
  }
  const bySub = await Account.findOne({ stripeSubscriptionId: subId });
  if (bySub) return bySub;
  if (customerId) {
    const byCustomerDoc = await Account.findOne({ stripeCustomerId: customerId });
    if (byCustomerDoc) return byCustomerDoc;
  }
  return null;
}

async function applyActiveBillingFromSubscription(subscriptionId: string) {
  const subscription = await getSubscriptionById(subscriptionId);
  const account = await resolveAccountForSubscription(subscription);
  if (!account) {
    console.log("[billing] APPLY ACTIVE FAILED: account not resolved", {
      subscriptionIdParam: subscriptionId,
      subscriptionIdFromStripe: subscription.id,
      customer: (subscription as any).customer,
      metaAccountId: (subscription as any).metadata?.accountId
    });
    return;
  }

  const raw = subscription as any;
  const customerId: string | undefined =
    raw.customer == null
      ? undefined
      : typeof raw.customer === "string"
        ? raw.customer
        : raw.customer?.id;
  const periodEndDate = raw.current_period_end ? new Date(raw.current_period_end * 1000) : undefined;

  const set: Record<string, unknown> = {
    billingStatus: "active",
    stripeSubscriptionId: subscription.id,
  };
  if (customerId) set.stripeCustomerId = String(customerId).trim();
  if (periodEndDate) set.currentPeriodEnd = periodEndDate;

  const unset: Record<string, 1> = { trialEndsAt: 1, graceEndsAt: 1 };

  await Account.updateOne({ _id: account._id }, { $set: set, $unset: unset });

  console.log("[billing] applyActiveBillingFromSubscription", {
    accountId: account._id.toString(),
    subscriptionId,
    currentPeriodEnd: periodEndDate ? periodEndDate.toISOString() : null,
  });
}

async function applyActiveBillingFromInvoice(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (subscriptionId) {
    await applyActiveBillingFromSubscription(subscriptionId);
    return;
  }

  const raw = invoice as any;
  const customerId = typeof raw.customer === "string" ? raw.customer : raw.customer?.id;
  if (!customerId) return;

  const account = await Account.findOne({ stripeCustomerId: String(customerId).trim() });
  if (!account) {
    console.log("[billing] APPLY ACTIVE INVOICE FAILED: account not found by customer", { customerId });
    return;
  }

  const periodEndSec =
    raw?.lines?.data?.[0]?.period?.end ??
    raw?.period_end;

  account.billingStatus = "active";
  account.graceEndsAt = undefined;
  if (periodEndSec) {
    account.currentPeriodEnd = new Date(periodEndSec * 1000);
  }

  await account.save();
}

async function applyPastDueFromInvoice(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const subscription = await getSubscriptionById(subscriptionId);
  const account = await resolveAccountForSubscription(subscription);
  if (!account) return;

  account.billingStatus = "past_due";
  const proposedGrace = sevenDaysFromNow();
  if (!account.graceEndsAt || account.graceEndsAt < proposedGrace) {
    account.graceEndsAt = proposedGrace;
  }

  await account.save();
}

async function applyCanceledFromSubscription(subscription: Stripe.Subscription) {
  const account = await resolveAccountForSubscription(subscription as any);
  if (!account) return;

  const raw = subscription as any;
  account.billingStatus = "canceled";
  account.currentPeriodEnd = raw.current_period_end
    ? new Date(raw.current_period_end * 1000)
    : undefined;
  account.graceEndsAt = undefined;
  // Keep stripeSubscriptionId for audit/debug

  await account.save();
}

export const billingWebhookHandler = async (req: express.Request, res: express.Response) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Webhook not configured");
  }

  if (!sig || typeof sig !== "string") {
    return res.status(400).send("Missing Stripe-Signature header");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body as any, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Stripe webhook signature verification failed", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err.message || "invalid signature"}`);
  }

  let webhookRecord: InstanceType<typeof WebhookEvent> | null = null;

  try {
    webhookRecord = await WebhookEvent.create({
      eventId: event.id,
      type: event.type,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(200).json({ received: true, duplicate: true });
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.metadata?.accountId || session.client_reference_id;
        if (accountId) {
          const account = await Account.findById(accountId);
          if (account) {
            if (session.customer && typeof session.customer === "string") {
              account.stripeCustomerId = session.customer;
            }
            const subscriptionId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id;
            if (subscriptionId) {
              account.stripeSubscriptionId = subscriptionId;
            }
            await account.save();
            if (subscriptionId) {
              await applyActiveBillingFromSubscription(subscriptionId);
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await applyActiveBillingFromInvoice(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await applyPastDueFromInvoice(invoice);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await applyCanceledFromSubscription(subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = (subscription as any).status;
        if (status === "active" || status === "trialing") {
          await applyActiveBillingFromSubscription(subscription.id);
        }
        break;
      }

      default:
        // Unhandled event types are still acknowledged to Stripe
        break;
    }

    if (webhookRecord) {
      webhookRecord.processedAt = new Date();
      await webhookRecord.save();
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("❌ Error handling Stripe webhook", err);
    return res.status(500).send("Webhook processing failed");
  }
};

export default router;
