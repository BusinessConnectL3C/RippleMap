import { NextRequest, NextResponse } from "next/server";
import { resolveSource } from "@/lib/felt/uploads";

/**
 * Permanent source address for a layer uploaded from the portal. Felt
 * imports (and later refreshes) the layer from this URL, so it can't require
 * a RippleMap sign-in. It is protected instead by:
 *  - a 256-bit random token per layer, and
 *  - being "armed" only for 30 minutes after an import or replacement starts;
 *    the rest of the time it returns 404 and the file has been deleted.
 * It redirects to a short-lived signed S3 URL for the file being imported.
 * The trailing file name is only there so Felt can tell the format.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; filename: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return new NextResponse(null, { status: 404 });

  const url = await resolveSource(token);
  if (!url) return new NextResponse(null, { status: 404 });

  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
