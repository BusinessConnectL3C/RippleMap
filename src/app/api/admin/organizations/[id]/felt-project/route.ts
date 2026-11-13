import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { isFeltConfigured } from "@/lib/felt/client";
import { getOrCreateOrgProject, ProjectLinkError, validateExistingProject } from "@/lib/felt/projects";

/**
 * Create (or find) the org's private Felt project — the retry path when
 * registration's attempt failed — or, with `{ existingProject }` (an id or
 * Felt link), connect a project that was already made in Felt.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaffViewer())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isFeltConfigured()) {
    return NextResponse.json({ error: "FELT_API_TOKEN is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { id }, select: { id: true, name: true, feltProjectId: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (org.feltProjectId) return NextResponse.json({ feltProjectId: org.feltProjectId });

  const body = (await req.json().catch(() => null)) as { existingProject?: unknown } | null;
  if (typeof body?.existingProject === "string") {
    try {
      const feltProjectId = await validateExistingProject(body.existingProject, org.id);
      await db.organization.update({ where: { id }, data: { feltProjectId } });
      return NextResponse.json({ feltProjectId });
    } catch (err) {
      if (err instanceof ProjectLinkError) return NextResponse.json({ error: err.message }, { status: 400 });
      console.error(`Failed to check Felt project for org ${id}:`, err);
      return NextResponse.json({ error: "Couldn't reach Felt to check that project." }, { status: 502 });
    }
  }

  try {
    const feltProjectId = await getOrCreateOrgProject(org.name, org.id);
    await db.organization.update({ where: { id }, data: { feltProjectId } });
    return NextResponse.json({ feltProjectId });
  } catch (err) {
    console.error(`Failed to create Felt project for org ${id}:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Felt request failed" }, { status: 502 });
  }
}
