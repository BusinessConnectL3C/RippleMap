import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import { listWorkspaceLayouts } from "@/lib/felt/print";

/**
 * Felt's layout list is reached through a map, but layouts are workspace-wide:
 * use one of the org's maps, or any registered map.
 */
async function anyMapId(orgId: string): Promise<string | null> {
  const map =
    (await db.feltMap.findFirst({ where: { orgId }, select: { feltMapId: true } })) ??
    (await db.feltMap.findFirst({ select: { feltMapId: true } }));
  return map?.feltMapId ?? null;
}

/** Staff: every workspace layout, with this org's assignments. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaffViewer())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isFeltConfigured()) return NextResponse.json({ error: "Felt isn't configured" }, { status: 503 });
  const { id } = await params;
  const mapId = await anyMapId(id);
  if (!mapId) return NextResponse.json({ error: "Register at least one Felt map first: layouts are read through a map." }, { status: 409 });
  try {
    const [layouts, assignments] = await Promise.all([
      listWorkspaceLayouts(mapId),
      db.orgPrintLayout.findMany({ where: { orgId: id } }),
    ]);
    const byId = new Map(assignments.map((a) => [a.feltLayoutId, a]));
    // Assigned layouts that no longer exist in Felt are still listed, so staff can unassign them.
    const missing = assignments
      .filter((a) => !layouts.some((l) => l.id === a.feltLayoutId))
      .map((a) => ({ id: a.feltLayoutId, name: a.name, kind: "workspace" as const, orientation: null, shared: false, missing: true }));
    return NextResponse.json({
      mapId,
      layouts: [...layouts, ...missing].map((l) => ({
        ...l,
        assigned: byId.has(l.id) && !l.shared,
        isDefault: byId.get(l.id)?.isDefault ?? false,
      })),
    });
  } catch (err) {
    if (err instanceof FeltApiError) return NextResponse.json({ error: "Couldn't reach Felt" }, { status: 502 });
    throw err;
  }
}

const putSchema = z.object({
  /** Workspace layouts offered to this org (besides built-ins and shared "RippleMap …" ones). */
  assigned: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(300) })).max(100),
  /** Preselected layout: any layout the org can use, or null. */
  defaultLayout: z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(300) }).nullable(),
});

/** Staff: replace this org's assigned layouts and default. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaffViewer())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { id } = await params;
  const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { assigned, defaultLayout } = parsed.data;
  const rows = new Map(assigned.map((a) => [a.id, { name: a.name, isDefault: false }]));
  // A default that's a built-in or shared layout is stored as a default-only row.
  if (defaultLayout) rows.set(defaultLayout.id, { name: defaultLayout.name, isDefault: true });

  await db.$transaction([
    db.orgPrintLayout.deleteMany({ where: { orgId: id } }),
    db.orgPrintLayout.createMany({
      data: [...rows].map(([feltLayoutId, r]) => ({ orgId: id, feltLayoutId, name: r.name, isDefault: r.isDefault })),
    }),
  ]);
  return NextResponse.json({ ok: true });
}
