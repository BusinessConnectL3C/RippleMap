import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { enableArcgisForOrg } from "@/lib/arcgis/enable";
import { checkMediaScope } from "@/lib/aws/media";

const schema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["NONPROFIT", "CORPORATE"]).optional(),
  arcgisGroupId: z.string().nullable().optional(),
  clickupListId: z.string().nullable().optional(),
  feltProjectId: z.string().regex(/^[A-Za-z0-9]{10,40}$/, "Invalid Felt project id").nullable().optional(),
  arcgisEnabled: z.boolean().optional(),
  // Media page: S3 bucket (blank = shared bucket) + folder prefix, or off.
  media: z
    .object({
      enabled: z.boolean(),
      s3Bucket: z.string().trim().max(63).nullable(),
      s3Prefix: z.string().trim().max(500).nullable(),
    })
    .optional(),
});

async function requireBCStaff() {
  const session = await auth();
  const su = session?.user as unknown as { role?: string } | undefined;
  if (!session?.user?.id || su?.role !== "BC_STAFF") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, type, arcgisGroupId, clickupListId, feltProjectId, arcgisEnabled, media } = parsed.data;

  let mediaData: { mediaSource: "S3" | null; s3Bucket: string | null; s3Prefix: string | null } | undefined;
  if (media) {
    if (!media.enabled) {
      mediaData = { mediaSource: null, s3Bucket: null, s3Prefix: null };
    } else {
      const check = checkMediaScope(media.s3Bucket, media.s3Prefix);
      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
      mediaData = {
        mediaSource: "S3",
        // Store blank for the shared bucket so a later bucket rename via env still applies.
        s3Bucket: media.s3Bucket?.trim() || null,
        s3Prefix: check.scope.prefix,
      };
    }
  }

  const existing = await db.organization.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.organization.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(arcgisGroupId !== undefined && { arcgisGroupId }),
        ...(clickupListId !== undefined && { clickupListId }),
        ...(feltProjectId !== undefined && { feltProjectId }),
        ...(arcgisEnabled !== undefined && { arcgisEnabled }),
        ...(mediaData ?? {}),
      },
  });

  // Enabling ArcGIS for an org with no group yet: create its private group.
  if (arcgisEnabled) await enableArcgisForOrg(id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id },
    include: { users: { select: { role: true } } },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (org.users.some((u) => u.role === "BC_STAFF")) {
    return NextResponse.json(
      { error: "Cannot delete an organization with BC staff accounts" },
      { status: 409 }
    );
  }

  await db.$transaction([
    db.supportTicket.deleteMany({ where: { orgId: id } }),
    db.user.deleteMany({ where: { orgId: id } }),
    db.organization.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
