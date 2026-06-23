import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStepsForOrgType } from "@/lib/onboarding/steps";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const su = session.user as unknown as { orgId: string };
  const { step } = await req.json();
  if (!step || typeof step !== "string") {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const org = await db.organization.findUnique({
    where: { id: su.orgId },
    include: { onboardingState: true },
  });
  if (!org || !org.onboardingState) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const steps = getStepsForOrgType(org.type as "NONPROFIT" | "CORPORATE");
  const stepDef = steps.find((s) => s.id === step);
  if (!stepDef) {
    return NextResponse.json({ error: "Unknown step for org type" }, { status: 400 });
  }
  if (!stepDef.selfReport) {
    return NextResponse.json({ error: "Step cannot be self-reported" }, { status: 400 });
  }

  const stepIndex = steps.indexOf(stepDef);
  const { completedSteps } = org.onboardingState;

  // Ensure all prior steps are complete
  for (let i = 0; i < stepIndex; i++) {
    if (!completedSteps.includes(steps[i].id)) {
      return NextResponse.json({ error: "Previous steps not complete" }, { status: 400 });
    }
  }

  if (completedSteps.includes(step)) {
    return NextResponse.json({ onboardingComplete: false });
  }

  const newCompleted = [...completedSteps, step];
  const allComplete = steps.every(
    (s) => s.id === "arcgis_connect" || newCompleted.includes(s.id)
  );

  await db.onboardingState.update({
    where: { orgId: su.orgId },
    data: {
      completedSteps: newCompleted,
      currentStep: stepIndex + 1,
      completed: allComplete,
    },
  });

  return NextResponse.json({ onboardingComplete: allComplete });
}
