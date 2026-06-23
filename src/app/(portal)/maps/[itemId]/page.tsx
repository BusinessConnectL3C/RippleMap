import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getItem } from "@/lib/arcgis/items";
import { getBCAppToken } from "@/lib/arcgis/auth";
import { TopBar } from "@/components/layout/TopBar";
import { ArcGISMapEmbed } from "@/components/maps/ArcGISMapEmbed";

interface Props {
  params: Promise<{ itemId: string }>;
}

export default async function MapViewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { itemId } = await params;

  const [item, token] = await Promise.all([
    getItem(itemId),
    getBCAppToken(),
  ]);

  if (item.type !== "Web Map") notFound();

  return (
    <div className="flex flex-col h-full">
      <TopBar title={item.title} />
      <div className="flex-1 p-0">
        <ArcGISMapEmbed itemId={itemId} token={token} title={item.title} />
      </div>
    </div>
  );
}
