import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { generateInviteToken, inviteExpiryDate } from "@/lib/invites";
import { sendInviteEmail } from "@/lib/email/resend";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // Staff can invite an Owner, e.g. for an org they created without one.
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
});

/** RM Staff: invite someone to any organization. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffViewer();
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { id } = await params;
  const { email, role } = parsed.data;

  const org = await db.organization.findUnique({ where: { id }, select: { name: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "That email already has a RippleMap account (one organization per account)." }, { status: 409 });
  }
  if (await db.orgInvite.findFirst({ where: { orgId: id, email, status: "PENDING", expiresAt: { gt: new Date() } } })) {
    return NextResponse.json({ error: "An invite is already pending for this email." }, { status: 409 });
  }

  const invite = await db.orgInvite.create({
    data: { orgId: id, email, role, token: generateInviteToken(), expiresAt: inviteExpiryDate(), invitedById: staff.id },
  });
  const inviteUrl = new URL(`/invite/${invite.token}`, req.nextUrl.origin).toString();
  const sent = await sendInviteEmail({ to: email, orgName: org.name, role, inviteUrl, expiresAt: invite.expiresAt });
  console.info(JSON.stringify({ event: "staff_invite", by: staff.id, orgId: id, role }));
  return NextResponse.json({ inviteUrl, emailSent: sent.sent }, { status: 201 });
}
