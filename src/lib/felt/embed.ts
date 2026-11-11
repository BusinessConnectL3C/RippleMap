import "server-only";
import { feltFetch } from "./client";
import type { FeltEmbedToken } from "./types";

/**
 * Mint a Felt embed token so a portal user can view one private map.
 *
 * ONLY call this after canViewMap() (src/lib/felt/access.ts) has passed for
 * this user and map — the token grants view access to that map to whoever
 * holds it for 12 hours and cannot be revoked individually.
 *
 * Felt requires the viewer's email (`user_email`) to attribute map views; it
 * is sent to Felt with every mint (PII — see docs/felt-integration-plan.md §10).
 */
export function mintEmbedToken(feltMapId: string, viewerEmail: string): Promise<FeltEmbedToken> {
  return feltFetch<FeltEmbedToken>(`/maps/${encodeURIComponent(feltMapId)}/embed_token`, {
    method: "POST",
    query: { user_email: viewerEmail },
  });
}
