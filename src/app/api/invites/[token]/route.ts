import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await db.orgInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    orgName: invite.organization.name,
  });
}
