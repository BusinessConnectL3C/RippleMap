import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getItem } from "@/lib/arcgis/items";
import { getBCAppToken } from "@/lib/arcgis/auth";
import { getWebMapLayers } from "@/lib/arcgis/featureLayer";
import { TopBar } from "@/components/layout/TopBar";
import { ArcGISMapEmbed } from "@/components/maps/ArcGISMapEmbed";
import { DashboardEmbed } from "@/components/maps/DashboardEmbed";
import { Button } from "@/components/ui/button";
import { Table } from "lucide-react";

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

  const layers =
    item.type === "Web Map" ? await getWebMapLayers(itemId).catch(() => []) : [];

  return (
    <div className="flex flex-col h-full">
      <TopBar title={item.title} backHref="/maps" backLabel="Maps & Apps" />
      {layers.length > 0 && (
        <div className="flex justify-end px-4 pt-3 sm:px-6">
          <Button asChild variant="outline" size="sm">
            <Link href={`/maps/${itemId}/data`}>
              <Table className="h-4 w-4" /> View data
            </Link>
          </Button>
        </div>
      )}
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
