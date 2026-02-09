// backend/src/utils/email.ts
// Unified email sender: Resend API (production) or nodemailer (fallback)

import { Types } from "mongoose";
import { Resend } from "resend";
import { Account } from "../models/account.model";
import { buildFrom, getMailer } from "./mailer";

export interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
  accountId?: string | Types.ObjectId;
  /** Override From (e.g. ADMIN_FROM_EMAIL/ADMIN_FROM_NAME). Invoice emails keep using INVOICE_FROM_* / default. */
  from?: { name: string; email: string };
}

/**
 * Send email via Resend (if EMAIL_PROVIDER=resend) or nodemailer.
 * Returns { messageId } on success; throws on failure.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{ messageId?: string }> {
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }
    let from: string;
    if (args.from?.email?.trim()) {
      from = args.from.name?.trim()
        ? `${args.from.name.trim()} <${args.from.email.trim()}>`
        : args.from.email.trim();
    } else {
      const fromRaw = process.env.EMAIL_FROM ?? process.env.SMTP_USER;
      from = typeof fromRaw === "string" ? fromRaw.trim() : "";
    }
    if (!from) {
      throw new Error("EMAIL_FROM or SMTP_USER is required when EMAIL_PROVIDER=resend");
    }

    const resend = new Resend(apiKey.trim());
    const attachments = (args.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      contentType: a.contentType,
    }));

    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
      attachments: attachments.length ? attachments : undefined,
    });

    if (error) {
      const details = JSON.stringify(error);
      throw new Error(
        error.message ? `${error.message} | ${details}` : details
      );
    }
    if (args.accountId != null) {
      const now = new Date();
      const accountObjectId =
        typeof args.accountId === "string"
          ? new Types.ObjectId(args.accountId)
          : args.accountId;
      Account.updateOne(
        { _id: accountObjectId },
        { $inc: { emailsSentCount: 1 }, $set: { lastEmailSentAt: now } }
      ).catch((err) =>
        console.warn("[email] account counter update failed", err?.message)
      );
    }
    return { messageId: data?.id };
  }

  // Nodemailer path
  const transporter = getMailer();
  const from = args.from?.email?.trim()
    ? (args.from.name?.trim() ? `${args.from.name.trim()} <${args.from.email.trim()}>` : args.from.email.trim())
    : buildFrom();
  const info = await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    ...(args.html ? { html: args.html } : {}),
    attachments: (args.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
  if (args.accountId != null) {
    const now = new Date();
    const accountObjectId =
      typeof args.accountId === "string"
        ? new Types.ObjectId(args.accountId)
        : args.accountId;
    Account.updateOne(
      { _id: accountObjectId },
      { $inc: { emailsSentCount: 1 }, $set: { lastEmailSentAt: now } }
    ).catch((err) =>
      console.warn("[email] account counter update failed", err?.message)
    );
  }
  return { messageId: info?.messageId };
}
