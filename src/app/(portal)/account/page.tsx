import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string; role: string };

  const [user, org, arcgisLink] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, role: true } }),
    db.organization.findUnique({ where: { id: su.orgId }, select: { name: true, type: true } }),
    db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
  ]);

  if (!user) redirect("/login");

  const tokenExpired = arcgisLink && arcgisLink.tokenExpiry < new Date();

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Account" />
      <div className="flex-1 p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{user.name}</span>
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{user.email}</span>
              <span className="text-gray-500">Organization</span>
              <span className="font-medium text-gray-900">{org?.name ?? "—"}</span>
              <span className="text-gray-500">Org Type</span>
              <span className="font-medium text-gray-900">{org?.type ?? "—"}</span>
              <span className="text-gray-500">Role</span>
              <Badge variant="secondary" className="w-fit">{user.role}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ArcGIS Connection</CardTitle>
          </CardHeader>
          <CardContent>
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
