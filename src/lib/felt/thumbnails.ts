import "server-only";
import { db } from "@/lib/db";
import { putFile } from "@/lib/aws/s3";
import { feltFetch } from "./client";

/**
 * Map thumbnails: Felt renders an image of the map's saved view
 * (POST /maps/{id}/image_exports), we copy it into BC's S3 bucket and record
 * the key on FeltMap.thumbnailKey. Clients never get a Felt URL — the portal
 * serves the image through a permission-checked route
 * (/api/felt/maps/[feltMapId]/thumbnail) that redirects to a short-lived S3
 * URL.
 *
 * Kept under a system prefix, separate from any org's media prefix.
 */
const THUMBNAIL_PREFIX = "ripplemap-system/felt-thumbnails";

interface MapImageExport {
  download_url: string;
  expires_at: string;
}

/** Output size of every thumbnail; the viewer scales its framing to this. */
export const THUMBNAIL_SIZE = { width: 800, height: 500 } as const;

export interface ThumbnailView {
  latitude: number;
  longitude: number;
  zoom: number;
}

function parseView(value: unknown): ThumbnailView | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const ok = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (!ok(v.latitude, -85.051129, 85.051129) || !ok(v.longitude, -180, 180) || !ok(v.zoom, 1, 23)) return null;
  return { latitude: v.latitude as number, longitude: v.longitude as number, zoom: v.zoom as number };
}

export function thumbnailKeyFor(orgId: string, feltMapId: string): string {
  return `${THUMBNAIL_PREFIX}/${orgId}/${feltMapId}.jpg`;
}

/**
 * Render and store a thumbnail for one registered map. Takes up to ~55 s
 * (Felt renders synchronously), so call it from after() or a route with a
 * long enough maxDuration. Returns the stored S3 key.
 *
 * Framing: a view chosen in the portal viewer ("Use this view as thumbnail")
 * is saved on the map and reused by every later refresh. Without one, Felt
 * renders the map's saved default view, which can be zoomed in on a single
 * point and show little but basemap.
 */
export async function refreshThumbnail(mapRowId: string, newView?: ThumbnailView): Promise<string> {
  const map = await db.feltMap.findUnique({
    where: { id: mapRowId },
    select: { orgId: true, feltMapId: true, thumbnailView: true },
  });
  if (!map) throw new Error(`FeltMap ${mapRowId} not found`);

  const view = newView ?? parseView(map.thumbnailView);

  const exportResult = await feltFetch<MapImageExport>(`/maps/${encodeURIComponent(map.feltMapId)}/image_exports`, {
    method: "POST",
    body: {
      // 16:10 card thumbnail. pixel_ratio 1 keeps the map's saved view framing
      // roughly as it looks on screen (higher ratios zoom in at a fixed size).
      output: {
        format: "jpg",
        width_px: THUMBNAIL_SIZE.width,
        height_px: THUMBNAIL_SIZE.height,
        pixel_ratio: 1,
        jpg_quality: 0.82,
      },
      legend: { visible: false },
      show_scale_bar: false,
      ...(view && { view: { viewport: view } }),
    },
  });

  // download_url redirects to the file; fetch follows redirects by default.
  const res = await fetch(exportResult.download_url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Felt image download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const key = thumbnailKeyFor(map.orgId, map.feltMapId);
  await putFile(key, bytes, "image/jpeg");
  await db.feltMap.update({
    where: { id: mapRowId },
    data: { thumbnailKey: key, ...(newView && { thumbnailView: { ...newView } }) },
  });
  return key;
}

/** Best-effort variant for background use: logs instead of throwing. */
export async function refreshThumbnailQuietly(mapRowId: string): Promise<void> {
  try {
    await refreshThumbnail(mapRowId);
  } catch (err) {
    console.error(`Failed to refresh thumbnail for FeltMap ${mapRowId}:`, err);
  }
}
