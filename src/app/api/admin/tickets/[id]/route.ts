import { requireStaffViewer } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** DB-checked (not the JWT), so a demoted staff account loses access at once. */
async function requireBCStaff() {
  return requireStaffViewer();
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
