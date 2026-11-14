import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/felt/access";
import { FeltApiError } from "@/lib/felt/client";
import { refreshThumbnailQuietly } from "@/lib/felt/thumbnails";
import { refreshUploadStatus, serializeUpload, UploadError } from "@/lib/felt/uploads";

export const maxDuration = 120;

/** Poll an upload's import status. When it completes, the map's thumbnail is refreshed. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ feltMapId: string; uploadId: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feltMapId, uploadId } = await params;
  try {
    const { upload, completedNow } = await refreshUploadStatus(viewer, feltMapId, uploadId);
    if (completedNow) after(() => refreshThumbnailQuietly(upload.mapId));
    return NextResponse.json({ upload: serializeUpload(upload) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't reach the map service" }, { status: 502 });
    throw err;
  }
}
