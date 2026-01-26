// backend/src/scripts/seedDefaultAccount.ts
import "dotenv/config";
import mongoose from "mongoose";
import { Account } from "../models/account.model"; // adjust path if needed

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/caruso-service-manager";

async function main() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);

    const name = "Caruso Service Center";
    const slug = "caruso-service-center"; // assuming your Account has a slug field

    let account = await Account.findOne({ slug });

    if (!account) {
      account = await Account.create({
        name,
        slug,
        isActive: true,
        // add any other required fields here, e.g. contactEmail, phone, etc.
      });
      console.log("✅ Created default account:", account.name);
    } else {
      console.log("ℹ️ Found existing default account:", account.name);
    }

    const id = account._id.toString();

    console.log("\n👉 Add this to your .env:\n");
    console.log(`DEFAULT_ACCOUNT_ID=${id}\n`);
  } catch (err) {
    console.error("❌ Error seeding default account:");
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
