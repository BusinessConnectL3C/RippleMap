import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { MediaGallery } from "@/components/media/MediaGallery";

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { mediaSource: true },
  });

  if (!org?.mediaSource) redirect("/dashboard");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Media" />
      <div className="flex-1 overflow-auto p-6">
        <MediaGallery />
      </div>
    </div>
  );
}
