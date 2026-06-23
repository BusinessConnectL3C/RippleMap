import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getItem } from "@/lib/arcgis/items";
import { getBCAppToken } from "@/lib/arcgis/auth";
import { TopBar } from "@/components/layout/TopBar";
import { ArcGISMapEmbed } from "@/components/maps/ArcGISMapEmbed";
import { DashboardEmbed } from "@/components/maps/DashboardEmbed";

const SUPPORTED_TYPES = ["Web Map", "Dashboard"];

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

  if (!SUPPORTED_TYPES.includes(item.type)) notFound();

  return (
    <div className="flex flex-col h-full">
      <TopBar title={item.title} />
      <div className="flex-1 p-0 overflow-hidden">
        {item.type === "Dashboard" ? (
          <DashboardEmbed itemId={itemId} token={token} title={item.title} />
        ) : (
          <ArcGISMapEmbed itemId={itemId} token={token} title={item.title} />
        )}
      </div>
    </div>
  );
}
