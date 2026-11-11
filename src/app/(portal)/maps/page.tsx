import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { getViewer, isOrgAdmin, listVisibleMaps } from "@/lib/felt/access";
import { autoSyncOrgMaps } from "@/lib/felt/sync";
import { refreshThumbnailQuietly } from "@/lib/felt/thumbnails";
import { after } from "next/server";
import type { ArcGISItem } from "@/types/arcgis";
import { TopBar } from "@/components/layout/TopBar";
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

  const items: GalleryItem[] = [
    ...feltMaps.map((m): GalleryItem => ({
      key: `felt:${m.id}`,
      title: m.title,
      ...FELT_KIND[m.kind as "MAP" | "DASHBOARD"],
      href: `/maps/f/${m.feltMapId}`,
      provider: "felt",
      updatedAt: m.updatedAt.getTime(),
      thumbnailUrl: m.thumbnailKey
        ? `/api/felt/maps/${m.feltMapId}/thumbnail?v=${m.updatedAt.getTime()}`
        : undefined,
    })),
    ...arcgisItems.map(arcgisGalleryItem),
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Maps & Apps" />
      <div className="flex-1 p-6">
        <MapGallery maps={items} showProvider={feltMaps.length > 0 && arcgisItems.length > 0} />
      </div>
    </div>
  );
}
