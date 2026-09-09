import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireBCStaff() {
  const session = await auth();
  const su = session?.user as unknown as { role?: string } | undefined;
  if (!session?.user?.id || su?.role !== "BC_STAFF") return false;
  return true;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireBCStaff())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.supportTicket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
