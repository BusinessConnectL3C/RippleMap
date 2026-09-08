import type { FeatureServiceField } from "@/types/arcgis";
import { getBCAppToken } from "./auth";
import { listGroupItems } from "./groups";

const AGOL_BASE = "https://www.arcgis.com/sharing/rest";
const PAGE_SIZE = 200;
const MAX_EXPORT_RECORDS = 50_000;

export interface QueryableLayer {
  id: string;
  title: string;
  url: string;
}

interface WebMapOperationalLayer {
  title?: string;
  layerType?: string;
  url?: string;
  layers?: WebMapOperationalLayer[];
}

function isTrustedArcGISUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const orgHost = process.env.ARCGIS_ORG_URL
      ? new URL(process.env.ARCGIS_ORG_URL).hostname
      : null;
    return parsed.hostname.endsWith(".arcgis.com") || parsed.hostname === orgHost;
  } catch {
    return false;
  }
}

function flattenOperationalLayers(
  layers: WebMapOperationalLayer[] = []
): WebMapOperationalLayer[] {
  return layers.flatMap((layer) =>
    layer.layers ? flattenOperationalLayers(layer.layers) : [layer]
  );
}

/** Get the queryable Feature Layers referenced by a Web Map item's operational layers. */
export async function getWebMapLayers(itemId: string): Promise<QueryableLayer[]> {
  const token = await getBCAppToken();
  const res = await fetch(
    `${AGOL_BASE}/content/items/${itemId}/data?f=json&token=${token}`
  );
  if (!res.ok) throw new Error(`Failed to fetch web map data: ${res.statusText}`);

  const data = await res.json();
  const flat = flattenOperationalLayers(data.operationalLayers ?? []);

  return flat
    .filter(
      (layer): layer is WebMapOperationalLayer & { url: string } =>
        layer.layerType === "ArcGISFeatureLayer" &&
        typeof layer.url === "string" &&
        isTrustedArcGISUrl(layer.url)
    )
    .map((layer, index) => ({
      id: String(index),
      title: layer.title ?? `Layer ${index + 1}`,
      url: layer.url,
    }));
}

/** Get field definitions for a Feature Layer (used for table headers and export columns). */
export async function getFeatureLayerFields(
  layerUrl: string
): Promise<FeatureServiceField[]> {
  const token = await getBCAppToken();
  const res = await fetch(`${layerUrl}?f=json&token=${token}`);
  if (!res.ok) throw new Error(`Failed to fetch feature layer: ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);

  return data.fields ?? [];
}

interface QueryPageResult {
  features: Record<string, unknown>[];
  exceededTransferLimit: boolean;
}

/** Query one page of attribute records (no geometry) from a Feature Layer. */
export async function queryFeatureLayerPage(
  layerUrl: string,
  offset: number,
  limit = PAGE_SIZE
): Promise<QueryPageResult> {
  const token = await getBCAppToken();
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(limit),
    f: "json",
    token,
  });

  const res = await fetch(`${layerUrl}/query?${params}`);
  if (!res.ok) throw new Error(`Failed to query feature layer: ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);

  return {
    features: (data.features ?? []).map(
      (f: { attributes: Record<string, unknown> }) => f.attributes
    ),
    exceededTransferLimit: Boolean(data.exceededTransferLimit),
  };
}

/**
 * Query all records from a Feature Layer, paginating until exhausted.
 * Capped at MAX_EXPORT_RECORDS to bound memory use and response size for export.
 */
export async function queryAllFeatureLayerRecords(
  layerUrl: string
): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  let offset = 0;

  while (records.length < MAX_EXPORT_RECORDS) {
    const { features, exceededTransferLimit } = await queryFeatureLayerPage(
      layerUrl,
      offset,
      PAGE_SIZE
    );
    records.push(...features);
    offset += features.length;

    const hasMore = features.length > 0 && (exceededTransferLimit || features.length === PAGE_SIZE);
    if (!hasMore) break;
  }

  return records.slice(0, MAX_EXPORT_RECORDS);
}

export class LayerAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve a layer for an API request, verifying the underlying Web Map item
 * is shared to the requesting org's ArcGIS group before returning its URL.
 */
export async function getAuthorizedLayer(
  orgArcgisGroupId: string | null | undefined,
  itemId: string,
  layerId: string
): Promise<QueryableLayer> {
  if (!orgArcgisGroupId) throw new LayerAccessError("Group not configured", 500);

  const groupItems = await listGroupItems(orgArcgisGroupId, undefined, 100);
  if (!groupItems.some((item) => item.id === itemId)) {
    throw new LayerAccessError("Map not found", 404);
  }

  const layers = await getWebMapLayers(itemId);
  const layer = layers[Number(layerId)];
  if (!layer) throw new LayerAccessError("Layer not found", 404);

  return layer;
}
