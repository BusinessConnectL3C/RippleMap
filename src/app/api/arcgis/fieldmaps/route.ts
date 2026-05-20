import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFieldMapsLayers, getRecentSubmissions } from "@/lib/arcgis/fieldmaps";

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

  const groupId = process.env.ARCGIS_GROUP_ID;
  if (!groupId) {
    return NextResponse.json({ error: "Group not configured" }, { status: 500 });
  }

  const layers = await getFieldMapsLayers(groupId);
  return NextResponse.json({ layers });
}
