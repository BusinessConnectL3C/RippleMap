import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ONBOARDING_STEPS, isStepId } from "@/lib/onboarding/steps";

/** Mark an onboarding step complete (or skipped). Steps must be done in order. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const su = session.user as unknown as { orgId: string };
  const body = await req.json().catch(() => null);
  const step: unknown = body?.step;
  if (!isStepId(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const state = await db.onboardingState.findUnique({ where: { orgId: su.orgId } });
  if (!state) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }
  if (state.completed) {
    return NextResponse.json({ onboardingComplete: true });
  }

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  const done = new Set(state.completedSteps);

  for (let i = 0; i < stepIndex; i++) {
    if (!done.has(ONBOARDING_STEPS[i].id)) {
      return NextResponse.json({ error: "Previous steps not complete" }, { status: 400 });
    }
  }

  done.add(step);
  const allComplete = ONBOARDING_STEPS.every((s) => done.has(s.id));

  await db.onboardingState.update({
    where: { orgId: su.orgId },
    data: {
      completedSteps: [...done],
      currentStep: Math.max(state.currentStep, stepIndex + 1),
      completed: allComplete,
    },
  });

  return NextResponse.json({ onboardingComplete: allComplete });
}
