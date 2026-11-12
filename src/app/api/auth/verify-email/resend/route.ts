import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resendWaitSeconds, sendVerificationLink } from "@/lib/verification";

/** Send a fresh verification link to the signed-in user (at most once a minute). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true });

  const wait = await resendWaitSeconds(user.id);
  if (wait > 0) {
    return NextResponse.json({ error: `Please wait ${wait} seconds before sending another email.` }, { status: 429 });
  }

  const sent = await sendVerificationLink(user, req.nextUrl.origin);
  if (!sent) return NextResponse.json({ error: "We couldn't send the email. Please try again shortly." }, { status: 502 });
  return NextResponse.json({ sent: true });
}
