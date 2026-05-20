import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGroupItems } from "@/lib/arcgis/groups";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { arcgisGroupId: true } });
  if (!user?.arcgisGroupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const maps = await listGroupItems(user.arcgisGroupId, "Web Map");
  return NextResponse.json({ maps });
}
