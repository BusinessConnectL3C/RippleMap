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
import { appendRecords, listAppendableLayers } from "@/lib/felt/records";
import { listEditableLayers, loadLayerForEditing, saveLayerEdits } from "@/lib/felt/data-editor";

// Adding records exports the layer from Felt first, which can take ~30 s.
export const maxDuration = 60;

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
  // Edit data: changed cells, deleted records and new columns on a portal CSV/GeoJSON layer.
  z.object({
    kind: z.literal("EDIT"),
    originUploadId: z.string().min(1),
    confirmed: z.boolean(),
    snapshot: z.string().regex(/^[a-f0-9]{64}$/),
    cells: z
      .array(
        z.object({
          row: z.number().int().min(0).max(100_000),
          column: z.string().min(1).max(200),
          value: z.union([z.string().max(2000), z.boolean(), z.null()]),
        })
      )
      .max(20_000),
    deleteRows: z.array(z.number().int().min(0).max(100_000)).max(5000),
    addColumns: z
      .array(
        z.object({
          name: z.string().min(1).max(63),
          type: z.enum(["TEXT", "REAL", "DATE", "BOOLEAN"]),
          defaultValue: z.union([z.string().max(2000), z.boolean(), z.null()]).optional(),
        })
      )
      .max(20),
  }),
  // Records typed in the portal, added to a layer from an earlier CSV/GeoJSON upload.
  z.object({
    kind: z.literal("RECORDS"),
    originUploadId: z.string().min(1),
    confirmed: z.boolean(),
    records: z
      .array(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          values: z.record(z.string().max(200), z.union([z.string().max(2000), z.boolean(), z.null()])),
        })
      )
      .min(1)
      .max(50),
  }),
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
    if (parsed.data.kind === "EDIT") {
      const upload = await saveLayerEdits(viewer, feltMapId, parsed.data.originUploadId, parsed.data);
      return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
    }
    if (parsed.data.kind === "RECORDS") {
      const upload = await appendRecords(viewer, feltMapId, parsed.data);
      return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
    }
    if (parsed.data.kind === "REFRESH_LINK") {
      const upload = await refreshFromLink(viewer, feltMapId, parsed.data);
      return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
    }
    const upload = await startUrlUpload(viewer, feltMapId, parsed.data);
    return NextResponse.json({ upload: serializeUpload(upload) }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't reach the map service. Please try again." }, { status: 502 });
    throw err;
  }
}

/**
 * Layers on this map that came from portal uploads and can be replaced, or
 * (?for=records) that records can be added to.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { feltMapId } = await params;
  try {
    const purpose = req.nextUrl.searchParams.get("for");
    if (purpose === "edit") {
      const layerId = req.nextUrl.searchParams.get("layer");
      if (layerId) return NextResponse.json(await loadLayerForEditing(viewer, feltMapId, layerId), { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ layers: await listEditableLayers(viewer, feltMapId) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (purpose === "records") {
      const layers = await listAppendableLayers(viewer, feltMapId);
      return NextResponse.json({ layers }, { headers: { "Cache-Control": "no-store" } });
    }
    const { layers, legacy } = await listReplaceableLayers(viewer, feltMapId);
    return NextResponse.json({ layers, legacy }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't reach the map service. Please try again." }, { status: 502 });
    throw err;
  }
}
