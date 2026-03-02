/**
 * VERIFY: Change password flow
 *
 * Run with backend server: npm run dev
 * In another terminal: npx ts-node src/scripts/verifyChangePassword.ts
 *
 * Uses env: API_BASE_URL (default http://localhost:4000),
 *          VERIFY_EMAIL, VERIFY_PASSWORD, VERIFY_SHOP_CODE (or defaults from seed)
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";
const EMAIL = process.env.VERIFY_EMAIL || "owner@billingtest.local";
const PASSWORD = process.env.VERIFY_PASSWORD || "demo123";
const SHOP_CODE = process.env.VERIFY_SHOP_CODE || "billing-phase-test";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/caruso-service-manager";

async function api(path: string, options: { method?: string; body?: string; token?: string }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.token && { "x-auth-token": options.token }),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function ok(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string) {
  console.error(`  ❌ ${msg}`);
}

async function main() {
  console.log("\n🔐 VERIFY: Change password flow\n");
  console.log("API:", API_BASE);
  console.log("Email:", EMAIL, "| ShopCode:", SHOP_CODE);

  const debugRes = await api("/__debug/build", {});
  console.log("\n[__debug/build] Response:", JSON.stringify(debugRes.data, null, 2));
  if (debugRes.status !== 200) {
    fail("Backend __debug/build failed - is the server running?");
    process.exit(1);
  }

  let tokenOld: string | null = null;
  try {
  // --- 1) Login -> get OLD token ---
  console.log("\n--- 1) Login -> get OLD token ---");
  const loginRes = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, shopCode: SHOP_CODE }),
  });

  if (loginRes.status !== 200) {
    fail(`Login failed: ${loginRes.status}`);
    console.log("  Response:", loginRes.data);
    console.log("\n💡 Ensure backend is running and you have a seeded user.");
    console.log("   e.g. npx ts-node src/scripts/seedBillingPhaseTest.ts");
    throw new Error("Login failed");
  }

  const loginData = loginRes.data as { token: string };
  tokenOld = loginData.token;
  ok("Got OLD token");
  const payloadOld = JSON.parse(Buffer.from(tokenOld.split(".")[1], "base64").toString());
  console.log("(debug) tokenOld sv:", payloadOld.sv);

  // --- 2) Voluntary flow: PATCH without currentPassword -> 401 ---
  console.log("\n--- 2a) PATCH /auth/password with only newPassword (voluntary) -> expect 401 ---");
  const noCurrentRes = await api("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify({ newPassword: "NewSecurePass123!@#" }),
    token: tokenOld,
  });

  if (noCurrentRes.status === 401) {
    ok("401 as expected (current password required)");
  } else {
    fail(`Expected 401, got ${noCurrentRes.status}`);
    console.log("  Response:", noCurrentRes.data);
  }

  // --- 2b) Wrong currentPassword -> 401 ---
  console.log("\n--- 2b) PATCH with wrong currentPassword -> expect 401 ---");
  const wrongCurrentRes = await api("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify({
      newPassword: "NewSecurePass123!@#",
      currentPassword: "wrongpassword",
    }),
    token: tokenOld,
  });

  if (wrongCurrentRes.status === 401) {
    ok("401 as expected (wrong current password)");
  } else {
    fail(`Expected 401, got ${wrongCurrentRes.status}`);
    console.log("  Response:", wrongCurrentRes.data);
  }

  // --- 2c) Correct currentPassword -> 200 and new token ---
  console.log("\n--- 2c) PATCH with correct currentPassword -> expect 200 + new token ---");
  const correctRes = await api("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify({
      newPassword: "NewSecurePass123!@#",
      currentPassword: PASSWORD,
    }),
    token: tokenOld,
  });

  if (correctRes.status !== 200) {
    fail(`Expected 200, got ${correctRes.status}`);
    console.log("  Response:", correctRes.data);
    throw new Error("Change password failed");
  }

  const changeData = correctRes.data as { ok: boolean; token: string; mustChangePassword: boolean };
  if (!changeData.token) {
    fail("Response missing token");
    throw new Error("Response missing token");
  }
  const tokenNew = changeData.token;
  ok("200 + got NEW token");
  const payloadNew = JSON.parse(Buffer.from(tokenNew.split(".")[1], "base64").toString());
  console.log("(debug) tokenNew sv:", payloadNew.sv);

  // --- 3) OLD token -> 401 ---
  console.log("\n--- 3) GET /auth/me with OLD token -> expect 401 (revoked) ---");
  const meOldRes = await api("/api/auth/me", { token: tokenOld });

  if (meOldRes.status === 401) {
    ok("401 as expected (old token revoked)");
  } else {
    fail(`Expected 401, got ${meOldRes.status}`);
    console.log("  Response:", meOldRes.data);
    throw new Error("Expected 401, got " + meOldRes.status);
  }

  // --- 4) NEW token -> 200 ---
  console.log("\n--- 4) GET /auth/me with NEW token -> expect 200 ---");
  const meNewRes = await api("/api/auth/me", { token: tokenNew });

  if (meNewRes.status === 200) {
    ok("200 as expected");
  } else {
    fail(`Expected 200, got ${meNewRes.status}`);
    console.log("  Response (full):", JSON.stringify(meNewRes.data, null, 2));
    throw new Error("GET /auth/me with NEW token failed");
  }

  // --- 5) Forced flow: mustChangePassword true, no currentPassword ---
  console.log("\n--- 5) Forced flow: mustChangePassword=true, change without currentPassword ---");

  await mongoose.connect(MONGO_URI);
  const user = await User.findOne({
    email: EMAIL.toLowerCase().trim(),
  });
  if (!user) {
    fail("User not found for forced flow");
    throw new Error("User not found for forced flow");
  }

  // Ensure password is PASSWORD before step 5 (in case earlier steps left it changed)
  user.passwordHash = await bcrypt.hash(PASSWORD, 10);
  user.mustChangePassword = true;
  user.tempPasswordExpiresAt = null;
  await user.save();
  await mongoose.disconnect();
  ok("Set mustChangePassword=true on user");

  const loginForced = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, shopCode: SHOP_CODE }),
  });
  if (loginForced.status !== 200) {
    fail("Login for forced flow failed");
    throw new Error("Login for forced flow failed");
  }
  const tokenForced = (loginForced.data as { token: string }).token;

  const changeForcedRes = await api("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify({ newPassword: "ForcedNewPass123!@#" }),
    token: tokenForced,
  });

  if (changeForcedRes.status === 200) {
    ok("200 - change succeeded without currentPassword");
    const forcedData = changeForcedRes.data as { token: string };
    if (forcedData.token) {
      ok("Got new token in response");
    }
  } else {
    fail(`Expected 200, got ${changeForcedRes.status}`);
    console.log("  Response:", changeForcedRes.data);
    throw new Error("Forced change password failed");
  }

  console.log("\n✅ All verification steps passed.\n");
  } finally {
    // Ensure restore runs even if steps fail - reset password and mustChangePassword
    try {
      await mongoose.connect(MONGO_URI);
      const userRestore = await User.findOne({ email: EMAIL.toLowerCase().trim() });
      if (userRestore) {
        userRestore.mustChangePassword = false;
        userRestore.passwordHash = await bcrypt.hash(PASSWORD, 10);
        await userRestore.save();
        console.log("\n[restore] Password and mustChangePassword reset for re-runs");
      }
    } catch (restoreErr) {
      console.warn("[restore] Failed:", restoreErr instanceof Error ? restoreErr.message : restoreErr);
    } finally {
      await mongoose.disconnect();
    }
  }
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
