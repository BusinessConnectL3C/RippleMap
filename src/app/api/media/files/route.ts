import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listFilesPage } from "@/lib/aws/s3";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { mediaSource: true, s3Bucket: true, s3Prefix: true },
  });

  if (!org?.mediaSource || org.mediaSource !== "S3" || !org.s3Bucket) {
    return NextResponse.json({ error: "No media configured" }, { status: 404 });
  }

  const { searchParams } = req.nextUrl;
  const requestedPrefix = searchParams.get("prefix") ?? "";
  const cursor = searchParams.get("cursor") ?? undefined;

  const orgPrefix = org.s3Prefix ?? "";

  // Ensure the requested prefix is scoped within the org's configured prefix
  const fullPrefix = orgPrefix + requestedPrefix;
  if (!fullPrefix.startsWith(orgPrefix)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = await listFilesPage(fullPrefix, org.s3Bucket, PAGE_SIZE, cursor);
  return NextResponse.json(page);
}
