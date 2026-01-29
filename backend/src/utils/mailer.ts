import nodemailer from "nodemailer";

function maskEmail(email?: string) {
  if (!email) return undefined;
  const [u, d] = email.split("@");
  if (!u || !d) return email;
  return `${u.slice(0, 2)}***@${d}`;
}

export function getMailer() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }

  // 🔍 Safe diagnostic log (no password)
  console.log("[SMTP] config", {
    host,
    port,
    secure,
    user: maskEmail(user),
    passLength: pass.length,
  });

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure, // false for 587 / STARTTLS
    auth: { user, pass },

    // Gmail + hosted infra friendliness
    requireTLS: true,
    tls: {
      // Don't set rejectUnauthorized:false in prod — keep it strict.
      servername: host,
    },
  });

  // Optional but super useful: tells you immediately if auth/TLS is broken
  transporter.verify()
    .then(() => console.log("✅ [SMTP] verify OK"))
    .catch((err) => {
      console.error("❌ [SMTP] verify failed", {
        message: err?.message,
        code: err?.code,
        response: err?.response,
        responseCode: err?.responseCode,
        command: err?.command,
      });
    });

  return transporter;
}

// Helper: always sets From = SMTP_USER unless caller overrides explicitly
export function buildFrom(): string {
  const raw = process.env.SMTP_USER;
  if (raw === undefined || raw === null) throw new Error("SMTP_USER is not set");
  const user = String(raw).trim();
  if (!user) throw new Error("SMTP_USER is missing or invalid");
  return user;
}
