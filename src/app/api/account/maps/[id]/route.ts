import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getViewer, GrantError, setMapVisibility } from "@/lib/felt/access";

const patchSchema = z.object({ visibility: z.enum(["RESTRICTED", "ALL_MEMBERS"]) });

/** Org OWNER/ADMIN: set who in the org can see a map (all members, or only granted members). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id } = await params;
  try {
    await setMapVisibility(viewer, id, parsed.data.visibility);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GrantError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
