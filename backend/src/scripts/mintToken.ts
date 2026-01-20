import "dotenv/config";
import jwt from "jsonwebtoken";

type Role = "owner" | "manager" | "technician";

/**
 * Dev-only helper to mint an auth token for local testing.
 *
 * Usage:
 *   ts-node src/scripts/mintToken.ts <userId> <accountId> <role>
 *
 * Example:
 *   ts-node src/scripts/mintToken.ts 60f7... 60f7... owner
 */
async function main() {
  const [userId, accountId, roleArg] = process.argv.slice(2);
  const role = (roleArg || "").toLowerCase() as Role;
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!secret) {
    console.error("AUTH_TOKEN_SECRET is not set. Cannot mint token.");
    process.exit(1);
  }

  if (!userId || !accountId || !role) {
    console.error("Usage: ts-node src/scripts/mintToken.ts <userId> <accountId> <role>");
    console.error("role must be one of: owner | manager | technician");
    process.exit(1);
  }

  if (!["owner", "manager", "technician"].includes(role)) {
    console.error("Invalid role. Expected one of: owner | manager | technician");
    process.exit(1);
  }

  const payload = {
    userId,
    accountId,
    role,
  };

  const token = jwt.sign(payload, secret, {
    // Adjust if you want longer-lived dev tokens
    expiresIn: "7d",
  });

  console.log("Minted token:");
  console.log(token);
}

main().catch((err) => {
  console.error("Failed to mint token:", err);
  process.exit(1);
});

