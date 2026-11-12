import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { provisionOrg } from "@/lib/provisioning";
import { consumeVerificationToken } from "@/lib/verification";

/**
 * The link in the verification email. Marks the email verified, then sets up
 * the org's Felt project and ClickUp list if this user is its owner. Works
 * whether or not the person is signed in on this browser.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = token ? await consumeVerificationToken(token) : null;
  if (!userId) {
    return NextResponse.redirect(new URL("/verify-email?invalid=1", req.nextUrl.origin));
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { orgId: true, role: true } });
  if (user?.role === "OWNER") after(() => provisionOrg(user.orgId));

  return NextResponse.redirect(new URL("/verify-email?verified=1", req.nextUrl.origin));
}
