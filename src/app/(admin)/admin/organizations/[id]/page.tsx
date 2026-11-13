import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
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
import { PrintLayoutsPanel } from "@/components/admin/PrintLayoutsPanel";
import { checkMediaScope } from "@/lib/aws/media";
import { SHARED_MEDIA_BUCKET } from "@/lib/aws/s3";
import { feltSeatUsage } from "@/lib/felt/seats";
import { orgProjectName } from "@/lib/felt/projects";
import { BILLING_STATUS_BADGE, BILLING_STATUS_LABEL, toDateInput } from "@/lib/billing";
import { Building2 } from "lucide-react";
import { AdminOrgTabs } from "@/components/admin/AdminOrgTabs";
import { AdminInvitePanel } from "@/components/admin/AdminInvitePanel";
import { OrgLogoUploader } from "@/components/account/OrgLogoUploader";
import { orgLogoUrl } from "@/lib/org-logo";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminOrgDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  // The admin layout already requires RM Staff; this gives the signed-in staff member's id.
  const staff = await requireStaffViewer();
  if (!staff) notFound();

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      onboardingState: true,
      users: { orderBy: { createdAt: "asc" } },
      feltMaps: { orderBy: { title: "asc" }, include: { _count: { select: { grants: true } } } },
      billing: true,
      invites: { where: { status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!org) notFound();

  const workspaceSeats = await feltSeatUsage();
  const seatHolders = org.users.filter((u) => u.feltSeat);

  // Ignore legacy step ids from the Esri-era onboarding flow.
  const completedSteps = (org.onboardingState?.completedSteps ?? []).filter(isStepId);
  const totalSteps = ONBOARDING_STEPS.length;

  const isInternal = org.users.some((u) => u.role === "BC_STAFF");
  const hasOwner = org.users.some((u) => u.role === "OWNER" || u.role === "BC_STAFF");
  const logoUrl = orgLogoUrl(org.id, org.logoKey);
  const feltConfigured = isFeltConfigured();

  const summary: { label: string; value: React.ReactNode; tab?: string }[] = [
    { label: "People", value: `${org.users.length} ${org.users.length === 1 ? "user" : "users"}${org.invites.length ? ` · ${org.invites.length} invited` : ""}`, tab: "people" },
    { label: "Maps", value: `${org.feltMaps.length} registered`, tab: "maps" },
    {
      label: "Plan",
      value: org.billing ? (
        <Badge variant={BILLING_STATUS_BADGE[org.billing.status]}>{BILLING_STATUS_LABEL[org.billing.status]}</Badge>
      ) : (
        "Free (no record)"
      ),
      tab: "billing",
    },
    { label: "Felt seats", value: `${seatHolders.length} of ${org.billing?.feltSeats ?? "—"} used`, tab: "people" },
    { label: "Felt project", value: org.feltProjectId ? "Connected" : "Not set up", tab: org.feltProjectId ? undefined : "maps" },
    { label: "Support list", value: org.clickupListId ? "Connected" : "Shared list", tab: "settings" },
    { label: "ArcGIS", value: org.arcgisEnabled ? (org.arcgisGroupId ? "On" : "On, no group") : "Off", tab: "settings" },
    { label: "Media", value: org.mediaSource === "S3" ? "On" : "Off", tab: "settings" },
  ];

  const overview = (
    <>
      <Card>
        <CardContent className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-gray-100 p-0 sm:grid-cols-4">
          {summary.map((item) => {
            const body = (
              <>
                <p className="rm-eyebrow">{item.label}</p>
                <div className="mt-1 text-sm font-medium text-gray-900">{item.value}</div>
              </>
            );
            return item.tab ? (
              <Link key={item.label} href={`?tab=${item.tab}`} scroll={false} className="block bg-white p-4 hover:bg-gray-50 hover:no-underline">
                {body}
              </Link>
            ) : (
              <div key={item.label} className="bg-white p-4">
                {body}
              </div>
            );
          })}
        </CardContent>
      </Card>

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
                <span key={s} className="rounded-full bg-green-100 px-2 py-0.5 font-mono text-xs text-green-800">
                  {s}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  const people = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users ({org.users.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {org.users.length === 0 ? (
            <p className="text-sm text-gray-600">No users in this organization yet.</p>
          ) : (
            <div className="-mx-6 overflow-x-auto border-y border-gray-100">
              <UserRoleEditor
                isInternalOrg={isInternal}
                currentUserId={staff.id}
                users={org.users.map((u) => ({
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  feltSeat: u.feltSeat,
                  feltAccess: u.feltAccess,
                }))}
              />
            </div>
          )}
          <AdminInvitePanel
            orgId={org.id}
            hasOwner={hasOwner}
            pending={org.invites.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role as "OWNER" | "ADMIN" | "MEMBER",
              expiresAt: i.expiresAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

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
    </>
  );

  const maps = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Felt Maps ({org.feltMaps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <FeltMapsPanel
            orgId={org.id}
            feltProjectId={org.feltProjectId}
            feltConfigured={feltConfigured}
            isInternalOrg={isInternal}
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
      {feltConfigured && (
        <Card id="print-layouts">
          <CardHeader>
            <CardTitle>Print Layouts</CardTitle>
          </CardHeader>
          <CardContent>
            <PrintLayoutsPanel orgId={org.id} />
          </CardContent>
        </Card>
      )}
    </>
  );

  const billing = (
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
  );

  const settings = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgLogoUploader orgId={org.id} logoUrl={logoUrl} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organization Details &amp; Integrations</CardTitle>
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
            initialMedia={{ enabled: org.mediaSource === "S3", s3Bucket: org.s3Bucket, s3Prefix: org.s3Prefix }}
            sharedBucketName={SHARED_MEDIA_BUCKET}
            mediaProblem={
              org.mediaSource === "S3"
                ? (() => {
                    const check = checkMediaScope(org.s3Bucket, org.s3Prefix);
                    return check.ok ? null : check.reason;
                  })()
                : null
            }
          />
        </CardContent>
      </Card>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">Permanently delete this organization and all of its data.</p>
          <DeleteOrgButton orgId={org.id} orgName={org.name} userCount={org.users.length} />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar title={org.name} backHref="/admin/organizations" backLabel="All organizations" />
      <div className="flex-1 max-w-4xl space-y-5 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white p-1.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- same-origin redirect to a signed URL
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <Building2 className="h-6 w-6 text-gray-400" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-gray-900">{org.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <Badge variant="secondary">{org.type === "CORPORATE" ? "Corporate" : "Nonprofit"}</Badge>
              {isInternal && <Badge variant="brand">RippleMap (RM Staff)</Badge>}
              {!hasOwner && <Badge variant="warning">No owner yet</Badge>}
              <span>Created {org.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>
        </div>

        <AdminOrgTabs
          active={tab}
          tabs={[
            { value: "overview", label: "Overview", content: overview },
            { value: "people", label: "People", badge: org.users.length, content: people },
            { value: "maps", label: "Maps", badge: org.feltMaps.length, content: maps },
            { value: "billing", label: "Billing", content: billing },
            { value: "settings", label: "Settings", content: settings },
          ]}
        />
      </div>
    </div>
  );
}
