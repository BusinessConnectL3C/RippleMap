import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManageLogo, completeLogoUpload, currentViewer, LogoError } from "@/lib/org-logo";

const schema = z.object({ key: z.string().min(1).max(300) });

/** Finish a logo upload: verify the file and make it the org's logo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  const { id } = await params;
  if (!viewer || !canManageLogo(viewer, id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    await completeLogoUpload(id, parsed.data.key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof LogoError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
