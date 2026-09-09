import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { ProfileForm } from "@/components/account/ProfileForm";
import { OrganizationForm } from "@/components/account/OrganizationForm";
import { MembersTable } from "@/components/account/MembersTable";
import { InviteMembersDialog } from "@/components/account/InviteMembersDialog";
import { orgTypeLabel } from "@/types/portal";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "BC_STAFF" };
  const canManageMembers = su.role === "OWNER" || su.role === "ADMIN";

  const [user, org, arcgisLink, members, pendingInvites] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, role: true } }),
    db.organization.findUnique({ where: { id: su.orgId }, select: { name: true, type: true } }),
    db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
    db.user.findMany({
      where: { orgId: su.orgId },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    canManageMembers
      ? db.orgInvite.findMany({
          where: { orgId: su.orgId, status: "PENDING" },
          select: { id: true, email: true, role: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  if (!user) redirect("/login");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Account" />
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        <Card>
          <ProfileForm initialName={user.name} email={user.email} />
        </Card>

        <Card>
          {su.role === "OWNER" ? (
            <OrganizationForm initialName={org?.name ?? ""} orgType={org?.type ? orgTypeLabel(org.type) : "—"} />
          ) : (
            <>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="rm-eyebrow">Organization</span>
                  <span className="font-medium text-text-primary">{org?.name ?? "—"}</span>
                  <span className="rm-eyebrow">Org Type</span>
                  <span className="font-medium text-text-primary">{org?.type ? orgTypeLabel(org.type) : "—"}</span>
                </div>
                <p className="text-xs text-text-muted">Only owners can edit organization info.</p>
              </CardContent>
            </>
          )}
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Organization Members</CardTitle>
            {canManageMembers && (
              <InviteMembersDialog
                pendingInvites={pendingInvites.map((i) => ({
                  ...i,
                  role: i.role as "ADMIN" | "MEMBER",
                  expiresAt: i.expiresAt.toISOString(),
                }))}
              />
            )}
          </CardHeader>
          <CardContent className="p-0">
            <MembersTable members={members} currentUserId={session.user.id} currentUserRole={su.role} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-text-muted">
              Each member connects their own ArcGIS account to preserve their individual ArcGIS permissions.
            </p>
            {arcgisLink ? (
              <div className="space-y-3">
                <Badge variant="success" dot>
                  Connected
                </Badge>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="rm-eyebrow">Username</span>
                  <span className="font-medium text-text-primary">{arcgisLink.username}</span>
                  <span className="rm-eyebrow">Organization</span>
                  <span className="font-medium text-text-primary">{arcgisLink.orgId}</span>
                </div>
                <a href="/api/onboarding/link-arcgis">
                  <Button variant="outline" size="sm" className="gap-1 mt-2">
                    <ExternalLink className="h-3 w-3" />
                    Re-authorize ArcGIS Access
                  </Button>
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">No ArcGIS account linked.</p>
                <a href="/api/onboarding/link-arcgis">
                  <Button size="sm" className="gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Connect ArcGIS Account
                  </Button>
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
