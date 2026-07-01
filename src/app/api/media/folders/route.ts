import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listFolders } from "@/lib/aws/s3";

export async function GET() {
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

  const folders = await listFolders(org.s3Prefix ?? "", org.s3Bucket);
  return NextResponse.json({ folders });
}
