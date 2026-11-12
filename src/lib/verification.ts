import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/resend";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Minimum gap between verification emails to one user. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Email verification is required only when we can actually send email. With
 * no RESEND_API_KEY (local dev, some previews) new accounts are verified
 * immediately so the app stays usable — production must have Resend set.
 */
export function isEmailVerificationEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Issue a new verification link for a user and email it. Earlier links for the
 * user are invalidated. `origin` is the site's base URL (from the request).
 */
export async function sendVerificationLink(
  user: { id: string; email: string; name: string },
  origin: string
): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    db.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);

  const verifyUrl = new URL(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, origin).toString();
  const result = await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl });
  if (!result.sent) console.error(`Verification email to user ${user.id} not sent: ${result.reason}`);
  return result.sent;
}

/** Seconds until this user may request another email (0 = now). */
export async function resendWaitSeconds(userId: string): Promise<number> {
  const latest = await db.emailVerificationToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return 0;
  const wait = latest.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
  return wait > 0 ? Math.ceil(wait / 1000) : 0;
}

/**
 * Consume a verification token. Returns the verified user's id, or null if the
 * token is unknown or expired. Single use: the user's tokens are deleted.
 */
export async function consumeVerificationToken(token: string): Promise<string | null> {
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return null;
  if (record.expiresAt < new Date()) {
    await db.emailVerificationToken.delete({ where: { id: record.id } }).catch(() => {});
    return null;
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  return record.userId;
}
