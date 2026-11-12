import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getViewer } from "@/lib/felt/access";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import { createMapFromTemplate, TemplateError } from "@/lib/felt/templates";
import { refreshThumbnailQuietly } from "@/lib/felt/thumbnails";

// The thumbnail renders in after(), up to ~55 s.
export const maxDuration = 120;

const schema = z.object({
  templateId: z.string().min(1),
  title: z.string().trim().min(1, "Give the map a name").max(120),
});

/** Org owner/admin: create a new map in their org from a template. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeltConfigured()) return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const map = await createMapFromTemplate(viewer, parsed.data.templateId, parsed.data.title);
    after(() => refreshThumbnailQuietly(map.id));
    return NextResponse.json({ feltMapId: map.feltMapId }, { status: 201 });
  } catch (err) {
    if (err instanceof TemplateError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) {
      console.error(`Template copy failed for org ${viewer.orgId}:`, err);
      return NextResponse.json({ error: "Felt couldn't create the map. Please try again." }, { status: 502 });
    }
    throw err;
  }
}
