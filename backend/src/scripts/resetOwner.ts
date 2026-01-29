import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { User } from "../models/user.model";

const OWNER_EMAIL = process.env.OWNER_EMAIL || "owner@caruso.local";
const NEW_PASSWORD = process.env.NEW_PASSWORD || "Caruso!Temp#2026";
const MONGO_URI = process.env.MONGO_URI;

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected");

  // select +password only if your schema has select:false
  const user = await User.findOne({ email: OWNER_EMAIL }).select("+password");
  if (!user) throw new Error(`No user found for ${OWNER_EMAIL}`);

  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  // Clear common lock fields (harmless if they don't exist)
  const $set: any = {
    password: hash,
    loginAttempts: 0,
    failedLoginAttempts: 0,
    isLocked: false,
    lockUntil: null,
    lockedUntil: null,
  };

  await User.updateOne(
    { _id: user._id },
    { $set, $unset: { lockUntil: "", lockedUntil: "" } }
  );

  console.log("✅ Owner reset complete");
  console.log("Email:", OWNER_EMAIL);
  console.log("Temp password:", NEW_PASSWORD);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
