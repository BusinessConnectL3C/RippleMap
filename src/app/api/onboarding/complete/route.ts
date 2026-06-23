import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const su = session.user as unknown as { orgId: string };

  await db.onboardingState.update({
    where: { orgId: su.orgId },
    data: {
      currentStep: 4,
      completedSteps: { push: "explore" },
      completed: true,
    },
  });

  return NextResponse.json({ ok: true });
}
