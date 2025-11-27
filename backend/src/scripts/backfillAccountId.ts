// backend/src/scripts/backfillAccountId.ts
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { Customer } from "../models/customer.model";
import { WorkOrder } from "../models/workOrder.model";
import { Settings } from "../models/settings.model";
// import { Vehicle } from "../models/vehicle.model";   // uncomment if you have it
// import { Invoice } from "../models/invoice.model";   // uncomment if you have it

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/caruso-service-manager";

async function main() {
  const envId = process.env.DEFAULT_ACCOUNT_ID;

  if (!envId || !Types.ObjectId.isValid(envId)) {
    console.error("❌ DEFAULT_ACCOUNT_ID is missing or invalid:", envId);
    process.exit(1);
  }

  const accountId = new Types.ObjectId(envId);
  console.log("Using accountId:", accountId.toHexString());

  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  const results = await Promise.all([
    Customer.updateMany(
      { accountId: { $exists: false } },
      { $set: { accountId } }
    ),
    WorkOrder.updateMany(
      { accountId: { $exists: false } },
      { $set: { accountId } }
    ),
    Settings.updateMany(
      { accountId: { $exists: false } },
      { $set: { accountId } }
    ),
    // Vehicle.updateMany(
    //   { accountId: { $exists: false } },
    //   { $set: { accountId } }
    // ),
    // Invoice.updateMany(
    //   { accountId: { $exists: false } },
    //   { $set: { accountId } }
    // ),
  ]);

  console.log("Backfill results:");
  console.log("Customers:", results[0]);
  console.log("WorkOrders:", results[1]);
  console.log("Settings:", results[2]);
  // console.log("Vehicles:", results[3]);
  // console.log("Invoices:", results[4]);

  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

main().catch((err) => {
  console.error("❌ Backfill script failed:", err);
  process.exit(1);
});
