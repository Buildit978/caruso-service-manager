// backend/src/server.ts
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { connectDB } from "./config/db";
import customerRoutes from "./routes/customers.route";
import workOrderRoutes from "./routes/workOrders.route";
import summaryRoutes from "./routes/summary.route";
import settingsRouter from "./routes/settings.route";
import invoiceRoutes from "./routes/invoice.routes";
import estimateRoutes from "./routes/estimates.route";
import { getMailer } from "./utils/mailer";
import reportsRouter from "./routes/reports.routes";
import schedulerRoutes from "./routes/scheduler.route";
import { requireAuth } from "./middleware/requireAuth";
import { requireAdminAuth } from "./middleware/requireAdminAuth";
import { requireAdmin } from "./middleware/requireAdmin";
import vehicleRoutes from "./routes/vehicles.route";
import { handleLogin, loginLimiter, handleMe, handleRegister, registerLimiter, handleReactivate, reactivateLimiter, handleForgotPassword, forgotPasswordLimiter, handleResetPassword, resetPasswordLimiter, handleChangePassword } from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import adminRouter from "./routes/admin";
import adminAuthPublicRouter from "./routes/admin/adminAuthPublic.route";
import billingRouter, { billingWebhookHandler } from "./routes/billing.route";
import automationRouter from "./routes/automation.route";
import { assertStripeEnvIsolation } from "./utils/envGuard";

assertStripeEnvIsolation();
console.log("🚦 Boot: Stripe env guard ran | NODE_ENV=", process.env.NODE_ENV);

const BOOT_GUARD = "stripe-env-guard-v1";
const app = express();

app.set("trust proxy", 1); // ✅ required on Render/Cloudflare for correct IP + rate-limit


// 🔹 Global middleware
app.use(cors());

// Use JSON body parser for all routes EXCEPT the Stripe webhook,
// which needs the raw body for signature verification.
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.originalUrl === "/api/billing/webhook") {
    return next();
  }
  return jsonParser(req, res, next);
});

// (Optional) health check (public)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
// Render expects this exact path
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Optional internal/API health (safe to keep)
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Build/debug endpoint (temporary, for verification)
app.get("/__build", (_req, res) => {
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV,
    commit: process.env.RENDER_GIT_COMMIT || null,
    guard: BOOT_GUARD,
    time: new Date().toISOString(),
  });
});

app.get("/__debug/build", (_req, res) => {
  return res.json({
    ok: true,
    ts: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid,
  });
});



// 🔓 Public auth routes
app.post("/api/auth/register", registerLimiter, handleRegister);
app.post("/api/auth/login", loginLimiter, handleLogin);
app.post("/api/auth/reactivate", reactivateLimiter, handleReactivate);
app.post("/api/auth/forgot-password", forgotPasswordLimiter, handleForgotPassword);
app.post("/api/auth/reset-password", resetPasswordLimiter, handleResetPassword);

// 🔓 Public admin auth (login only; rest of /api/admin requires token)
app.use("/api/admin/auth", adminAuthPublicRouter);

// 🔓 Public Stripe billing webhook (raw body, no auth)
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  billingWebhookHandler
);

// 🔐 Automation (shared secret; not tenant JWT) — mount before requireAuth
app.use("/api/automation", automationRouter);

app.use("/api/admin", requireAdminAuth, adminRouter);

// 🔒 All other /api routes require auth
app.use("/api", requireAuth);

// 🔐 Protected auth routes (after requireAuth)
app.get("/api/auth/me", handleMe);
app.post("/api/auth/change-password", handleChangePassword);
app.patch("/api/auth/password", handleChangePassword);

app.use("/api/customers", customerRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/settings", settingsRouter);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/estimates", estimateRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/reports", reportsRouter);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/billing", billingRouter);

console.log("✅ Mounted /api/invoices routes");
console.log("✅ Mounted /api/scheduler routes");
console.log("✅ Mounted /api/reports routes");
console.log("✅ Mounted /api/users routes");

console.log("CWD:", process.cwd());


const pass = process.env.SMTP_PASS ?? "";
console.log("ℹ️ SMTP configured (details hidden)");


const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

connectDB()
  .then(() => {
    server.listen(PORT, async () => {
      console.log(`✅ MongoDB connected`);
      console.log(`🚗 Server running at http://localhost:${PORT}`);

      const transporter = getMailer();

if (process.env.NODE_ENV !== "production") {
  transporter.verify()
    .then(() => console.log("✅ SMTP verified (dev)"))
    .catch(err =>
      console.warn("⚠️ SMTP verify failed (non-blocking):", err?.message || err)
    );
} else {
  console.log("ℹ️ SMTP verify skipped in production");
}

    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB", err);
    process.exit(1);
  });
