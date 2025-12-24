import nodemailer from "nodemailer";

export function getMailer() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }

  // 🔍 TEMP DIAGNOSTIC LOG (safe — does NOT print password)
  console.log("[SMTP] config", {
    host,
    port,
    secure,
    user,
    passLength: pass.length,
  });

  return nodemailer.createTransport({
    host,
    port,
    secure, // false for 587 / STARTTLS
    auth: { user, pass },
  });
}
