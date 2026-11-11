import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import {
  duplicateMapIntoProject,
  getMap,
  isPublicInFelt,
  lockDownMap,
  parseFeltMapId,
} from "@/lib/felt/maps";
import { syncOrgMaps } from "@/lib/felt/sync";
import { refreshThumbnailQuietly } from "@/lib/felt/thumbnails";

// Thumbnails render in after() once the response is sent, one map at a time
// (up to ~55 s each). Maps that don't finish in time can be refreshed from the
// admin Felt Maps card.
export const maxDuration = 300;

const kindSchema = z.enum(["MAP", "DASHBOARD", "SURVEY"]);

const bodySchema = z.discriminatedUnion("action", [
  // Register an existing Felt map (pasted URL or id) to this org.
  z.object({ action: z.literal("register"), map: z.string().min(1), kind: kindSchema.default("MAP") }),
  // Duplicate a template map into the org's project.
  z.object({
    action: z.literal("fromTemplate"),
    title: z.string().min(1).max(200),
    kind: kindSchema.default("MAP"),
    template: z.string().optional(), // URL or id; defaults to FELT_TEMPLATE_MAP_ID
  }),
  // Register every map in the org's Felt project that isn't registered yet.
  z.object({ action: z.literal("sync") }),
]);

function feltError(err: unknown) {
  if (err instanceof FeltApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status === 404 ? 404 : 502 });
  }
  throw err;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaffViewer())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isFeltConfigured()) {
    return NextResponse.json({ error: "FELT_API_TOKEN is not configured" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id: orgId } = await params;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { feltProjectId: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!org.feltProjectId) {
    return NextResponse.json({ error: "This org has no Felt project yet. Create it first." }, { status: 409 });
  }
  const projectId = org.feltProjectId;
  const body = parsed.data;

  try {
    if (body.action === "register") {
      const feltMapId = parseFeltMapId(body.map);
      if (!feltMapId) return NextResponse.json({ error: "Not a Felt map URL or id" }, { status: 400 });

      const existing = await db.feltMap.findUnique({ where: { feltMapId } });
      if (existing) {
        return NextResponse.json(
          { error: existing.orgId === orgId ? "Map is already registered" : "Map is registered to another organization" },
          { status: 409 }
        );
      }

      // The map must live in this org's private project: that's what keeps it
      // away from other orgs' Field Editors inside Felt.
      let map = await getMap(feltMapId);
      if (map.project_id !== projectId) {
        return NextResponse.json(
          { error: "That map isn't in this org's Felt project. Move it there in Felt first, then register it." },
          { status: 422 }
        );
      }
      // Same rule as sync: a map already public in Felt stays public and is
      // flagged for review; a private one gets viewer export/duplication off.
      const isPublic = isPublicInFelt(map);
      if (!isPublic) map = await lockDownMap(feltMapId);

      const row = await db.feltMap.create({
        data: {
          orgId,
          feltMapId,
          title: map.title,
          kind: body.kind,
          ...(isPublic && { visibility: "PUBLIC" as const, madePublicInFelt: true, publicSince: new Date() }),
        },
      });
      after(() => refreshThumbnailQuietly(row.id));
      return NextResponse.json({ map: row }, { status: 201 });
    }

    if (body.action === "fromTemplate") {
      const templateId = parseFeltMapId(body.template ?? process.env.FELT_TEMPLATE_MAP_ID ?? "");
      if (!templateId) {
        return NextResponse.json({ error: "No template map given and FELT_TEMPLATE_MAP_ID is not set" }, { status: 400 });
      }
      const map = await duplicateMapIntoProject(templateId, projectId, body.title);
      const row = await db.feltMap.create({
        data: { orgId, feltMapId: map.id, title: map.title, kind: body.kind },
      });
      after(() => refreshThumbnailQuietly(row.id));
      return NextResponse.json({ map: row }, { status: 201 });
    }

    // sync
    const result = await syncOrgMaps(orgId);
    after(async () => {
      for (const id of result.added) await refreshThumbnailQuietly(id);
    });
    return NextResponse.json({
      added: result.added.length,
      madePublic: result.madePublic,
      madePrivate: result.madePrivate,
      conflicts: result.conflicts,
    });
  } catch (err) {
    return feltError(err);
  }
}
