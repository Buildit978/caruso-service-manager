import express from "express";
import Stripe from "stripe";

import { Account } from "../models/account.model";
import { WebhookEvent } from "../models/webhookEvent.model";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
  const accountId = raw.metadata?.accountId;
  if (accountId) {
    const byId = await Account.findById(accountId);
    if (byId) return byId;
  }
  const bySub = await Account.findOne({ stripeSubscriptionId: subscription.id });
  if (bySub) return bySub;
  const customerId =
    typeof raw.customer === "string" ? raw.customer : raw.customer?.id;
  if (customerId) {
    const byCustomer = await Account.findOne({ stripeCustomerId: customerId });
    if (byCustomer) return byCustomer;
  }
  return null;
}

async function applyActiveBillingFromSubscription(subscriptionId: string) {
  const subscription = await getSubscriptionById(subscriptionId);
  const account = await resolveAccountForSubscription(subscription);
  if (!account) return;

  const raw = subscription as any;
  account.billingStatus = "active";
  account.stripeSubscriptionId = subscription.id;
  if (raw.current_period_end) {
    account.currentPeriodEnd = new Date(raw.current_period_end * 1000);
  }
  account.graceEndsAt = undefined;
  if (raw.customer) {
    const customerId = typeof raw.customer === "string" ? raw.customer : raw.customer?.id;
    if (customerId) account.stripeCustomerId = customerId;
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
        const accountId = session.metadata?.accountId;
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
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getSubscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          await applyActiveBillingFromSubscription(subscriptionId);
        }
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
