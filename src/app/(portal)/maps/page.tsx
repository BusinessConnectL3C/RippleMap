import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { getViewer, isOrgAdmin, listVisibleMaps } from "@/lib/felt/access";
import { autoSyncOrgMaps } from "@/lib/felt/sync";
import { getMapActivity } from "@/lib/felt/activity";
import { refreshThumbnailQuietly } from "@/lib/felt/thumbnails";
import { after } from "next/server";
import type { ArcGISItem } from "@/types/arcgis";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { listTemplates } from "@/lib/felt/templates";
import { MapGallery, type GalleryItem } from "@/components/maps/MapGallery";

const ARCGIS_TYPES = ["Web Map", "Dashboard", "Web Experience"];

const FELT_KIND: Record<"MAP" | "DASHBOARD", Pick<GalleryItem, "typeLabel" | "icon">> = {
  MAP: { typeLabel: "Map", icon: "map" },
  DASHBOARD: { typeLabel: "Dashboard", icon: "dashboard" },
};

function arcgisGalleryItem(item: ArcGISItem): GalleryItem {
  const external = item.type === "Web Experience";
  return {
    key: `arcgis:${item.id}`,
    title: item.title,
    typeLabel: item.type,
    icon: item.type === "Dashboard" ? "dashboard" : external ? "experience" : "map",
    href: external ? item.url || `https://www.arcgis.com/apps/instant/${item.id}` : `/maps/${item.id}`,
    external,
    provider: "arcgis",
    snippet: item.snippet,
    updatedAt: item.modified,
  };
}

export default async function MapsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const viewer = await getViewer(session.user.id);
  if (!viewer) redirect("/login");

  // Owners/admins: pick up maps created in Felt since the last check
  // (throttled to once every few minutes per org; never throws).
  if (isOrgAdmin(viewer)) {
    const synced = await autoSyncOrgMaps(viewer.orgId);
    if (synced?.added.length) {
      const ids = synced.added;
      after(async () => {
        for (const id of ids) await refreshThumbnailQuietly(id);
      });
    }
  }

  const [feltMaps, org] = await Promise.all([
    // Survey maps are listed under Forms & Surveys instead.
    listVisibleMaps(viewer, { kind: ["MAP", "DASHBOARD"] }),
    db.organization.findUnique({
      where: { id: viewer.orgId },
      select: { arcgisEnabled: true, arcgisGroupId: true },
    }),
  ]);

  // ArcGIS items are org-wide (group-scoped), as before. They're only shown
  // for orgs that still use Esri.
  const arcgisItems =
    org?.arcgisEnabled && org.arcgisGroupId
      ? (await listGroupItems(org.arcgisGroupId, undefined, 100).catch(() => [])).filter((item) =>
          ARCGIS_TYPES.includes(item.type)
        )
      : [];

  // Owners/admins (and BC staff) can start a map from a template.
  const canCreate = (viewer.role === "BC_STAFF" || isOrgAdmin(viewer)) && (await listTemplates()).length > 0;

  const activity = await getMapActivity(feltMaps);

  const items: GalleryItem[] = [
    ...feltMaps.map((m): GalleryItem => ({
      key: `felt:${m.id}`,
      title: m.title,
      ...FELT_KIND[m.kind as "MAP" | "DASHBOARD"],
      href: `/maps/f/${m.feltMapId}`,
      provider: "felt",
      updatedAt: (activity.get(m.id)?.at ?? m.createdAt).getTime(),
      thumbnailUrl: m.thumbnailKey
        ? `/api/felt/maps/${m.feltMapId}/thumbnail?v=${m.updatedAt.getTime()}`
        : undefined,
    })),
    ...arcgisItems.map(arcgisGalleryItem),
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Maps & Apps" />
      <div className="flex-1 p-6 space-y-4">
        {canCreate && (
          <div className="flex justify-end">
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/maps/new">
                <Plus className="h-4 w-4" /> New map
              </Link>
            </Button>
          </div>
        )}
        <MapGallery maps={items} showProvider={feltMaps.length > 0 && arcgisItems.length > 0} />
      </div>
    </div>
  );
}
