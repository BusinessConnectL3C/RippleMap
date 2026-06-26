import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { MediaGallery } from "@/components/media/MediaGallery";
import { listFiles } from "@/lib/aws/s3";

const GJ_PREFIX = process.env.GOOD_JUSTICE_S3_PREFIX ?? "good-justice/";

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  if (su.orgId !== process.env.GOOD_JUSTICE_ORG_ID) redirect("/dashboard");

  const files = await listFiles(GJ_PREFIX).catch(() => []);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Media" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">{files.length} file{files.length !== 1 ? "s" : ""}</p>
        </div>
        <MediaGallery files={files} />
      </div>
    </div>
  );
}
