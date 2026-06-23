import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { TopBar } from "@/components/layout/TopBar";
import { MapGallery } from "@/components/maps/MapGallery";

const SUPPORTED_TYPES = ["Web Map", "Dashboard"];

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { arcgisGroupId: true },
  });

  const allItems = org?.arcgisGroupId
    ? await listGroupItems(org.arcgisGroupId, undefined, 100).catch(() => [])
    : [];

  const maps = allItems.filter((item) => SUPPORTED_TYPES.includes(item.type));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Maps" />
      <div className="flex-1 p-6">
        <MapGallery maps={maps} />
      </div>
    </div>
  );
}
