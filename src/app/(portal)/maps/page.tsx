import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listGroupItems } from "@/lib/arcgis/groups";
import { TopBar } from "@/components/layout/TopBar";
import { MapGallery } from "@/components/maps/MapGallery";

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const groupId = process.env.ARCGIS_GROUP_ID ?? "";
  const maps = groupId
    ? await listGroupItems(groupId, "Web Map", 50).catch(() => [])
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
