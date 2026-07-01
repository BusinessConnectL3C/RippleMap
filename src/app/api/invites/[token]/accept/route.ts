import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().min(2),
  password: z.string().min(8),
  email: z.string().email().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const invite = await db.orgInvite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }
  if (invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 410 });
  }

  const email = invite.email ?? parsed.data.email;
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (invite.email && parsed.data.email && invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return NextResponse.json({ error: "This invite is for a different email address" }, { status: 403 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "This email is already registered" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: parsed.data.name,
        hashedPassword,
        role: invite.role,
        orgId: invite.orgId,
      },
    });
    await tx.orgInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    return created;
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
