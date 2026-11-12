import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/felt/access";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import {
  listReplaceableLayers,
  refreshFromLink,
  serializeUpload,
  startFileUpload,
  startUrlUpload,
  UploadError,
} from "@/lib/felt/uploads";

const layerName = z.string().trim().min(1, "Give the layer a name").max(120);
const schema = z.discriminatedUnion("kind", [
  // New layer from a file, or (with replacesUploadId) new data for a layer
  // that came from an earlier portal file upload.
  z.object({
    kind: z.literal("FILE"),
    fileName: z.string().min(1).max(255),
    sizeBytes: z.number().int().positive(),
    layerName: layerName.optional(),
    replacesUploadId: z.string().min(1).optional(),
    confirmed: z.boolean(),
  }),
  z.object({ kind: z.literal("URL"), url: z.string().min(1).max(2000), layerName, confirmed: z.boolean() }),
  // Re-fetch a layer that came from a link.
  z.object({ kind: z.literal("REFRESH_LINK"), replacesUploadId: z.string().min(1), confirmed: z.boolean() }),
]);

/** Start adding data to a map: a file (returns a size-locked upload URL) or a link (imports now). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeltConfigured()) return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { feltMapId } = await params;

  try {
    if (parsed.data.kind === "FILE") {
      const { uploadId, putUrl } = await startFileUpload(viewer, feltMapId, parsed.data);
      return NextResponse.json({ uploadId, putUrl }, { status: 201 });
    }
    if (parsed.data.kind === "REFRESH_LINK") {
      const upload = await refreshFromLink(viewer, feltMapId, parsed.data);
      return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
    }
    const upload = await startUrlUpload(viewer, feltMapId, parsed.data);
    return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't reach Felt. Please try again." }, { status: 502 });
    throw err;
  }
}

/** Layers on this map that came from portal uploads and can be replaced. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { feltMapId } = await params;
  try {
    const { layers, legacy } = await listReplaceableLayers(viewer, feltMapId);
    return NextResponse.json({ layers, legacy }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
