import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendContactNotification } from "@/lib/email/resend";
import { CONTACT_INTERESTS, CONTACT_ORG_TYPES } from "@/lib/contact-options";

/**
 * Contact submissions are customer PII. They're kept this long, then deleted
 * (purgeOldContacts runs on each new submission and on the admin list).
 */
export const CONTACT_RETENTION_MONTHS = 24;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(200),
  organization: z.string().trim().min(1, "Please enter your organization").max(200),
  website: optionalText(300).refine((v) => !v || /^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i.test(v), {
    message: "Please enter a valid website",
  }),
  role: optionalText(120),
  orgType: z.enum(CONTACT_ORG_TYPES).optional(),
  interest: z.enum(CONTACT_INTERESTS).optional(),
  message: optionalText(4000),
  /** Honeypot: a hidden field people never fill in. */
  company: z.string().optional(),
  /** ms since the form was shown; bots submit instantly. */
  elapsedMs: z.number().int().nonnegative().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Per-address and site-wide caps, so the form can't be used to flood the table or BC's inbox. */
const PER_EMAIL_PER_HOUR = 3;
const SITE_WIDE_PER_HOUR = 60;

export type ContactResult = { ok: true } | { ok: false; status: number; error: string };

export async function submitContact(input: ContactInput): Promise<ContactResult> {
  // Likely bot: pretend it worked so it doesn't retry, but store nothing.
  if (input.company || (input.elapsedMs !== undefined && input.elapsedMs < 2500)) return { ok: true };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [fromEmail, total] = await Promise.all([
    db.contactSubmission.count({ where: { email: input.email, createdAt: { gte: hourAgo } } }),
    db.contactSubmission.count({ where: { createdAt: { gte: hourAgo } } }),
  ]);
  if (fromEmail >= PER_EMAIL_PER_HOUR) return { ok: true }; // already have their message
  if (total >= SITE_WIDE_PER_HOUR) {
    return { ok: false, status: 429, error: "We're receiving a lot of messages right now. Please try again later." };
  }

  const website = input.website && !/^https?:\/\//i.test(input.website) ? `https://${input.website}` : input.website;
  const submission = await db.contactSubmission.create({
    data: {
      name: input.name,
      email: input.email,
      organization: input.organization,
      website,
      role: input.role,
      orgType: input.orgType,
      interest: input.interest,
      message: input.message,
    },
  });

  const notified = await sendContactNotification(submission);
  if (!notified.sent && notified.reason === "send_failed") {
    console.error(`contact: notification email failed for submission ${submission.id}`);
  }
  await purgeOldContacts().catch((err) => console.error("contact: purge failed", err));
  return { ok: true };
}

export async function purgeOldContacts(): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - CONTACT_RETENTION_MONTHS);
  const { count } = await db.contactSubmission.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
