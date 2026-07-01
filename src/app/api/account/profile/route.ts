import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z
  .object({
    name: z.string().min(2).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((d) => !d.newPassword || !!d.currentPassword, {
    message: "Current password is required to set a new password",
    path: ["currentPassword"],
  });

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let hashedPassword: string | undefined;
  if (newPassword) {
    const valid = await bcrypt.compare(currentPassword!, user.hashedPassword);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    hashedPassword = await bcrypt.hash(newPassword, 12);
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(hashedPassword && { hashedPassword }),
    },
  });

  return NextResponse.json({ ok: true });
}
