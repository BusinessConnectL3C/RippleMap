import { NextRequest, NextResponse } from "next/server";
import { requireStaffViewer } from "@/lib/staff";
import { FeltApiError } from "@/lib/felt/client";
import { getLayoutPreviews } from "@/lib/felt/print";
import { isValidFeltId } from "@/lib/felt/maps";

export const maxDuration = 120;

/** Staff: layout wireframes, built on any map (layouts are workspace-wide). ?mapId=&ids=&orientation= */
export async function GET(req: NextRequest) {
  if (!(await requireStaffViewer())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const mapId = req.nextUrl.searchParams.get("mapId") ?? "";
  if (!isValidFeltId(mapId)) return NextResponse.json({ error: "Invalid map" }, { status: 400 });
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 40);
  const orientation = req.nextUrl.searchParams.get("orientation") === "portrait" ? "portrait" : "landscape";
  try {
    return NextResponse.json({ previews: await getLayoutPreviews(mapId, ids, orientation) });
  } catch (err) {
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't load layout previews" }, { status: 502 });
    throw err;
  }
}
