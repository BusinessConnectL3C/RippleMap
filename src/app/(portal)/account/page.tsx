import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { ProfileForm } from "@/components/account/ProfileForm";
import { OrganizationForm } from "@/components/account/OrganizationForm";
import { MembersTable } from "@/components/account/MembersTable";
import { InvitePanel } from "@/components/account/InvitePanel";

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

  const tokenExpired = arcgisLink && arcgisLink.tokenExpiry < new Date();

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Account" />
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm initialName={user.name} email={user.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {su.role === "OWNER" ? (
              <OrganizationForm initialName={org?.name ?? ""} />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500">Organization</span>
                <span className="font-medium text-gray-900">{org?.name ?? "—"}</span>
                <span className="text-gray-500">Org Type</span>
                <span className="font-medium text-gray-900">{org?.type ?? "—"}</span>
              </div>
            )}
            <p className="text-xs text-gray-400">Only owners can edit organization info.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MembersTable members={members} currentUserId={session.user.id} currentUserRole={su.role} />
          </CardContent>
        </Card>

        {canManageMembers && (
          <Card>
            <CardHeader>
              <CardTitle>Invite Members</CardTitle>
            </CardHeader>
            <CardContent>
              <InvitePanel
                pendingInvites={pendingInvites.map((i) => ({
                  ...i,
                  role: i.role as "ADMIN" | "MEMBER",
                  expiresAt: i.expiresAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-gray-400">
              Each member connects their own ArcGIS account to preserve their individual ArcGIS permissions.
            </p>
            {arcgisLink ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {tokenExpired ? (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <Badge variant={tokenExpired ? "warning" : "success"}>
                    {tokenExpired ? "Token Expired" : "Connected"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-500">Username</span>
                  <span className="font-medium text-gray-900">{arcgisLink.username}</span>
                  <span className="text-gray-500">Organization</span>
                  <span className="font-medium text-gray-900">{arcgisLink.orgId}</span>
                  <span className="text-gray-500">Token expires</span>
                  <span className="font-medium text-gray-900">
                    {arcgisLink.tokenExpiry.toLocaleDateString()}
                  </span>
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
                <p className="text-sm text-gray-500">No ArcGIS account linked.</p>
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
