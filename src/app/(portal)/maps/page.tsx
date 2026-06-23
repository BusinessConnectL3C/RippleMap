import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { TopBar } from "@/components/layout/TopBar";
import { MapGallery } from "@/components/maps/MapGallery";

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { arcgisGroupId: true },
  });

  const maps = org?.arcgisGroupId
    ? await listGroupItems(org.arcgisGroupId, "Web Map", 50).catch(() => [])
    : [];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Maps" />
      <div className="flex-1 p-6">
        <MapGallery maps={maps} />
      </div>
    </div>
  );
}
