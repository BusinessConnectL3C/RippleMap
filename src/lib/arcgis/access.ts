import type { ArcGISItem, ArcGISSearchResponse } from "@/types/arcgis";
import { db } from "@/lib/db";
import { getAdminToken } from "./auth";
import { getItem } from "./items";

const AGOL_BASE = "https://www.arcgis.com/sharing/rest";

/** ArcGIS Online item IDs are 32 hex characters. */
const ITEM_ID_RE = /^[a-f0-9]{32}$/i;

export function isValidItemId(itemId: string): boolean {
  return ITEM_ID_RE.test(itemId);
}

/**
 * Whether an item is shared to the given group. Uses an `id:` search scoped to
 * the group rather than listing the group, so it isn't capped by a page size.
 * The item ID is format-checked first, since it's interpolated into the query.
 */
export async function isItemInGroup(groupId: string, itemId: string): Promise<boolean> {
  if (!isValidItemId(itemId)) return false;

  const token = await getAdminToken();
  const params = new URLSearchParams({
    f: "json",
    token,
    num: "1",
    q: `id:${itemId} AND group:${groupId}`,
  });

  const res = await fetch(`${AGOL_BASE}/search?${params}`);
  if (!res.ok) throw new Error(`Failed to check group membership: ${res.statusText}`);

  const data: ArcGISSearchResponse = await res.json();
  return (data.results ?? []).some((item) => item.id === itemId);
}

/**
 * Load an ArcGIS item only if it's shared to the org's ArcGIS group.
 * Returns null when the org has no group, the ID is malformed, or the item
 * belongs to someone else — callers should treat all of those as "not found"
 * so item existence in other orgs isn't disclosed.
 *
 * Every route that reads or writes an ArcGIS item with BC's tokens must go
 * through this (or getAuthorizedLayer): those tokens can see every client's
 * items, so the group check is the only tenant boundary.
 */
export async function getOrgItem(orgId: string, itemId: string): Promise<ArcGISItem | null> {
  if (!isValidItemId(itemId)) return null;

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { arcgisGroupId: true },
  });
  if (!org?.arcgisGroupId) return null;

  if (!(await isItemInGroup(org.arcgisGroupId, itemId))) return null;
  return getItem(itemId);
}
