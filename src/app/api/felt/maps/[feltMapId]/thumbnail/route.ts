import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getViewer, getViewableMap, isOrgAdmin } from "@/lib/felt/access";
import { FeltApiError } from "@/lib/felt/client";
import { refreshThumbnail } from "@/lib/felt/thumbnails";
import { isValidFeltId } from "@/lib/felt/maps";
import { getViewUrl, SYSTEM_BUCKET } from "@/lib/aws/s3";

/**
 * Serve a map's thumbnail to someone allowed to view the map: check access,
 * then redirect to a short-lived presigned S3 URL. Same 404 for "no such map",
 * "no access" and "no thumbnail yet", so the gallery just falls back to its
 * icon.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const { feltMapId } = await params;
  if (!isValidFeltId(feltMapId)) return new NextResponse(null, { status: 404 });

  const viewer = await getViewer(session.user.id);
  const access = viewer ? await getViewableMap(viewer, feltMapId) : null;
  if (!access?.map.thumbnailKey) return new NextResponse(null, { status: 404 });

  const url = await getViewUrl(access.map.thumbnailKey, SYSTEM_BUCKET);
  return NextResponse.redirect(url, {
    status: 302,
    // Private: the redirect target is a per-request signed URL. Short enough
    // that revoked access stops showing the image soon after.
    headers: { "Cache-Control": "private, max-age=300" },
  });
}

// Felt renders the image synchronously and can take up to ~55 s.
export const maxDuration = 60;

const viewSchema = z.object({
  latitude: z.number().min(-85.051129).max(85.051129),
  longitude: z.number().min(-180).max(180),
  zoom: z.number().min(1).max(23),
});

/**
 * "Use this view as thumbnail": an org owner/admin (or BC staff) sets the
 * framing from the portal viewer. The view is saved and reused by later
 * refreshes.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feltMapId } = await params;
  if (!isValidFeltId(feltMapId)) return NextResponse.json({ error: "Map not found" }, { status: 404 });

  const viewer = await getViewer(session.user.id);
  const access = viewer ? await getViewableMap(viewer, feltMapId) : null;
  if (!viewer || !access) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  if (viewer.role !== "BC_STAFF" && !isOrgAdmin(viewer)) {
    return NextResponse.json({ error: "Only organization owners and admins can change thumbnails" }, { status: 403 });
  }

  const parsed = viewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid view" }, { status: 400 });

  try {
    await refreshThumbnail(access.map.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Thumbnail from view failed for FeltMap ${access.map.id}:`, err);
    const message = err instanceof FeltApiError ? "Couldn't render that view. Try zooming out a little." : "Thumbnail update failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
