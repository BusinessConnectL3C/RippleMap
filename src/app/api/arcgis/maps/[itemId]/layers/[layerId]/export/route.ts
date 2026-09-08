import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getAuthorizedLayer,
  getFeatureLayerFields,
  queryAllFeatureLayerRecords,
  LayerAccessError,
} from "@/lib/arcgis/featureLayer";
import { toCSV, toJSONRecords, toXLSX } from "@/lib/arcgis/export";

const FORMATS = ["csv", "xlsx", "json"] as const;
type Format = (typeof FORMATS)[number];

function isFormat(value: string | null): value is Format {
  return !!value && (FORMATS as readonly string[]).includes(value);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80) || "layer";
}

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
  const format = searchParams.get("format");
  if (!isFormat(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  try {
    const layer = await getAuthorizedLayer(org?.arcgisGroupId, itemId, layerId);
    const [fields, records] = await Promise.all([
      getFeatureLayerFields(layer.url),
      queryAllFeatureLayerRecords(layer.url),
    ]);

    const filename = sanitizeFilename(layer.title);

    if (format === "csv") {
      return new NextResponse(toCSV(records, fields), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    if (format === "json") {
      return new NextResponse(JSON.stringify(toJSONRecords(records, fields), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    const buffer = await toXLSX(records, fields, layer.title);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (err) {
    if (err instanceof LayerAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
