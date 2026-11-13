import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffViewer } from "@/lib/staff";
import { getOrCreateOrgList } from "@/lib/clickup/lists";
import { isFeltConfigured } from "@/lib/felt/client";
import { getOrCreateOrgProject, ProjectLinkError, validateExistingProject } from "@/lib/felt/projects";
import { generateInviteToken, inviteExpiryDate } from "@/lib/invites";
import { sendInviteEmail } from "@/lib/email/resend";

const schema = z.object({
  name: z.string().trim().min(2, "Give the organization a name").max(200),
  type: z.enum(["NONPROFIT", "CORPORATE"]).default("NONPROFIT"),
  /** Invited as the org's Owner; they set their own name and password. */
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  /** NEW: create a private Felt project (default). EXISTING: connect one already made. NONE: later. */
  felt: z.enum(["NEW", "EXISTING", "NONE"]).default("NEW"),
  existingFeltProject: z.string().trim().max(500).optional(),
  createClickUpList: z.boolean().default(true),
});

/**
 * RM Staff: create an organization by hand (instead of self-registration).
 * Resources are set up straight away: there's no email verification to wait
 * for, since staff are creating it.
 */
export async function POST(req: NextRequest) {
  const staff = await requireStaffViewer();
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input", field: issue?.path[0] }, { status: 400 });
  }
  const input = parsed.data;
  const ownerEmail = input.ownerEmail || null;

  if (ownerEmail && (await db.user.findUnique({ where: { email: ownerEmail }, select: { id: true } }))) {
    return NextResponse.json(
      { error: "That email already has a RippleMap account (one organization per account).", field: "ownerEmail" },
      { status: 409 }
    );
  }
  if (input.felt !== "NONE" && !isFeltConfigured()) {
    return NextResponse.json({ error: "Felt isn't configured (FELT_API_TOKEN)", field: "felt" }, { status: 503 });
  }

  // Check an existing project before creating anything, so a typo doesn't leave a half-made org.
  let existingProjectId: string | null = null;
  if (input.felt === "EXISTING") {
    try {
      existingProjectId = await validateExistingProject(input.existingFeltProject ?? "");
    } catch (err) {
      if (err instanceof ProjectLinkError) {
        return NextResponse.json({ error: err.message, field: "existingFeltProject" }, { status: 400 });
      }
      console.error("Felt project check failed:", err);
      return NextResponse.json({ error: "Couldn't reach Felt to check that project." }, { status: 502 });
    }
  }

  const org = await db.organization.create({
    data: {
      name: input.name,
      type: input.type,
      feltProjectId: existingProjectId,
      onboardingState: { create: { currentStep: 0, completedSteps: [] } },
    },
  });
  console.info(JSON.stringify({ event: "org_created_by_staff", by: staff.id, orgId: org.id, felt: input.felt }));

  const warnings: string[] = [];

  if (input.felt === "NEW") {
    try {
      const feltProjectId = await getOrCreateOrgProject(org.name, org.id);
      await db.organization.update({ where: { id: org.id }, data: { feltProjectId } });
    } catch (err) {
      console.error(`Failed to create Felt project for org ${org.id}:`, err);
      warnings.push("The Felt project couldn't be created. Retry from the org's Felt Maps card.");
    }
  }

  if (input.createClickUpList) {
    try {
      const listId = await getOrCreateOrgList(org.name, org.id);
      await db.organization.update({ where: { id: org.id }, data: { clickupListId: listId } });
    } catch (err) {
      console.error(`Failed to create ClickUp list for org ${org.id}:`, err);
      warnings.push("The ClickUp support list couldn't be created. Set it on the org page.");
    }
  }

  let inviteUrl: string | null = null;
  let emailSent = false;
  if (ownerEmail) {
    const invite = await db.orgInvite.create({
      data: {
        orgId: org.id,
        email: ownerEmail,
        role: "OWNER",
        token: generateInviteToken(),
        expiresAt: inviteExpiryDate(),
        invitedById: staff.id,
      },
    });
    inviteUrl = new URL(`/invite/${invite.token}`, req.nextUrl.origin).toString();
    const sent = await sendInviteEmail({
      to: ownerEmail,
      orgName: org.name,
      role: "OWNER",
      inviteUrl,
      expiresAt: invite.expiresAt,
    });
    emailSent = sent.sent;
    if (!sent.sent) warnings.push("The invite email wasn't sent. Copy the invite link and send it yourself.");
  }

  return NextResponse.json({ id: org.id, inviteUrl, emailSent, warnings }, { status: 201 });
}
