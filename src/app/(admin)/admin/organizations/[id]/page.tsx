import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgEditForm } from "@/components/admin/OrgEditForm";
import { OnboardingResetButton } from "@/components/admin/OnboardingResetButton";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import { FeltMapsPanel } from "@/components/admin/FeltMapsPanel";
import { isFeltConfigured } from "@/lib/felt/client";
import { ONBOARDING_STEPS, isStepId } from "@/lib/onboarding/steps";
import { DeleteOrgButton } from "@/components/admin/DeleteOrgButton";
import { BillingEditForm } from "@/components/admin/BillingEditForm";
import { FeltSeatsPanel } from "@/components/admin/FeltSeatsPanel";
import { feltSeatUsage } from "@/lib/felt/seats";
import { orgProjectName } from "@/lib/felt/projects";
import { toDateInput } from "@/lib/billing";
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
      feltMaps: { orderBy: { title: "asc" }, include: { _count: { select: { grants: true } } } },
      billing: true,
    },
  });

  if (!org) notFound();

  const workspaceSeats = await feltSeatUsage();
  const seatHolders = org.users.filter((u) => u.feltSeat);

  // Ignore legacy step ids from the Esri-era onboarding flow.
  const completedSteps = (org.onboardingState?.completedSteps ?? []).filter(isStepId);
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="flex flex-col h-full">
      <TopBar title={org.name} />
      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        <Link
          href="/admin/organizations"
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
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
              initialClickupListId={org.clickupListId}
              initialFeltProjectId={org.feltProjectId}
              initialArcgisEnabled={org.arcgisEnabled}
            />
          </CardContent>
        </Card>

        {/* Billing */}
        <Card id="billing">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <BillingEditForm
              orgId={org.id}
              isNew={!org.billing}
              initial={{
                plan: org.billing?.plan ?? "",
                status: org.billing?.status ?? "TRIAL",
                cycle: org.billing?.cycle ?? "",
                amount: org.billing?.amountCents != null ? String(org.billing.amountCents / 100) : "",
                feltSeats: String(org.billing?.feltSeats ?? 1),
                startDate: toDateInput(org.billing?.startDate),
                renewalDate: toDateInput(org.billing?.renewalDate),
                billingContactName: org.billing?.billingContactName ?? "",
                billingContactEmail: org.billing?.billingContactEmail ?? "",
                staffNotes: org.billing?.staffNotes ?? "",
              }}
            />
          </CardContent>
        </Card>

        {/* Felt seats */}
        <Card id="felt-seats">
          <CardHeader>
            <CardTitle>Felt Seats</CardTitle>
          </CardHeader>
          <CardContent>
            <FeltSeatsPanel
              workspace={workspaceSeats}
              org={{ used: seatHolders.length, included: org.billing?.feltSeats ?? null }}
              projectName={org.feltProjectId ? orgProjectName(org.name, org.id) : null}
              holders={seatHolders.map((u) => ({
                id: u.id,
                name: u.name,
                inviteEmail: u.feltEmail ?? u.email,
                hasCustomFeltEmail: !!u.feltEmail,
                access: u.feltAccess ?? "EDIT",
                accepted: !!u.feltInviteAcceptedAt,
              }))}
            />
          </CardContent>
        </Card>

        {/* Felt maps */}
        <Card>
          <CardHeader>
            <CardTitle>Felt Maps ({org.feltMaps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <FeltMapsPanel
              orgId={org.id}
              feltProjectId={org.feltProjectId}
              feltConfigured={isFeltConfigured()}
              isInternalOrg={org.users.some((u) => u.role === "BC_STAFF")}
              maps={org.feltMaps.map((m) => ({
                id: m.id,
                feltMapId: m.feltMapId,
                title: m.title,
                kind: m.kind,
                visibility: m.visibility,
                grantCount: m._count.grants,
                hasThumbnail: !!m.thumbnailKey,
                madePublicInFelt: m.madePublicInFelt,
                isTemplate: m.isTemplate,
                templateDescription: m.templateDescription,
              }))}
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
              <span className="text-sm text-gray-600">
                {completedSteps.length} / {totalSteps} steps done
              </span>
            </div>
            {completedSteps.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {completedSteps.map((s: string) => (
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
              <p className="p-4 text-sm text-gray-600">No users in this org.</p>
            ) : (
              <UserRoleEditor
                users={org.users.map((u) => ({
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  feltSeat: u.feltSeat,
                  feltAccess: u.feltAccess,
                }))}
              />
            )}
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Permanently delete this organization and all of its data.
            </p>
            <DeleteOrgButton orgId={org.id} orgName={org.name} userCount={org.users.length} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
