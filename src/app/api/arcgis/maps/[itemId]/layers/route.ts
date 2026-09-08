import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { getWebMapLayers } from "@/lib/arcgis/featureLayer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;
  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { arcgisGroupId: true },
  });

  if (!org?.arcgisGroupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const groupItems = await listGroupItems(org.arcgisGroupId, undefined, 100);
  if (!groupItems.some((item) => item.id === itemId)) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  const layers = await getWebMapLayers(itemId);
  return NextResponse.json({
    layers: layers.map(({ id, title }) => ({ id, title })),
  });
}
