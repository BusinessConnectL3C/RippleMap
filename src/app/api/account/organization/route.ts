import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().min(2),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const su = session?.user as unknown as { orgId?: string; role?: string } | undefined;
  if (!session?.user?.id || !su?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (su.role !== "OWNER") {
    return NextResponse.json({ error: "Only organization owners can edit organization info" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await db.organization.update({
    where: { id: su.orgId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true });
}
