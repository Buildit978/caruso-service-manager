// backend/src/scripts/backfillAccountId.ts
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { Customer } from "../models/customer.model";
import { WorkOrder } from "../models/workOrder.model";
import { Settings } from "../models/settings.model";
import InvoiceModel from "../models/invoice.model";
// import { Vehicle } from "../models/vehicle.model";   // uncomment if/when needed

const MONGODB_URI =
  process.env.MONGODB_URI ??
  "mongodb://127.0.0.1:27017/caruso-service-manager";

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

  // include docs where accountId is missing OR explicitly null
  const missingAccountFilter = {
    $or: [{ accountId: { $exists: false } }, { accountId: null }],
  };

  const [
    customerResult,
    workOrderResult,
    settingsResult,
    invoiceResult,
    // vehicleResult,
  ] = await Promise.all([
    Customer.updateMany(missingAccountFilter, { $set: { accountId } }),
    WorkOrder.updateMany(missingAccountFilter, { $set: { accountId } }),
    Settings.updateMany(missingAccountFilter, { $set: { accountId } }),
    InvoiceModel.updateMany(missingAccountFilter, { $set: { accountId } }),
    // Vehicle.updateMany(missingAccountFilter, { $set: { accountId } }),
  ]);

  console.log("Backfill results:");
  console.log("👤 Customers:", customerResult);
  console.log("🧰 WorkOrders:", workOrderResult);
  console.log("⚙️ Settings:", settingsResult);
  console.log("💸 Invoices:", invoiceResult);
  // console.log("🚗 Vehicles:", vehicleResult);

  await mongoose.disconnect();
  console.log("🔌 Disconnected.");
}

main().catch((err) => {
  console.error("❌ Backfill script failed:", err);
  process.exit(1);
});
