import type { ArcGISItem } from "@/types/arcgis";
import { getBCAppToken } from "./auth";

const AGOL_BASE = "https://www.arcgis.com/sharing/rest";

/**
 * Fetch the most recent submissions from a FieldMaps Feature Layer.
 * Returns raw feature records ordered by EditDate descending.
 */
export async function getRecentSubmissions(
  serviceUrl: string,
  limit = 10
): Promise<Record<string, unknown>[]> {
  const token = await getBCAppToken();

  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    orderByFields: "EditDate DESC",
    resultRecordCount: String(limit),
    f: "json",
    token,
  });

  const res = await fetch(`${serviceUrl}/0/query?${params}`);
  if (!res.ok) throw new Error(`Failed to query feature layer: ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);

  return (data.features ?? []).map(
    (f: { attributes: Record<string, unknown> }) => f.attributes
  );
}

/**
 * Get FieldMaps-compatible Feature Layers from an ArcGIS Group.
 * Filters to Feature Service items that have editor tracking enabled.
 */
export async function getFieldMapsLayers(groupId: string): Promise<ArcGISItem[]> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    f: "json",
    token,
    num: "50",
    q: 'type:"Feature Service"',
  });

  const res = await fetch(`${AGOL_BASE}/content/groups/${groupId}/items?${params}`);
  if (!res.ok) throw new Error(`Failed to list group items: ${res.statusText}`);

  const data = await res.json();
  return data.items ?? [];
}
