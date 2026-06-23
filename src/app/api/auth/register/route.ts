import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createClientGroup } from "@/lib/arcgis/groups";

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

  try {
    const groupId = await createClientGroup(orgName);
    await db.organization.update({ where: { id: org.id }, data: { arcgisGroupId: groupId } });
  } catch (err) {
    console.error(`Failed to create ArcGIS group for org ${org.id}:`, err);
  }

  return NextResponse.json({ id: user.id }, { status: 201 });
}
