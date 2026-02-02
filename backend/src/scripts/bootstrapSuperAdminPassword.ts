// backend/src/scripts/bootstrapSuperAdminPassword.ts
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";

async function main() {
  const email = "superadmin@caruso.local"; // 👈 your real email
  const tempPassword = "TempAdmin123!"; // 👈 temporary, change later

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGO_URI");

  await mongoose.connect(mongoUri);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error(`Superadmin not found: ${email}`);
  if (user.role !== "superadmin")
    throw new Error(`User is not superadmin (role=${user.role})`);

  user.passwordHash = await bcrypt.hash(tempPassword, 10);
  await user.save();

  console.log("✅ Superadmin password bootstrapped");
  console.log("   email:", email);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});
