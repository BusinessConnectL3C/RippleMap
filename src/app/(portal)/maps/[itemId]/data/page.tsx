import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getItem } from "@/lib/arcgis/items";
import { listGroupItems } from "@/lib/arcgis/groups";
import { getWebMapLayers } from "@/lib/arcgis/featureLayer";
import { TopBar } from "@/components/layout/TopBar";
import { FeatureLayerExplorer } from "@/components/maps/FeatureLayerExplorer";

interface Props {
  params: Promise<{ itemId: string }>;
}

export default async function MapDataPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { itemId } = await params;

  const su = session.user as unknown as { orgId: string };
  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    select: { arcgisGroupId: true },
  });
  if (!org?.arcgisGroupId) notFound();

  const groupItems = await listGroupItems(org.arcgisGroupId, undefined, 100).catch(() => []);
  if (!groupItems.some((item) => item.id === itemId)) notFound();

  const [item, layers] = await Promise.all([getItem(itemId), getWebMapLayers(itemId)]);

  if (layers.length === 0) notFound();

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={`${item.title} — Data`}
        backHref={`/maps/${itemId}`}
        backLabel={item.title}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <FeatureLayerExplorer
          itemId={itemId}
          layers={layers.map(({ id, title }) => ({ id, title }))}
        />
      </div>
    </div>
  );
}
