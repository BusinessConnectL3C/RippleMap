import { NextRequest, NextResponse } from "next/server";
import { requireStaffViewer } from "@/lib/staff";
import { isFeltConfigured } from "@/lib/felt/client";
import { refreshThumbnail } from "@/lib/felt/thumbnails";

// Felt renders the image synchronously and can take up to ~55 s.
export const maxDuration = 60;

/** BC staff: regenerate one map's thumbnail now. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaffViewer())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isFeltConfigured()) {
    return NextResponse.json({ error: "FELT_API_TOKEN is not configured" }, { status: 503 });
  }

  const { id } = await params;
  try {
    await refreshThumbnail(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Thumbnail refresh failed for FeltMap ${id}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Thumbnail refresh failed" },
      { status: 502 }
    );
  }
}
