import "server-only";
import { createHmac } from "node:crypto";
import { feltFetch } from "./client";
import type { FeltEmbedToken } from "./types";

/**
 * Domain for pseudonymous viewer addresses. Felt confirmed (support email,
 * Nov 2026) that `user_email` may be a stable pseudonym on a real domain:
 * Felt creates no account for it, sends it no mail, and portal viewers don't
 * count toward seats. Felt keeps the value in its logs and product analytics,
 * so a pseudonym keeps viewers' real emails out of them.
 */
const VIEWER_DOMAIN = process.env.FELT_VIEWER_EMAIL_DOMAIN?.trim() || "viewers.ripplemap.app";

/**
 * Stable, non-reversible pseudonym for a portal user, e.g.
 * `u_3f9a1c0d8e7b6a5f4e3d@viewers.ripplemap.app`. Same user → same address,
 * so Felt's view attribution still counts people, not loads. Derived with
 * HMAC-SHA256 keyed by AUTH_SECRET: it can be recomputed from a user id (for
 * support with Felt), but not reversed to an email or id without the secret.
 */
export function viewerPseudonym(userId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const digest = createHmac("sha256", secret).update(`felt-viewer:${userId}`).digest("hex").slice(0, 20);
  return `u_${digest}@${VIEWER_DOMAIN}`;
}

/**
 * Mint a Felt embed token so a portal user can view one private map.
 *
 * ONLY call this after canViewMap() (src/lib/felt/access.ts) has passed for
 * this user and map — the token grants view access to that map to whoever
 * holds it for 12 hours and cannot be revoked individually.
 *
 * Felt gets the viewer's pseudonym (viewerPseudonym), never their email.
 */
export function mintEmbedToken(feltMapId: string, viewerUserId: string): Promise<FeltEmbedToken> {
  return feltFetch<FeltEmbedToken>(`/maps/${encodeURIComponent(feltMapId)}/embed_token`, {
    method: "POST",
    query: { user_email: viewerPseudonym(viewerUserId) },
  });
}
