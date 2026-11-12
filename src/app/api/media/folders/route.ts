import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listFolders } from "@/lib/aws/s3";
import { getOrgMediaScope } from "@/lib/aws/media";

export async function GET() {
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

  const folders = await listFolders(scope.prefix, scope.bucket);
  return NextResponse.json({ folders });
}
