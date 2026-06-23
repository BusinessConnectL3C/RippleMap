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

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({ where: { id: su.orgId }, select: { arcgisGroupId: true } });
  if (!org?.arcgisGroupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const layers = await getFieldMapsLayers(org.arcgisGroupId);
  return NextResponse.json({ layers });
}
