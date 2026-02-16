// backend/src/scripts/seedBillingPhaseTest.ts
// Local-only seed for billing phase testing. Do not use in production.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Account } from "../models/account.model";
import { User } from "../models/user.model";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/caruso-service-manager";

const ACCOUNT_NAME = "Billing Phase Test";
const ACCOUNT_SLUG = "billing-phase-test";
const OWNER_EMAIL = "owner@billingtest.local";
const OWNER_PASSWORD = "demo123";

async function main() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);

    // Create or find account (idempotent). No demo/sales/internal tags; billingExempt false.
    let account = await Account.findOne({ slug: ACCOUNT_SLUG });

    if (!account) {
      account = await Account.create({
        name: ACCOUNT_NAME,
        slug: ACCOUNT_SLUG,
        isActive: true,
        accountTags: [],
        billingExempt: false,
      });
      console.log("✅ Created account:", account.name);
    } else {
      console.log("ℹ️ Found existing account:", account.name);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(OWNER_PASSWORD, saltRounds);

    const ownerEmailLower = OWNER_EMAIL.toLowerCase().trim();
    let owner = await User.findOne({
      accountId: account._id,
      email: ownerEmailLower,
    });

    if (!owner) {
      owner = await User.create({
        accountId: account._id,
        email: ownerEmailLower,
        name: "Billing Test Owner",
        role: "owner",
        passwordHash,
        isActive: true,
      });
      console.log("✅ Created owner user:", owner.email);
    } else {
      owner.passwordHash = passwordHash;
      owner.isActive = true;
      await owner.save();
      console.log("ℹ️ Updated existing owner user:", owner.email);
    }

    console.log("\n✅ Billing phase test seed complete!");
    console.log("Account ID:", account._id.toString());
    console.log("Owner email:", owner.email);
    console.log("\n👉 Login with POST /api/auth/login: email, password, shopCode =", ACCOUNT_SLUG);
  } catch (err) {
    console.error("❌ Error seeding billing phase test:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
