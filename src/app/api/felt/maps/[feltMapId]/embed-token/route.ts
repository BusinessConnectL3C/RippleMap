import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getViewer, getViewableMap } from "@/lib/felt/access";
import { FeltApiError, isFeltConfigured } from "@/lib/felt/client";
import { mintEmbedToken } from "@/lib/felt/embed";
import { isValidFeltId } from "@/lib/felt/maps";

/**
 * Mint a Felt embed token for one map, for the signed-in user.
 *
 * This is the only place a Felt credential reaches the browser, so the order
 * matters: authenticate → re-read the user from the DB → check they may view
 * this specific map (src/lib/felt/access.ts) → mint. Unregistered maps and
 * maps the user can't see both return 404.
 *
 * POST (not GET) so the token is never cached or prefetched.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ feltMapId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { feltMapId } = await params;
  if (!isValidFeltId(feltMapId)) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  const viewer = await getViewer(session.user.id);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getViewableMap(viewer, feltMapId);
  if (!access) return NextResponse.json({ error: "Map not found" }, { status: 404 });

  if (!isFeltConfigured()) {
    return NextResponse.json({ error: "Maps are temporarily unavailable" }, { status: 503 });
  }

  try {
    const { token, expires_at } = await mintEmbedToken(feltMapId, viewer.email);
    // Usage signal: every embed load counts as a Felt map view against the
    // workspace's monthly allowance (Business: 100k). Structured so it can be
    // aggregated per org from Vercel logs.
    console.info(JSON.stringify({ event: "felt_embed_token", orgId: access.map.orgId, mapId: access.map.id }));
    return NextResponse.json(
      { token, expiresAt: expires_at },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(`Failed to mint Felt embed token for map ${access.map.id}:`, err);
    const status = err instanceof FeltApiError && err.status === 404 ? 404 : 502;
    return NextResponse.json({ error: "Could not load the map" }, { status });
  }
}
