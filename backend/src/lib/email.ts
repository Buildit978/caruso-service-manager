import nodemailer from "nodemailer";

export interface SendEmailOpts {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<void> {
  const { to, subject, text, html } = opts;

  if (process.env.NODE_ENV !== "production") {
    const resetLink = html
      ? (html.match(/href=["']([^"']+)["']/)?.[1] ?? "(no link in html)")
      : "(no html)";
    console.log("[DEV EMAIL]", { to, subject, resetLink });
    return;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    throw new Error(
      "SMTP not configured: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM are required in production"
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: port === "465",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html ?? text,
  });
}

// Backward-compatible alias for callers expecting sendMail naming.
export async function sendMail(opts: SendEmailOpts): Promise<void> {
  return sendEmail(opts);
}
