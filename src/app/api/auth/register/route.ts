import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  orgName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, name, password, orgName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      email,
      name,
      hashedPassword,
      orgName,
      onboardingState: {
        create: { currentStep: 0, completedSteps: [] },
      },
    },
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
