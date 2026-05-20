import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGroupItems } from "@/lib/arcgis/groups";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupId = process.env.ARCGIS_GROUP_ID;
  if (!groupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const maps = await listGroupItems(groupId, "Web Map");
  return NextResponse.json({ maps });
}
