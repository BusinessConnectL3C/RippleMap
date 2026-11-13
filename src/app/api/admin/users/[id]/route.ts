import { requireStaffViewer } from "@/lib/staff";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { isInternalOrg } from "@/lib/felt/templates";

/** DB-checked (not the JWT), so a demoted staff account loses access at once. */
async function requireBCStaff() {
  return requireStaffViewer();
}

const patchSchema = z
  .object({
    // BC_STAFF is shown as "RM Staff": RippleMap system admin across every org.
    role: z.enum(["OWNER", "ADMIN", "MEMBER", "BC_STAFF"]).optional(),
    // Field Editor bookkeeping. This records what BC staff set up in Felt by
    // hand (Felt has no members/seats API); it doesn't change anything in Felt.
    feltSeat: z.boolean().optional(),
    feltAccess: z.enum(["EDIT", "CONTRIBUTE"]).nullable().optional(),
    feltEmail: z.string().email().nullable().optional(),
    feltInviteAccepted: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireBCStaff();
  if (!staff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { role, feltSeat, feltAccess, feltEmail, feltInviteAccepted } = parsed.data;
  const existing = await db.user.findUnique({ where: { id }, select: { feltSeat: true, role: true, orgId: true, email: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RM Staff (BC_STAFF) can see and manage every org, so granting or removing
  // it is guarded: only for people in RippleMap's own org (an org that already
  // has an RM Staff account), never on yourself, and never the last one.
  if (role !== undefined && role !== existing.role && (role === "BC_STAFF" || existing.role === "BC_STAFF")) {
    if (id === staff.id) {
      return NextResponse.json({ error: "You can't change your own RM Staff role" }, { status: 409 });
    }
    if (role === "BC_STAFF" && !(await isInternalOrg(existing.orgId))) {
      return NextResponse.json(
        { error: "RM Staff can only be given to people in the RippleMap organization, not to client organizations" },
        { status: 409 }
      );
    }
    if (existing.role === "BC_STAFF" && (await db.user.count({ where: { role: "BC_STAFF" } })) <= 1) {
      return NextResponse.json({ error: "There must always be at least one RM Staff account" }, { status: 409 });
    }
    // Audit trail for privilege changes (Vercel logs).
    console.info(
      JSON.stringify({ event: "staff_role_change", by: staff.id, userId: id, from: existing.role, to: role })
    );
  }

  await db.user.update({
    where: { id },
    data: {
      ...(role !== undefined && { role }),
      ...(feltEmail !== undefined && { feltEmail }),
      ...(feltSeat === true && {
        feltSeat: true,
        feltAccess: feltAccess ?? "EDIT",
        ...(!existing.feltSeat && { feltSeatSince: new Date() }),
      }),
      ...(feltSeat === false && { feltSeat: false, feltAccess: null, feltSeatSince: null, feltInviteAcceptedAt: null }),
      ...(feltInviteAccepted !== undefined && { feltInviteAcceptedAt: feltInviteAccepted ? new Date() : null }),
      ...(feltSeat === undefined && feltAccess !== undefined && { feltAccess }),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await db.user.findUnique({ where: { id }, select: { orgId: true, role: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "BC_STAFF") {
    return NextResponse.json({ error: "Remove the RM Staff role first, then remove the person" }, { status: 409 });
  }

  // Prevent deleting the last user in an org
  const orgUserCount = await db.user.count({ where: { orgId: user.orgId } });
  if (orgUserCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last user in an organization" },
      { status: 409 }
    );
  }

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
