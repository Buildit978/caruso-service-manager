// backend/src/scripts/bootstrapSuperAdminPassword.ts
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { Account } from "../models/account.model";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing ADMIN_EMAIL or ADMIN_PASSWORD");
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGO_URI");

  await mongoose.connect(mongoUri);

  const systemAccount = await Account.findOne({ slug: "system" });
  if (!systemAccount) throw new Error("System account not found");

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    {
      email: email.toLowerCase(),
      accountId: systemAccount._id,
    },
    {
      email: email.toLowerCase(),
      accountId: systemAccount._id,
      role: "superadmin",
      isActive: true,
      passwordHash,
    },
    { upsert: true, new: true }
  );

  console.log("✅ System superadmin ready");
  console.log("   id:", user._id.toString());
  console.log("   email:", user.email);
  console.log("   accountId:", user.accountId.toString());

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});
