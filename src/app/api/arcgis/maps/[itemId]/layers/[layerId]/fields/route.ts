import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAuthorizedLayer,
  getFeatureLayerFields,
  LayerAccessError,
} from "@/lib/arcgis/featureLayer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string; layerId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId, layerId } = await params;
  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { arcgisGroupId: true },
  });

  try {
    const layer = await getAuthorizedLayer(org?.arcgisGroupId, itemId, layerId);
    const fields = await getFeatureLayerFields(layer.url);
    return NextResponse.json({ fields });
  } catch (err) {
    if (err instanceof LayerAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
