import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewUrl, SYSTEM_BUCKET } from "@/lib/aws/s3";
import {
  canManageLogo,
  canSeeLogo,
  currentViewer,
  LogoError,
  logoContentType,
  removeLogo,
  startLogoUpload,
} from "@/lib/org-logo";

/** The org's logo (members and RM Staff): redirect to a short-lived signed URL. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  const { id } = await params;
  if (!viewer || !canSeeLogo(viewer, id)) return new NextResponse(null, { status: 404 });
  const org = await db.organization.findUnique({ where: { id }, select: { logoKey: true } });
  if (!org?.logoKey) return new NextResponse(null, { status: 404 });
  const url = await getViewUrl(org.logoKey, SYSTEM_BUCKET, logoContentType(org.logoKey));
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=600" } });
}

const startSchema = z.object({ type: z.string().max(50), sizeBytes: z.number().int().positive() });

/** Start a logo upload: returns a size-locked PUT URL. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  const { id } = await params;
  if (!viewer || !canManageLogo(viewer, id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  try {
    return NextResponse.json(await startLogoUpload(id, parsed.data));
  } catch (err) {
    if (err instanceof LogoError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  const { id } = await params;
  if (!viewer || !canManageLogo(viewer, id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await removeLogo(id);
  return NextResponse.json({ ok: true });
}
