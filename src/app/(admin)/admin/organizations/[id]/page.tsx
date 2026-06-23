import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgEditForm } from "@/components/admin/OrgEditForm";
import { OnboardingResetButton } from "@/components/admin/OnboardingResetButton";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import { ChevronLeft } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOrgDetailPage({ params }: Props) {
  const { id } = await params;

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      onboardingState: true,
      users: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!org) notFound();

  const completedSteps = org.onboardingState?.completedSteps ?? [];
  const totalSteps = org.type === "NONPROFIT" ? 4 : 3;

  return (
    <div className="flex flex-col h-full">
      <TopBar title={org.name} />
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        <Link
          href="/admin/organizations"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" /> All organizations
        </Link>

        {/* Org details */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent>
            <OrgEditForm
              orgId={org.id}
              initialName={org.name}
              initialType={org.type as "NONPROFIT" | "CORPORATE"}
              initialArcgisGroupId={org.arcgisGroupId}
            />
          </CardContent>
        </Card>

        {/* Onboarding */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Onboarding</CardTitle>
            <OnboardingResetButton orgId={org.id} />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant={org.onboardingState?.completed ? "success" : "secondary"}>
                {org.onboardingState?.completed ? "Complete" : "In progress"}
              </Badge>
              <span className="text-sm text-gray-500">
                {completedSteps.length} / {totalSteps} steps done
              </span>
            </div>
            {completedSteps.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {completedSteps.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 font-mono"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({org.users.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {org.users.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No users in this org.</p>
            ) : (
              <UserRoleEditor
                users={org.users.map((u) => ({
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
