import type { ArcGISItem } from "@/types/arcgis";
import { getBCAppToken } from "./auth";

const AGOL_BASE = "https://www.arcgis.com/sharing/rest";

/** Fetch a single item's details by ID. */
export async function getItem(itemId: string): Promise<ArcGISItem> {
  const token = await getBCAppToken();
  const res = await fetch(
    `${AGOL_BASE}/content/items/${itemId}?f=json&token=${token}`
  );
  if (!res.ok) throw new Error(`Failed to fetch item ${itemId}: ${res.statusText}`);
  return res.json();
}

/** Get the thumbnail URL for an ArcGIS item. */
export function getThumbnailUrl(item: ArcGISItem): string | null {
  if (!item.thumbnail) return null;
  return `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/${item.thumbnail}`;
}
