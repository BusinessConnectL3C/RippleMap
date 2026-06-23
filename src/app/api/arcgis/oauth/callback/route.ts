import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/arcgis/auth";
import { addUserToGroup } from "@/lib/arcgis/groups";
import { db } from "@/lib/db";
import { getStepsForOrgType } from "@/lib/onboarding/steps";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/onboarding?error=oauth_failed", req.url)
    );
  }

  const su = session.user as unknown as { orgId: string };

  try {
    await exchangeCodeForTokens(session.user.id, code);

    const [link, org] = await Promise.all([
      db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
      db.organization.findUnique({
        where: { id: su.orgId },
        include: { onboardingState: true },
      }),
    ]);

    if (link && org?.arcgisGroupId) {
      try {
        await addUserToGroup(org.arcgisGroupId, link.username);
      } catch (groupErr) {
        console.error("Failed to add user to ArcGIS group (non-fatal):", groupErr);
      }
    }

    // Mark arcgis_connect complete and check if all steps are done
    if (org?.onboardingState && !org.onboardingState.completed) {
      const steps = getStepsForOrgType(org.type as "NONPROFIT" | "CORPORATE");
      const existing = org.onboardingState.completedSteps;
      const newCompleted = existing.includes("arcgis_connect")
        ? existing
        : [...existing, "arcgis_connect"];
      const allComplete = steps.every((s) => newCompleted.includes(s.id));

      await db.onboardingState.update({
        where: { orgId: su.orgId },
        data: {
          completedSteps: newCompleted,
          currentStep: steps.length,
          completed: allComplete,
        },
      });

      if (allComplete) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.redirect(new URL("/onboarding", req.url));
  } catch (err) {
    console.error("ArcGIS OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/onboarding?error=token_exchange", req.url)
    );
  }
}
