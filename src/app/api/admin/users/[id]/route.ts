import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

async function requireBCStaff() {
  const session = await auth();
  const su = session?.user as unknown as { role?: string } | undefined;
  if (!session?.user?.id || su?.role !== "BC_STAFF") return false;
  return true;
}

const patchSchema = z
  .object({
    role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
    // Field Editor bookkeeping. This records what BC staff set up in Felt by
    // hand (Felt has no members/seats API); it doesn't change anything in Felt.
    feltSeat: z.boolean().optional(),
    feltAccess: z.enum(["EDIT", "CONTRIBUTE"]).nullable().optional(),
    feltEmail: z.string().email().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireBCStaff()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { role, feltSeat, feltAccess, feltEmail } = parsed.data;
  const existing = await db.user.findUnique({ where: { id }, select: { feltSeat: true, role: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // BC_STAFF is granted and removed only with database access (scripts/
  // create-bc-staff.mjs), never from the admin UI: an accidental dropdown
  // change here would otherwise silently demote a system admin.
  if (role !== undefined && existing.role === "BC_STAFF") {
    return NextResponse.json({ error: "BC staff roles can't be changed here" }, { status: 409 });
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
      ...(feltSeat === false && { feltSeat: false, feltAccess: null, feltSeatSince: null }),
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

  const user = await db.user.findUnique({ where: { id }, select: { orgId: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
