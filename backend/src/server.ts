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
import { getMailer } from "./utils/mailer";
import reportsRouter from "./routes/reports.routes";
import { requireAuth } from "./middleware/requireAuth";
import vehicleRoutes from "./routes/vehicles.route";
import { handleLogin, loginLimiter, handleMe, handleRegister, registerLimiter, handleReactivate, reactivateLimiter } from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";

const app = express();

// 🔹 Global middleware
app.use(cors());
app.use(express.json());

// (Optional) health check (public)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 🔓 Public auth routes
app.post("/api/auth/register", registerLimiter, handleRegister);
app.post("/api/auth/login", loginLimiter, handleLogin);
app.post("/api/auth/reactivate", reactivateLimiter, handleReactivate);

// 🔒 All other /api routes require auth
app.use("/api", requireAuth);

// 🔐 Protected auth routes (after requireAuth)
app.get("/api/auth/me", handleMe);

app.use("/api/customers", customerRoutes);
app.use("/api/work-orders", workOrderRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/settings", settingsRouter);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/reports", reportsRouter);
app.use("/api/users", usersRoutes);

console.log("✅ Mounted /api/invoices routes");
console.log("✅ Mounted /api/reports routes");
console.log("✅ Mounted /api/users routes");

console.log("CWD:", process.cwd());
console.log("SMTP_USER:", process.env.SMTP_USER);

const pass = process.env.SMTP_PASS ?? "";
console.log("SMTP_PASS length:", pass.length);
console.log("SMTP_PASS JSON:", JSON.stringify(pass));

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

connectDB()
  .then(() => {
    server.listen(PORT, async () => {
      console.log(`✅ MongoDB connected`);
      console.log(`🚗 Server running at http://localhost:${PORT}`);

      try {
        const transporter = getMailer();
        await transporter.verify();
        console.log("✅ SMTP ready");
      } catch (err) {
        console.error("❌ SMTP verify failed", err);
      }
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB", err);
    process.exit(1);
  });
