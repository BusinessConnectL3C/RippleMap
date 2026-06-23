import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStepsForOrgType } from "@/lib/onboarding/steps";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const su = session.user as unknown as { orgId: string };

  const [org, arcgisLink] = await Promise.all([
    db.organization.findUnique({
      where: { id: su.orgId },
      include: { onboardingState: true },
    }),
    db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
  ]);

  if (!org) redirect("/login");
  if (org.onboardingState?.completed) redirect("/dashboard");

  const steps = getStepsForOrgType(org.type as "NONPROFIT" | "CORPORATE");
  const completedSteps = org.onboardingState?.completedSteps ?? [];
  const arcgisConnected = !!arcgisLink;

  const orgTypeLabel = org.type === "NONPROFIT" ? "Nonprofit" : "Corporate";

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B4F72]">
          <span className="text-xl font-bold text-white">R</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to RippleMap</h1>
        <p className="text-gray-500">
          Complete the steps below to get your {orgTypeLabel} account set up.
        </p>
        <p className="mt-1 text-xs text-gray-400">Each step must be completed in order.</p>
      </div>

      <OnboardingChecklist
        steps={steps}
        completedSteps={completedSteps}
        arcgisConnected={arcgisConnected}
      />
    </div>
  );
}
