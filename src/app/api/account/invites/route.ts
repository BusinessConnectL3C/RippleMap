import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteToken, inviteExpiryDate } from "@/lib/invites";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const su = session?.user as unknown as { orgId?: string; role?: string; id?: string } | undefined;
  if (!session?.user?.id || !su?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (su.role !== "OWNER" && su.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, role } = parsed.data;

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
  }

  const existingInvite = await db.orgInvite.findFirst({
    where: { orgId: su.orgId, email, status: "PENDING" },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "An invite is already pending for this email" }, { status: 409 });
  }

  const invite = await db.orgInvite.create({
    data: {
      orgId: su.orgId,
      email,
      role,
      token: generateInviteToken(),
      expiresAt: inviteExpiryDate(),
      invitedById: session.user.id,
    },
  });

  const inviteUrl = new URL(`/invite/${invite.token}`, req.nextUrl.origin).toString();

  return NextResponse.json({ invite, inviteUrl }, { status: 201 });
}
