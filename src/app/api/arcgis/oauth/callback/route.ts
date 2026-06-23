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

  const su = session.user as unknown as { orgId: string };

  try {
    await exchangeCodeForTokens(session.user.id, code);

    const [link, org] = await Promise.all([
      db.arcGISAccountLink.findUnique({ where: { userId: session.user.id } }),
      db.organization.findUnique({ where: { id: su.orgId }, select: { arcgisGroupId: true } }),
    ]);

    if (link && org?.arcgisGroupId) {
      try {
        await addUserToGroup(org.arcgisGroupId, link.username);
      } catch (groupErr) {
        console.error("Failed to add user to ArcGIS group (non-fatal):", groupErr);
      }
    }

    await db.onboardingState.update({
      where: { orgId: su.orgId },
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
