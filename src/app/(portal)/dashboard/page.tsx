import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listGroupItems } from "@/lib/arcgis/groups";
import { TopBar } from "@/components/layout/TopBar";
import { AccountStatusWidget } from "@/components/dashboard/AccountStatusWidget";
import { MapWidget } from "@/components/dashboard/MapWidget";
import { SupportWidget } from "@/components/dashboard/SupportWidget";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };

  const [org, arcgisLink, openTickets] = await Promise.all([
    db.organization.findUnique({ where: { id: su.orgId }, select: { arcgisGroupId: true } }),
    db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
    db.supportTicket.count({
      where: { orgId: su.orgId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  const recentMaps = org?.arcgisGroupId
    ? await listGroupItems(org.arcgisGroupId, "Web Map", 6).catch(() => [])
    : [];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Home" />
      <div className="flex-1 p-6 space-y-6">
        <p className="text-gray-600">
          Welcome back, <span className="font-medium text-gray-900">{session.user.name}</span>
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <AccountStatusWidget
            arcgisUsername={arcgisLink?.username ?? null}
            orgId={arcgisLink?.orgId ?? null}
            tokenExpiry={arcgisLink?.tokenExpiry ?? null}
          />
          <SupportWidget openCount={openTickets} />
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500 mb-1">Active Forms</p>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-xs text-gray-400 mt-1">Survey123 forms available</p>
          </div>
        </div>

        <MapWidget maps={recentMaps} />
      </div>
    </div>
  );
}
