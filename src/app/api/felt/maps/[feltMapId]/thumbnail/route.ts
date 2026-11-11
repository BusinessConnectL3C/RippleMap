import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getViewer, getViewableMap } from "@/lib/felt/access";
import { isValidFeltId } from "@/lib/felt/maps";
import { getViewUrl } from "@/lib/aws/s3";

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

  const url = await getViewUrl(access.map.thumbnailKey);
  return NextResponse.redirect(url, {
    status: 302,
    // Private: the redirect target is a per-request signed URL. Short enough
    // that revoked access stops showing the image soon after.
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
