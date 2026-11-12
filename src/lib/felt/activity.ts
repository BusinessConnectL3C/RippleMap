import "server-only";
import { db } from "@/lib/db";

export interface MapActivity {
  at: Date;
  /** "data": a file or link was added, replaced or refreshed through the portal. "added": when the map joined RippleMap. */
  kind: "data" | "added";
}

/**
 * Best available "last updated" time for each map. Felt's API has no
 * last-edited time for maps, so this is the latest portal data change
 * (upload, replace, refresh) or, failing that, when the map was added to
 * RippleMap. Edits made directly in Felt aren't reflected.
 */
export async function getMapActivity(maps: { id: string; createdAt: Date }[]): Promise<Map<string, MapActivity>> {
  const result = new Map<string, MapActivity>(maps.map((m) => [m.id, { at: m.createdAt, kind: "added" }]));
  if (maps.length === 0) return result;

  const uploads = await db.mapUpload.groupBy({
    by: ["mapId"],
    where: { mapId: { in: maps.map((m) => m.id) }, status: "COMPLETED" },
    _max: { updatedAt: true },
  });
  for (const u of uploads) {
    const at = u._max.updatedAt;
    const current = result.get(u.mapId);
    if (at && current && at > current.at) result.set(u.mapId, { at, kind: "data" });
  }
  return result;
}
