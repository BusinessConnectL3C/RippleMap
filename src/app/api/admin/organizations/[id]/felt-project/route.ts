import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { isFeltConfigured } from "@/lib/felt/client";
import { getOrCreateOrgProject } from "@/lib/felt/projects";

/** Create (or find) the org's private Felt project — the retry path when registration's attempt failed. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const feltProjectId = await getOrCreateOrgProject(org.name, org.id);
    await db.organization.update({ where: { id }, data: { feltProjectId } });
    return NextResponse.json({ feltProjectId });
  } catch (err) {
    console.error(`Failed to create Felt project for org ${id}:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Felt request failed" }, { status: 502 });
  }
}
