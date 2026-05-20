import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFieldMapsLayers, getRecentSubmissions } from "@/lib/arcgis/fieldmaps";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const serviceUrl = searchParams.get("serviceUrl");

  if (serviceUrl) {
    const submissions = await getRecentSubmissions(serviceUrl);
    return NextResponse.json({ submissions });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { arcgisGroupId: true } });
  if (!user?.arcgisGroupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const layers = await getFieldMapsLayers(user.arcgisGroupId);
  return NextResponse.json({ layers });
}
