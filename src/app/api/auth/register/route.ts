import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { provisionOrg } from "@/lib/provisioning";
import { isEmailVerificationEnabled, sendVerificationLink } from "@/lib/verification";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  orgName: z.string().min(2),
  orgType: z.enum(["NONPROFIT", "CORPORATE"]).default("NONPROFIT"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, name, password, orgName, orgType } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const org = await db.organization.create({
    data: {
      name: orgName,
      type: orgType,
      onboardingState: {
        create: { currentStep: 0, completedSteps: [] },
      },
      users: {
        create: {
          email,
          name,
          hashedPassword,
          role: "OWNER",
        },
      },
    },
    include: { users: true },
  });

  const user = org.users[0];

  // Nothing outside RippleMap is created until the owner verifies their email
  // (src/lib/provisioning.ts runs from /api/auth/verify-email). Without email
  // sending configured, verification is skipped and the org is set up now.
  if (isEmailVerificationEnabled()) {
    await sendVerificationLink(user, req.nextUrl.origin);
  } else {
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    after(() => provisionOrg(org.id));
  }

  return NextResponse.json({ id: user.id }, { status: 201 });
}
