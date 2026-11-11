import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createClientGroup } from "@/lib/arcgis/groups";
import { getOrCreateOrgList } from "@/lib/clickup/lists";
import { isFeltConfigured } from "@/lib/felt/client";
import { getOrCreateOrgProject } from "@/lib/felt/projects";

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

  try {
    const listId = await getOrCreateOrgList(orgName, org.id);
    await db.organization.update({ where: { id: org.id }, data: { clickupListId: listId } });
  } catch (err) {
    console.error(`Failed to create ClickUp list for org ${org.id}:`, err);
  }

  // Private Felt project for this org's maps. Best-effort like the ArcGIS
  // group and ClickUp list: BC staff can create or set it later from the
  // admin org page if this fails.
  if (isFeltConfigured()) {
    try {
      const projectId = await getOrCreateOrgProject(orgName, org.id);
      await db.organization.update({ where: { id: org.id }, data: { feltProjectId: projectId } });
    } catch (err) {
      console.error(`Failed to create Felt project for org ${org.id}:`, err);
    }
  }

  return NextResponse.json({ id: user.id }, { status: 201 });
}
