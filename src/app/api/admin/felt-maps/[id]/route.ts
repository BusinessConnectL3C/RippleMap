import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { deleteFile } from "@/lib/aws/s3";
import { approvePublicMap, GrantError, setMapVisibility } from "@/lib/felt/access";
import { FeltApiError } from "@/lib/felt/client";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    kind: z.enum(["MAP", "DASHBOARD", "SURVEY"]).optional(),
    visibility: z.enum(["RESTRICTED", "ALL_MEMBERS", "PUBLIC"]).optional(),
    approvePublic: z.literal(true).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffViewer();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id } = await params;
  const { visibility, approvePublic, ...rest } = parsed.data;
  try {
    if (Object.keys(rest).length > 0) {
      const updated = await db.feltMap.updateMany({ where: { id }, data: rest });
      if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Visibility changes go through the shared helper so Public is mirrored in Felt.
    if (visibility) await setMapVisibility(staff, id, visibility);
    if (approvePublic) await approvePublicMap(staff, id);
  } catch (err) {
    if (err instanceof GrantError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
  return NextResponse.json({ ok: true });
}

/**
 * Unregister a map from RippleMap. This removes portal access (and its grants)
 * only — the map itself is left untouched in Felt.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaffViewer())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const map = await db.feltMap.findUnique({ where: { id }, select: { thumbnailKey: true } });
  if (!map) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.feltMap.delete({ where: { id } });
  if (map.thumbnailKey) {
    await deleteFile(map.thumbnailKey).catch((err) =>
      console.error(`Failed to delete thumbnail ${map.thumbnailKey}:`, err)
    );
  }
  return NextResponse.json({ ok: true });
}
