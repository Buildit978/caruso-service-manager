// backend/src/scripts/seedFirstShop.ts
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Account } from "../models/account.model";
import { User } from "../models/user.model";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/caruso-service-manager";

async function main() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);

    // Read values from env or CLI args
    const accountName = process.argv[2] || process.env.SEED_ACCOUNT_NAME || "Caruso Service Center";
    const accountSlug = process.argv[3] || process.env.SEED_ACCOUNT_SLUG || "caruso-service-center";
    const ownerEmail = process.argv[4] || process.env.SEED_OWNER_EMAIL || "owner@caruso.local";
    const ownerName = process.argv[5] || process.env.SEED_OWNER_NAME || "Owner";
    const ownerPassword = process.argv[6] || process.env.SEED_OWNER_PASSWORD || "password123";

    // Create or find account (idempotent)
    let account = await Account.findOne({ slug: accountSlug });

    if (!account) {
      account = await Account.create({
        name: accountName,
        slug: accountSlug,
      });
      console.log("✅ Created account:", account.name);
    } else {
      console.log("ℹ️ Found existing account:", account.name);
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(ownerPassword, saltRounds);

    // Create or update owner user (idempotent)
    const ownerEmailLower = ownerEmail.toLowerCase().trim();
    let owner = await User.findOne({
      accountId: account._id,
      email: ownerEmailLower,
    });

    if (!owner) {
      owner = await User.create({
        accountId: account._id,
        email: ownerEmailLower,
        name: ownerName,
        role: "owner",
        passwordHash,
        isActive: true,
      });
      console.log("✅ Created owner user:", owner.email);
    } else {
      // Update password if user exists (allows password reset via seed)
      owner.passwordHash = passwordHash;
      owner.isActive = true;
      await owner.save();
      console.log("ℹ️ Updated existing owner user:", owner.email);
    }

    console.log("\n✅ Seed complete!");
    console.log(`Account ID: ${account._id}`);
    console.log(`Owner Email: ${owner.email}`);
    console.log(`Owner Password: ${ownerPassword}`);
    console.log("\n👉 You can now login with these credentials.");
  } catch (err) {
    console.error("❌ Error seeding first shop:");
    console.error(err);
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
