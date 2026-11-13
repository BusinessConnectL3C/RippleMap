import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";

/** RM Staff: revoke a pending invite. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  if (!(await requireStaffViewer())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, inviteId } = await params;
  const updated = await db.orgInvite.updateMany({
    where: { id: inviteId, orgId: id, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
