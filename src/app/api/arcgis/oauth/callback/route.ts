import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/arcgis/auth";
import { addUserToGroup } from "@/lib/arcgis/groups";
import { db } from "@/lib/db";

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
      new URL(`/onboarding/arcgis-connect?error=oauth_failed`, req.url)
    );
  }

  try {
    await exchangeCodeForTokens(session.user.id, code);

    // Add user to the default RippleMap group
    const link = await db.arcGISAccountLink.findFirst({
      where: { userId: session.user.id, isPrimary: true },
    });

    if (link && process.env.ARCGIS_GROUP_ID) {
      await addUserToGroup(process.env.ARCGIS_GROUP_ID, link.username);
    }

    // Advance onboarding state
    await db.onboardingState.update({
      where: { userId: session.user.id },
      data: {
        currentStep: 2,
        completedSteps: { push: "arcgis_link" },
      },
    });

    return NextResponse.redirect(new URL("/onboarding/group-join", req.url));
  } catch (err) {
    console.error("ArcGIS OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/onboarding/arcgis-connect?error=token_exchange", req.url)
    );
  }
}
