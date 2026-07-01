import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const su = session?.user as unknown as { orgId?: string; role?: string } | undefined;
  if (!session?.user?.id || !su?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (su.role !== "OWNER" && su.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const invite = await db.orgInvite.findUnique({ where: { id } });
  if (!invite || invite.orgId !== su.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.orgInvite.update({ where: { id }, data: { status: "REVOKED" } });
  return NextResponse.json({ ok: true });
}
