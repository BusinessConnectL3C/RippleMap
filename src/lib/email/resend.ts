import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? "RippleMap <invites@ripplemap.app>";

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "send_failed" };

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function sendInviteEmail(params: {
  to: string;
  orgName: string;
  role: "ADMIN" | "MEMBER";
  inviteUrl: string;
  expiresAt: Date;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return { sent: false, reason: "not_configured" };

  const roleLabel = params.role === "ADMIN" ? "an Admin" : "a Member";
  const expiresLabel = params.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: `You've been invited to join ${params.orgName} on RippleMap`,
      html: `
        <div style="font-family: 'Hanken Grotesk', -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #6c8042; height: 4px; border-radius: 2px; margin-bottom: 24px;"></div>
          <h2 style="color: #303030;">You've been invited to RippleMap</h2>
          <p style="color: #434342; font-size: 15px; line-height: 1.5;">
            You've been invited to join <strong>${params.orgName}</strong> as ${roleLabel} on their RippleMap
            client portal.
          </p>
          <p style="margin: 24px 0;">
            <a href="${params.inviteUrl}"
               style="background: #6c8042; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Accept invite
            </a>
          </p>
          <p style="color: #7a7a74; font-size: 13px;">
            This link expires on ${expiresLabel}. If you weren't expecting this, you can ignore this email.
          </p>
        </div>
      `,
      text: `You've been invited to join ${params.orgName} on RippleMap as ${roleLabel}.\n\nAccept your invite: ${params.inviteUrl}\n\nThis link expires on ${expiresLabel}.`,
    });

    if (error) {
      console.error("Resend send error:", error);
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("Resend send threw:", err);
    return { sent: false, reason: "send_failed" };
  }
}
