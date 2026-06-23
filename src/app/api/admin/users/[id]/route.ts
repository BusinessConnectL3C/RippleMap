import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

async function requireBCStaff() {
  const session = await auth();
  const su = session?.user as unknown as { role?: string } | undefined;
  if (!session?.user?.id || su?.role !== "BC_STAFF") return false;
  return true;
}

const patchSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await db.user.update({ where: { id }, data: { role: parsed.data.role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await db.user.findUnique({ where: { id }, select: { orgId: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent deleting the last user in an org
  const orgUserCount = await db.user.count({ where: { orgId: user.orgId } });
  if (orgUserCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last user in an organization" },
      { status: 409 }
    );
  }

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
