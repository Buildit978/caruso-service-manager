// backend/src/scripts/seedSuperAdmin.ts
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Account } from "../models/account.model";
import { User } from "../models/user.model";

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
  const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
  const BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS;

  if (!MONGO_URI) {
    throw new Error("Missing required env: MONGO_URI");
  }
  if (!SUPERADMIN_EMAIL) {
    throw new Error("Missing required env: SUPERADMIN_EMAIL");
  }
  if (!SUPERADMIN_PASSWORD) {
    throw new Error("Missing required env: SUPERADMIN_PASSWORD");
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    const email = SUPERADMIN_EMAIL.toLowerCase().trim();

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      console.log("Superadmin already exists");
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    // Superadmin needs an accountId (User schema requires it). Use a System account.
    let account = await Account.findOne({ slug: "system" });
    if (!account) {
      account = await Account.create({
        name: "System",
        slug: "system",
        isActive: true,
      });
      console.log("✅ Created System account for superadmin");
    }

    const saltRounds = Number(BCRYPT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, saltRounds);

    await User.create({
      accountId: account._id,
      email,
      name: "Super Admin",
      role: "superadmin",
      passwordHash,
      isActive: true,
      tokenInvalidBefore: new Date(),
    });

    console.log("✅ Created superadmin:", email);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding superadmin:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
