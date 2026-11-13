import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/felt/access";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import { getPrintPreviews, PrintError } from "@/lib/felt/print";

// Building a missing preview makes and deletes a page in Felt; cached after.
export const maxDuration = 120;

/** Wireframes of print layouts for the layout picker: ?ids=a,b&orientation=landscape */
export async function GET(req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeltConfigured()) return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });
  const { feltMapId } = await params;
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const orientation = req.nextUrl.searchParams.get("orientation") === "portrait" ? "portrait" : "landscape";
  try {
    const previews = await getPrintPreviews(viewer, feltMapId, ids, orientation);
    return NextResponse.json({ previews }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    if (err instanceof PrintError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't load layout previews" }, { status: 502 });
    throw err;
  }
}
