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

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) return { sent: false, reason: "not_configured" };

  const firstName = params.name.split(" ")[0] || params.name;
  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: "Confirm your email for RippleMap",
      html: `
        <div style="font-family: 'Hanken Grotesk', -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #6c8042; height: 4px; border-radius: 2px; margin-bottom: 24px;"></div>
          <h2 style="color: #303030;">Confirm your email</h2>
          <p style="color: #434342; font-size: 15px; line-height: 1.5;">
            Hi ${firstName}, confirm this is your email address to finish setting up your RippleMap account.
          </p>
          <p style="margin: 24px 0;">
            <a href="${params.verifyUrl}"
               style="background: #6c8042; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Confirm email
            </a>
          </p>
          <p style="color: #7a7a74; font-size: 13px;">
            This link expires in 24 hours. If you didn't create a RippleMap account, you can ignore this email.
          </p>
        </div>
      `,
      text: `Hi ${firstName}, confirm your email for RippleMap: ${params.verifyUrl}\n\nThis link expires in 24 hours. If you didn't create a RippleMap account, you can ignore this email.`,
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Tells BC about a new contact form message. Goes to CONTACT_NOTIFY_EMAIL
 * (a BC inbox); reply-to is the sender so staff can answer directly.
 */
export async function sendContactNotification(submission: {
  id: string;
  name: string;
  email: string;
  organization: string;
  website: string | null;
  role: string | null;
  orgType: string | null;
  interest: string | null;
  message: string | null;
}): Promise<SendResult> {
  const client = getClient();
  const to = process.env.CONTACT_NOTIFY_EMAIL?.trim();
  if (!client || !to) return { sent: false, reason: "not_configured" };

  const rows: [string, string | null][] = [
    ["Name", submission.name],
    ["Email", submission.email],
    ["Organization", submission.organization],
    ["Website", submission.website],
    ["Role", submission.role],
    ["Organization type", submission.orgType],
    ["Interested in", submission.interest],
  ];
  const present = rows.filter((r): r is [string, string] => !!r[1]);
  const adminUrl = `${process.env.AUTH_URL ?? "https://ripplemap.app"}/admin/contacts`;

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to,
      replyTo: submission.email,
      subject: `New RippleMap contact: ${submission.name} (${submission.organization})`.slice(0, 200),
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 560px;">
          <h2 style="color: #303030;">New message from the RippleMap website</h2>
          <table style="font-size: 14px; color: #434342; border-collapse: collapse;">
            ${present
              .map(
                ([k, v]) =>
                  `<tr><td style="padding: 4px 16px 4px 0; color: #7a7a74;">${k}</td><td style="padding: 4px 0;">${escapeHtml(v)}</td></tr>`
              )
              .join("")}
          </table>
          ${
            submission.message
              ? `<p style="white-space: pre-wrap; font-size: 14px; color: #303030; border-left: 3px solid #6c8042; padding-left: 12px;">${escapeHtml(submission.message)}</p>`
              : ""
          }
          <p style="font-size: 13px; color: #7a7a74;">Reply to this email to answer them. All messages: <a href="${adminUrl}">${adminUrl}</a></p>
        </div>
      `,
      text: `${present.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${submission.message ?? ""}\n\nAll messages: ${adminUrl}`,
    });
    if (error) {
      console.error("Resend send error:", error);
      return { sent: false, reason: "send_failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("Resend send error:", err);
    return { sent: false, reason: "send_failed" };
  }
}
