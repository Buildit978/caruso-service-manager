import { Account } from "../models/account.model";

/**
 * Resolve the System account by slug "system".
 * Returns null if not found (caller should return 500 for admin flows).
 */
export async function getSystemAccount() {
  return Account.findOne({ slug: "system" });
}
