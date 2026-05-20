import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { ProfileStep } from "./steps/ProfileStep";
import { ArcGISConnectStep } from "./steps/ArcGISConnectStep";
import { GroupJoinStep } from "./steps/GroupJoinStep";
import { ExploreStep } from "./steps/ExploreStep";

const STEP_MAP: Record<string, number> = {
  profile: 0,
  "arcgis-connect": 1,
  "group-join": 2,
  explore: 3,
};

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  profile: ProfileStep,
  "arcgis-connect": ArcGISConnectStep,
  "group-join": GroupJoinStep,
  explore: ExploreStep,
};

interface Props {
  params: Promise<{ step: string }>;
}

export default async function OnboardingStepPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { step } = await params;
  if (!(step in STEP_MAP)) redirect("/onboarding/profile");

  const state = await db.onboardingState.findUnique({
    where: { userId: session.user.id },
  });

  if (state?.completed) redirect("/dashboard");

  const StepComponent = STEP_COMPONENTS[step];
  const currentStep = STEP_MAP[step];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1B4F72]">
          <span className="text-xl font-bold text-white">R</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to RippleMap</h1>
        <p className="text-gray-500">Let&apos;s get your account set up</p>
      </div>

      <StepIndicator currentStep={currentStep} />

      <StepComponent />
    </div>
  );
}
