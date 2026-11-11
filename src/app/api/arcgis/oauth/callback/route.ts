import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/arcgis/auth";
import { addUserToGroup } from "@/lib/arcgis/groups";
import { db } from "@/lib/db";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import { enableArcgisForOrg } from "@/lib/arcgis/enable";

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

    const [link, user, org] = await Promise.all([
      db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
      db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
      db.organization.findUnique({
        where: { id: su.orgId },
        include: { onboardingState: true },
      }),
    ]);

    // Connecting ArcGIS is how an org opts in to ArcGIS features. Only an
    // owner or admin can switch them on for the whole org; a member connecting
    // their own account just links it.
    let groupId = org?.arcgisGroupId ?? null;
    const canEnable = user?.role === "OWNER" || user?.role === "ADMIN";
    if (org && canEnable && (!org.arcgisEnabled || !groupId)) {
      groupId = await enableArcgisForOrg(su.orgId);
    }

    if (link && groupId) {
      try {
        await addUserToGroup(groupId, link.username);
      } catch (groupErr) {
        console.error("Failed to add user to ArcGIS group (non-fatal):", groupErr);
      }
    }

    const state = org?.onboardingState;
    if (!state || state.completed) {
      return NextResponse.redirect(new URL("/account", req.url));
    }

    // Connecting answers the "Do you also use ArcGIS?" step, if the user has
    // reached it.
    const done = new Set(state.completedSteps);
    const esriIndex = ONBOARDING_STEPS.findIndex((s) => s.id === "esri");
    const reached = ONBOARDING_STEPS.slice(0, esriIndex).every((s) => done.has(s.id));
    if (reached && !done.has("esri")) {
      done.add("esri");
      await db.onboardingState.update({
        where: { orgId: su.orgId },
        data: { completedSteps: [...done], currentStep: Math.max(state.currentStep, esriIndex + 1) },
      });
    }

    return NextResponse.redirect(new URL("/onboarding", req.url));
  } catch (err) {
    console.error("ArcGIS OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/onboarding?error=token_exchange", req.url)
    );
  }
}
