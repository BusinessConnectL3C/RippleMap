import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { getViewer, isOrgAdmin, listVisibleMaps } from "@/lib/felt/access";
import { getMapActivity } from "@/lib/felt/activity";
import { listTemplates } from "@/lib/felt/templates";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapWidget, type MapWidgetItem } from "@/components/dashboard/MapWidget";
import { SupportWidget } from "@/components/dashboard/SupportWidget";

const RECENT_LIMIT = 6;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const viewer = await getViewer(session.user.id);
  if (!viewer) redirect("/login");
  const isStaff = viewer.role === "BC_STAFF";

  const [org, openTickets, feltMaps, templates] = await Promise.all([
    db.organization.findUnique({ where: { id: viewer.orgId }, select: { arcgisGroupId: true, arcgisEnabled: true } }),
    // BC staff handle support in admin, so they don't get the support card.
    isStaff
      ? Promise.resolve(0)
      : db.supportTicket.count({ where: { orgId: viewer.orgId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    listVisibleMaps(viewer, { kind: ["MAP", "DASHBOARD"] }),
    isStaff || isOrgAdmin(viewer) ? listTemplates() : Promise.resolve([]),
  ]);

  const [activity, arcgisMaps] = await Promise.all([
    getMapActivity(feltMaps),
    org?.arcgisEnabled && org.arcgisGroupId
      ? listGroupItems(org.arcgisGroupId, "Web Map", RECENT_LIMIT).catch(() => [])
      : Promise.resolve([]),
  ]);

  const recentMaps: MapWidgetItem[] = [
    ...feltMaps.map((m): MapWidgetItem => {
      const a = activity.get(m.id);
      return {
        key: `felt:${m.id}`,
        title: m.title,
        href: `/maps/f/${m.feltMapId}`,
        kind: m.kind === "DASHBOARD" ? "dashboard" : "map",
        thumbnailUrl: m.thumbnailKey ? `/api/felt/maps/${m.feltMapId}/thumbnail?v=${m.updatedAt.getTime()}` : undefined,
        activity: a ? { at: a.at.toISOString(), kind: a.kind } : undefined,
      };
    }),
    ...arcgisMaps.map(
      (m): MapWidgetItem => ({
        key: `arcgis:${m.id}`,
        title: m.title,
        href: `/maps/${m.id}`,
        kind: "map",
        activity: m.modified ? { at: new Date(m.modified).toISOString(), kind: "modified" } : undefined,
      })
    ),
  ]
    .sort((a, b) => (b.activity?.at ?? "").localeCompare(a.activity?.at ?? ""))
    .slice(0, RECENT_LIMIT);

  const canCreate = templates.length > 0;
  const showSide = !isStaff || canCreate;
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Home" />
      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-6">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </h2>

        <div className={showSide ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" : undefined}>
          <MapWidget maps={recentMaps} />

          {showSide && (
            <div className="grid content-start gap-6 sm:grid-cols-2 xl:grid-cols-1">
              {!isStaff && <SupportWidget openCount={openTickets} />}
              {canCreate && (
                <Card>
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <p className="rm-eyebrow">New map</p>
                    <p className="text-sm text-text-secondary">
                      Start from a ready-made template, then add your own data.
                    </p>
                    <Button asChild size="sm" className="mt-auto gap-1.5 self-start">
                      <Link href="/maps/new">
                        <Plus className="h-4 w-4" /> New map
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
