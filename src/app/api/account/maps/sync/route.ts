import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { getViewer, isOrgAdmin } from "@/lib/felt/access";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import { SyncError, syncOrgMaps } from "@/lib/felt/sync";
import { refreshThumbnailQuietly } from "@/lib/felt/thumbnails";

// Thumbnails for newly found maps render in after(), up to ~55 s each.
export const maxDuration = 300;

/** Org OWNER/ADMIN: check the org's Felt project for new or changed maps now. */
export async function POST() {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOrgAdmin(viewer)) {
    return NextResponse.json({ error: "Only organization owners and admins can do this" }, { status: 403 });
  }
  if (!isFeltConfigured()) {
    return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });
  }

  try {
    const result = await syncOrgMaps(viewer.orgId);
    after(async () => {
      for (const id of result.added) await refreshThumbnailQuietly(id);
    });
    return NextResponse.json({
      added: result.added.length,
      madePublic: result.madePublic,
      madePrivate: result.madePrivate,
    });
  } catch (err) {
    if (err instanceof SyncError) return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof FeltApiError) {
      console.error(`Felt sync failed for org ${viewer.orgId}:`, err);
      return NextResponse.json({ error: "Couldn't check for new maps. Please try again." }, { status: 502 });
    }
    throw err;
  }
}
