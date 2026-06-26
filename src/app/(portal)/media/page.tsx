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
    select: { s3Bucket: true, s3Prefix: true },
  });

  if (!org?.s3Bucket) redirect("/dashboard");

  const prefix = org.s3Prefix ?? "";
  const files = await listFiles(prefix, org.s3Bucket).catch(() => []);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Media" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4">
          <p className="text-sm text-gray-500">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        </div>
        <MediaGallery files={files} />
      </div>
    </div>
  );
}
