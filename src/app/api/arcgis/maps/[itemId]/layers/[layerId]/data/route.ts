import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAuthorizedLayer,
  queryFeatureLayerPage,
  LayerAccessError,
} from "@/lib/arcgis/featureLayer";

const MAX_PAGE_SIZE = 200;

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

  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("limit") ?? MAX_PAGE_SIZE) || MAX_PAGE_SIZE)
  );

  try {
    const layer = await getAuthorizedLayer(org?.arcgisGroupId, itemId, layerId);
    const { features, exceededTransferLimit } = await queryFeatureLayerPage(
      layer.url,
      offset,
      limit
    );
    return NextResponse.json({ features, hasMore: exceededTransferLimit });
  } catch (err) {
    if (err instanceof LayerAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
