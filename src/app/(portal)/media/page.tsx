import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { MediaGallery } from "@/components/media/MediaGallery";
import { listFiles } from "@/lib/aws/s3";

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { mediaSource: true, s3Bucket: true, s3Prefix: true },
  });

  if (!org?.mediaSource) redirect("/dashboard");

  let files: Awaited<ReturnType<typeof listFiles>> = [];

  if (org.mediaSource === "S3") {
    if (!org.s3Bucket) redirect("/dashboard");
    try {
      files = await listFiles(org.s3Prefix ?? "", org.s3Bucket);
    } catch (err) {
      console.error("[MediaPage] listFiles failed:", err);
    }
  }

  // ARCGIS media support coming soon — mediaSource === "ARCGIS" falls through to empty gallery

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Media" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </p>
          {org.mediaSource === "ARCGIS" && (
            <span className="text-xs text-gray-400 italic">ArcGIS media coming soon</span>
          )}
        </div>
        <MediaGallery files={files} />
      </div>
    </div>
  );
}
