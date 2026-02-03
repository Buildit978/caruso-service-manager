/**
 * Backfill Account.region from Event.meta.region (conservative).
 * Only sets region when we have at least one event with meta.region "Canada" or "TT";
 * if mixed or no signal, leaves Account.region undefined.
 * Note: Current app code may not set meta.region on events; you can set region manually in Atlas for beta testers.
 *
 * Run from backend/: npx tsx src/scripts/backfillAccountRegion.ts
 * Production: MONGO_URI=<uri> npx tsx src/scripts/backfillAccountRegion.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Account } from "../models/account.model";
import { Event } from "../models/event.model";

const MONGO_URI = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/caruso-service-manager";

type Region = "Canada" | "TT";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const accounts = await Account.find({}).lean();
  let updated = 0;
  let skipped = 0;

  for (const acc of accounts) {
    const accountId = acc._id;
    const existingRegion = (acc as { region?: Region }).region;
    if (existingRegion === "Canada" || existingRegion === "TT") {
      skipped++;
      continue;
    }

    const regionCounts = await Event.aggregate<{ _id: Region; count: number }>([
      { $match: { accountId, "meta.region": { $in: ["Canada", "TT"] } } },
      { $group: { _id: "$meta.region", count: { $sum: 1 } } },
    ]);

    const canada = regionCounts.find((r) => r._id === "Canada")?.count ?? 0;
    const tt = regionCounts.find((r) => r._id === "TT")?.count ?? 0;
    let setRegion: Region | undefined;
    if (canada > 0 && tt === 0) setRegion = "Canada";
    else if (tt > 0 && canada === 0) setRegion = "TT";
    // else: mixed or no events → leave undefined

    if (setRegion) {
      await Account.updateOne({ _id: accountId }, { $set: { region: setRegion } });
      updated++;
      console.log("  Set", (acc as { name?: string }).name || accountId.toString(), "→", setRegion);
    } else {
      skipped++;
    }
  }

  console.log("✅ Backfill done. Updated:", updated, "Skipped (already set or no signal):", skipped);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
