import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getOrgItem } from "@/lib/arcgis/access";
import { getUserToken } from "@/lib/arcgis/auth";
import { getWebMapLayers } from "@/lib/arcgis/featureLayer";
import { TopBar } from "@/components/layout/TopBar";
import { ArcGISMapEmbed } from "@/components/maps/ArcGISMapEmbed";
import { DashboardEmbed } from "@/components/maps/DashboardEmbed";
import { Button } from "@/components/ui/button";
import { Table, Link2 } from "lucide-react";

const SUPPORTED_TYPES = ["Web Map", "Dashboard"];

interface Props {
  params: Promise<{ itemId: string }>;
}

export default async function MapViewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { itemId } = await params;
  const su = session.user as unknown as { orgId: string };

  const item = await getOrgItem(su.orgId, itemId);
  if (!item || !SUPPORTED_TYPES.includes(item.type)) notFound();

  // The embedded ArcGIS viewer runs in the browser, so whatever token it gets
  // is visible to the user. Use the user's OWN linked ArcGIS token — it can
  // only see what that user can see in ArcGIS. Never pass BC's app or admin
  // tokens here: those can read every client org's items.
  const token = await getUserToken(session.user.id).catch(() => null);

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
        {!token ? (
          <div className="flex min-h-[600px] flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle">
              <Link2 className="h-6 w-6 text-brand" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-text-primary">Connect your ArcGIS account to view this map</p>
            <p className="max-w-sm text-sm text-text-secondary">
              ArcGIS maps open with your own ArcGIS sign-in, so you see exactly what your ArcGIS account has
              access to.
            </p>
            <Button asChild size="sm">
              <a href="/api/onboarding/link-arcgis">Connect ArcGIS account</a>
            </Button>
          </div>
        ) : item.type === "Dashboard" ? (
          <DashboardEmbed itemId={itemId} token={token} title={item.title} />
        ) : (
          <ArcGISMapEmbed itemId={itemId} token={token} title={item.title} />
        )}
      </div>
    </div>
  );
}
