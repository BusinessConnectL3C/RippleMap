import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const patchSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

async function requireManager() {
  const session = await auth();
  const su = session?.user as unknown as { orgId?: string; role?: string; id?: string } | undefined;
  if (!session?.user?.id || !su?.orgId) return null;
  if (su.role !== "OWNER" && su.role !== "ADMIN") return null;
  return { userId: session.user.id, orgId: su.orgId, role: su.role as "OWNER" | "ADMIN" };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const { role } = parsed.data;

  if (id === manager.userId) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.orgId !== manager.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const touchesOwner = target.role === "OWNER" || role === "OWNER";
  if (touchesOwner && manager.role !== "OWNER") {
    return NextResponse.json({ error: "Only an owner can change owner roles" }, { status: 403 });
  }

  if (target.role === "OWNER" && role !== "OWNER") {
    const ownerCount = await db.user.count({ where: { orgId: manager.orgId, role: "OWNER" } });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "An organization must have at least one owner" }, { status: 409 });
    }
  }

  await db.user.update({ where: { id }, data: { role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === manager.userId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.orgId !== manager.orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (target.role === "OWNER" && manager.role !== "OWNER") {
    return NextResponse.json({ error: "Only an owner can remove an owner" }, { status: 403 });
  }

  if (target.role === "OWNER") {
    const ownerCount = await db.user.count({ where: { orgId: manager.orgId, role: "OWNER" } });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "An organization must have at least one owner" }, { status: 409 });
    }
  }

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
