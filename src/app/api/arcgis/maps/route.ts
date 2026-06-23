import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGroupItems } from "@/lib/arcgis/groups";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({ where: { id: su.orgId }, select: { arcgisGroupId: true } });
  if (!org?.arcgisGroupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const maps = await listGroupItems(org.arcgisGroupId, "Web Map");
  return NextResponse.json({ maps });
}
