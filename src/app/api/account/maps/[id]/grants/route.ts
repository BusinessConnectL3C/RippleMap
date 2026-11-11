import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getViewer, grantMapAccess, GrantError, revokeMapAccess } from "@/lib/felt/access";

const grantSchema = z.object({ userId: z.string().min(1), canExport: z.boolean().default(false) });
const revokeSchema = z.object({ userId: z.string().min(1) });

async function handle(req: NextRequest, params: Promise<{ id: string }>, method: "PUT" | "DELETE") {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { id } = await params;
  try {
    if (method === "PUT") {
      const parsed = grantSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      await grantMapAccess(viewer, id, parsed.data.userId, parsed.data.canExport);
    } else {
      const parsed = revokeSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      await revokeMapAccess(viewer, id, parsed.data.userId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GrantError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

/** Org OWNER/ADMIN: give a member view (and optionally export) access to a restricted map. */
export function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, params, "PUT");
}

/** Org OWNER/ADMIN: remove a member's access. Already-open embeds can last up to 12 h. */
export function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, params, "DELETE");
}
