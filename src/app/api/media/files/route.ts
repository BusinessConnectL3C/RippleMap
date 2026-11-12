import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listFilesPage } from "@/lib/aws/s3";
import { getOrgMediaScope } from "@/lib/aws/media";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { id: true, mediaSource: true, s3Bucket: true, s3Prefix: true },
  });

  const scope = org ? getOrgMediaScope(org) : null;
  if (!scope) return NextResponse.json({ error: "No media configured" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  // Sub-folder within the org's scope, as returned by /api/media/folders.
  const requested = (searchParams.get("prefix") ?? "").replace(/^\/+/, "");
  if (requested.includes("..")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cursor = searchParams.get("cursor") ?? undefined;
  const fullPrefix = scope.prefix + requested;

  const page = await listFilesPage(fullPrefix, scope.bucket, PAGE_SIZE, cursor);
  return NextResponse.json(page);
}
