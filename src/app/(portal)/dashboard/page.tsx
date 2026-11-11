import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { TopBar } from "@/components/layout/TopBar";
import { AccountStatusWidget } from "@/components/dashboard/AccountStatusWidget";
import { MapWidget, type MapWidgetItem } from "@/components/dashboard/MapWidget";
import { getViewer, listVisibleMaps } from "@/lib/felt/access";
import { SupportWidget } from "@/components/dashboard/SupportWidget";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };

  const viewer = await getViewer(session.user.id);
  if (!viewer) redirect("/login");

  const [org, arcgisLink, openTickets, feltMaps, fieldEditors] = await Promise.all([
    db.organization.findUnique({ where: { id: su.orgId }, select: { arcgisGroupId: true, arcgisEnabled: true } }),
    db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
    db.supportTicket.count({
      where: { orgId: su.orgId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    listVisibleMaps(viewer, { kind: ["MAP", "DASHBOARD"] }),
    db.user.findMany({ where: { orgId: su.orgId, feltSeat: true }, select: { name: true } }),
  ]);

  const [arcgisMaps, activeForms] = org?.arcgisEnabled && org.arcgisGroupId
    ? await Promise.all([
        listGroupItems(org.arcgisGroupId, "Web Map", 6).catch(() => []),
        listGroupItems(org.arcgisGroupId, "Form", 50).catch(() => []),
      ])
    : [[], []];

  const recentMaps: MapWidgetItem[] = [
    ...[...feltMaps]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((m) => ({ key: `felt:${m.id}`, title: m.title, href: `/maps/f/${m.feltMapId}` })),
    ...arcgisMaps.map((m) => ({ key: `arcgis:${m.id}`, title: m.title, href: `/maps/${m.id}` })),
  ].slice(0, 6);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Home" />
      <div className="flex-1 p-6 space-y-6">
        <p className="text-text-secondary">
          Welcome back, <span className="font-medium text-text-primary">{session.user.name}</span>
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <AccountStatusWidget
            hasMaps={feltMaps.length > 0}
            fieldEditors={fieldEditors.map((u) => u.name)}
            arcgis={org?.arcgisEnabled ? { username: arcgisLink?.username ?? null } : undefined}
          />
          <SupportWidget openCount={openTickets} />
          <div className="rounded-lg border border-border bg-surface-card p-6">
            <p className="rm-eyebrow mb-1">Active Forms</p>
            <p className="font-display text-3xl font-extrabold text-text-primary">{activeForms.length}</p>
            <p className="text-xs text-text-muted mt-1">Survey123 forms available</p>
          </div>
        </div>

        <MapWidget maps={recentMaps} />
      </div>
    </div>
  );
}
