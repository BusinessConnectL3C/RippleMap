import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["NONPROFIT", "CORPORATE"]).optional(),
  arcgisGroupId: z.string().nullable().optional(),
  clickupListId: z.string().nullable().optional(),
  feltProjectId: z.string().regex(/^[A-Za-z0-9]{10,40}$/, "Invalid Felt project id").nullable().optional(),
  arcgisEnabled: z.boolean().optional(),
});

async function requireBCStaff() {
  const session = await auth();
  const su = session?.user as unknown as { role?: string } | undefined;
  if (!session?.user?.id || su?.role !== "BC_STAFF") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, type, arcgisGroupId, clickupListId, feltProjectId, arcgisEnabled } = parsed.data;

  const existing = await db.organization.findUnique({
    where: { id },
    include: { onboardingState: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const typeChanged = type !== undefined && type !== existing.type;

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(arcgisGroupId !== undefined && { arcgisGroupId }),
        ...(clickupListId !== undefined && { clickupListId }),
        ...(feltProjectId !== undefined && { feltProjectId }),
        ...(arcgisEnabled !== undefined && { arcgisEnabled }),
      },
    });

    // Reset onboarding when org type changes so steps match the new track
    if (typeChanged && existing.onboardingState) {
      await tx.onboardingState.update({
        where: { orgId: id },
        data: { currentStep: 0, completedSteps: [], completed: false },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
