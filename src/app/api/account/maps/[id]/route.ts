import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { approvePublicMap, getViewer, GrantError, setMapVisibility } from "@/lib/felt/access";
import { FeltApiError } from "@/lib/felt/client";

const patchSchema = z.union([
  z.object({ visibility: z.enum(["RESTRICTED", "ALL_MEMBERS", "PUBLIC"]) }),
  // Keep a map that was made public in Felt, and clear its review flag.
  z.object({ approvePublic: z.literal(true) }),
]);

/** Org OWNER/ADMIN: set who in the org can see a map (all members, or only granted members). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const viewer = session?.user?.id ? await getViewer(session.user.id) : null;
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id } = await params;
  try {
    if ("visibility" in parsed.data) {
      await setMapVisibility(viewer, id, parsed.data.visibility);
    } else {
      await approvePublicMap(viewer, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GrantError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof FeltApiError) {
      return NextResponse.json({ error: "Felt didn't accept the change. Please try again." }, { status: 502 });
    }
    throw err;
  }
}
