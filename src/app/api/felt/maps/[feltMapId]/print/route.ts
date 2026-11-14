import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/felt/access";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import {
  listPrintOptions,
  PAPER_SIZES,
  PRINT_DPI,
  PRINT_FORMATS,
  PrintError,
  printSavedPage,
  printWithLayout,
} from "@/lib/felt/print";

// Creating a page, rendering it (Felt waits up to 55 s) and deleting it; with
// filters, also copying the map, waiting for its layers, and deleting it.
export const maxDuration = 300;

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-85.051129).max(85.051129);
const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LAYOUT"),
    layoutId: z.string().min(1).max(100),
    size: z.enum(PAPER_SIZES),
    orientation: z.enum(["portrait", "landscape"]),
    format: z.enum(PRINT_FORMATS),
    dpi: z.union([z.literal(PRINT_DPI[0]), z.literal(PRINT_DPI[1])]),
    bounds: z.tuple([lng, lat, lng, lat]).optional(),
    layerIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(200).optional(),
    title: z.string().max(200).optional(),
    fileName: z.string().max(120).optional(),
    // Felt Style Language filters per layer; bounded so a request can't be huge.
    filters: z
      .array(z.object({ layerId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), filters: z.unknown() }))
      .max(50)
      .optional()
      .refine((f) => !f || JSON.stringify(f).length < 50_000, "Filters too large"),
  }),
  z.object({ kind: z.literal("PAGE"), pageId: z.string().min(1).max(100) }),
]);

async function viewerOrNull() {
  const session = await auth();
  return session?.user?.id ? getViewer(session.user.id) : null;
}

function errorResponse(err: unknown) {
  if (err instanceof PrintError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof FeltApiError) {
    console.error("Felt print failed:", err);
    const timedOut = err.status === 504;
    return NextResponse.json(
      {
        error: timedOut
          ? "This print took too long to build. Try a smaller page or lower quality."
          : "Couldn't make this print. Please try again.",
      },
      { status: 502 }
    );
  }
  throw err;
}

/** Layouts and saved print pages available for this map. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const viewer = await viewerOrNull();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeltConfigured()) return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });
  const { feltMapId } = await params;
  try {
    return NextResponse.json(await listPrintOptions(viewer, feltMapId), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Make a print; returns Felt's short-lived download link. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const viewer = await viewerOrNull();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeltConfigured()) return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid print settings" }, { status: 400 });
  const { feltMapId } = await params;
  try {
    const result =
      parsed.data.kind === "PAGE"
        ? await printSavedPage(viewer, feltMapId, parsed.data.pageId)
        : await printWithLayout(viewer, feltMapId, parsed.data);
    return NextResponse.json({ downloadUrl: result.download_url, filename: result.filename });
  } catch (err) {
    return errorResponse(err);
  }
}
