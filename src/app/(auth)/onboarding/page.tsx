import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ONBOARDING_STEPS, isStepId } from "@/lib/onboarding/steps";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";

const ERRORS: Record<string, string> = {
  oauth_failed: "ArcGIS sign-in was cancelled or failed. You can try again, or continue without ArcGIS.",
  token_exchange: "We couldn't finish connecting your ArcGIS account. Please try again.",
};

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };

  const [org, user] = await Promise.all([
    db.organization.findUnique({
      where: { id: su.orgId },
      include: {
        onboardingState: true,
        _count: { select: { feltMaps: true } },
        users: { where: { feltSeat: true }, select: { name: true }, orderBy: { feltSeatSince: "asc" } },
      },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { role: true, emailVerifiedAt: true } }),
  ]);

  if (!org || !user) redirect("/login");
  if (!user.emailVerifiedAt) redirect("/verify-email");
  if (org.onboardingState?.completed) redirect("/dashboard");

  const canInvite = user.role === "OWNER" || user.role === "ADMIN";
  const pendingInvites = canInvite
    ? await db.orgInvite.findMany({
        where: { orgId: org.id, status: "PENDING" },
        select: { id: true, email: true, role: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const { error } = await searchParams;
  const errorMessage = error ? ERRORS[error] : undefined;

  const workspaceReady = !!org.feltProjectId && org._count.feltMaps > 0;
  const fieldEditors = org.users.map((u) => u.name);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <Logo type="secondary" tone="black" height={30} className="mx-auto mb-5" />
        <h1 className="text-2xl font-bold text-gray-900">Welcome to RippleMap</h1>
        <p className="text-gray-600">A few quick steps to get {org.name} set up.</p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      )}

      <OnboardingChecklist
        steps={ONBOARDING_STEPS}
        completedSteps={(org.onboardingState?.completedSteps ?? []).filter(isStepId)}
        canInvite={canInvite}
        pendingInvites={pendingInvites.map((i) => ({
          ...i,
          role: i.role as "ADMIN" | "MEMBER",
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />

      {/* Set up by BC, shown for information only: none of this blocks the steps above. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">What Business Connect is setting up for you</p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <dt className="font-medium text-gray-800">Your maps</dt>
              <dd className="text-gray-600">
                {workspaceReady
                  ? `${org._count.feltMaps} map${org._count.feltMaps === 1 ? "" : "s"} ready under Maps & Apps.`
                  : "We're preparing your first map. It will appear under Maps & Apps when it's ready."}
              </dd>
            </div>
            <Badge variant={workspaceReady ? "success" : "secondary"}>{workspaceReady ? "Ready" : "In progress"}</Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <dt className="font-medium text-gray-800">Field Editor</dt>
              <dd className="text-gray-600">
                {fieldEditors.length > 0
                  ? `${fieldEditors.join(", ")} can edit maps and collect data in the field.`
                  : "One named person in your organization can edit maps and collect field data. Tell us who through Support once you're in."}
              </dd>
            </div>
            <Badge variant={fieldEditors.length > 0 ? "success" : "secondary"}>
              {fieldEditors.length > 0 ? "Assigned" : "Not assigned"}
            </Badge>
          </div>
        </dl>
      </div>
    </div>
  );
}
