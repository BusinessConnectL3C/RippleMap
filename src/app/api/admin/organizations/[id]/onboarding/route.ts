import { requireStaffViewer } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** DB-checked (not the JWT), so a demoted staff account loses access at once. */
async function requireBCStaff() {
  return requireStaffViewer();
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await db.onboardingState.update({
    where: { orgId: id },
    data: { currentStep: 0, completedSteps: [], completed: false },
  });

  return NextResponse.json({ ok: true });
}
