/**
 * One-off script: ensure an Account with slug "system" exists.
 * Used so getSystemAccount() and admin login work in production.
 *
 * Run from backend/: npx tsx src/scripts/ensureSystemAccount.ts
 * Production: MONGO_URI=<prod-uri> npx tsx src/scripts/ensureSystemAccount.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Account } from "../models/account.model";

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("❌ Missing required env: MONGO_URI");
    process.exit(1);
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    const existing = await Account.findOne({ slug: "system" });
    if (existing) {
      console.log("✅ System account already exists");
      console.log("   _id:", existing._id.toString());
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    const account = await Account.create({
      name: "System",
      slug: "system",
      isActive: true,
    });
    console.log("✅ Created System account");
    console.log("   _id:", account._id.toString());
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error ensuring system account:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
