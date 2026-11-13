import "server-only";
import { feltFetch } from "./client";
import type { FeltMap } from "./types";

/**
 * Settings every RippleMap-managed map must have.
 *
 * Felt's API defaults `public_access` to "view_only" — i.e. anyone with the
 * link can view — so it is set explicitly on every map we create, duplicate,
 * or register. Portal users never need link access: they view through
 * per-map embed tokens. Viewer export/duplication are off so data only leaves
 * through the portal's own permission-checked export routes.
 */
const LOCKED_DOWN = {
  public_access: "private",
  viewer_permissions: {
    can_export_data: false,
    can_duplicate_map: false,
    can_see_map_presence: false,
  },
} as const;

/** Felt ids are alphanumeric (e.g. "CjU1CMJPTAGofjOK3ICf1D") — no hyphens, which is what lets parseFeltMapId split a URL slug on them. */
const FELT_ID_RE = /^[A-Za-z0-9]{10,40}$/;

export function isValidFeltId(id: string): boolean {
  return FELT_ID_RE.test(id);
}

/**
 * Pull a map id out of a pasted Felt map URL (e.g.
 * https://felt.com/map/Service-Area-CjU1CMJPTAGofjOK3ICf1D?loc=...) or accept
 * a bare id. The id is the last hyphen-separated segment of the path slug.
 */
export function parseFeltMapId(input: string): string | null {
  const trimmed = input.trim();
  if (isValidFeltId(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname !== "felt.com" && !url.hostname.endsWith(".felt.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const mapIdx = parts.findIndex((p) => p === "map");
    const slug = mapIdx >= 0 ? parts[mapIdx + 1] : undefined;
    if (!slug) return null;
    const id = slug.split("-").pop() ?? "";
    return isValidFeltId(id) ? id : null;
  } catch {
    return null;
  }
}

export function getMap(mapId: string): Promise<FeltMap> {
  return feltFetch<FeltMap>(`/maps/${encodeURIComponent(mapId)}`);
}

/** Force a map back to private with viewer export/duplication off. */
export function lockDownMap(mapId: string): Promise<FeltMap> {
  return feltFetch<FeltMap>(`/maps/${encodeURIComponent(mapId)}/update`, {
    method: "POST",
    body: LOCKED_DOWN,
  });
}

/**
 * Make a map viewable by anyone with its link (no sign-in). Used only when an
 * org owner/admin or BC staff choose Public in the portal. Viewer export and
 * duplication stay off: public means "can look", not "can take the data".
 */
export function makeMapPublic(mapId: string): Promise<FeltMap> {
  return feltFetch<FeltMap>(`/maps/${encodeURIComponent(mapId)}/update`, {
    method: "POST",
    body: { ...LOCKED_DOWN, public_access: "view_only" },
  });
}

/** True if Felt's link sharing lets people outside Felt view the map. */
export function isPublicInFelt(map: Pick<FeltMap, "public_access">): boolean {
  return map.public_access !== "private";
}

export function publicMapUrl(feltMapId: string): string {
  return `https://felt.com/map/${feltMapId}`;
}

export function publicEmbedUrl(feltMapId: string): string {
  return `https://felt.com/embed/map/${feltMapId}`;
}

/**
 * Duplicate a template map straight into an org's project, then lock it down.
 * The duplicate's sharing settings aren't documented to reset, so they're
 * always forced private afterwards.
 */
export async function duplicateMapIntoProject(
  templateMapId: string,
  projectId: string,
  title: string
): Promise<FeltMap> {
  const copy = await feltFetch<FeltMap>(`/maps/${encodeURIComponent(templateMapId)}/duplicate`, {
    method: "POST",
    body: { title, destination: { project_id: projectId } },
  });
  return lockDownMap(copy.id);
}

/**
 * Title of the short-lived map copies made to print a viewer's filters
 * (src/lib/felt/print.ts). Sync never registers them and deletes leftovers.
 */
export const TEMP_PRINT_MAP_TITLE = "RippleMap portal print (temporary)";

export async function deleteMap(mapId: string): Promise<void> {
  await feltFetch(`/maps/${encodeURIComponent(mapId)}`, { method: "DELETE" });
}
