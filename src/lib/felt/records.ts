import "server-only";
import type { MapUpload } from "@prisma/client";
import { db } from "@/lib/db";
import { putFile, SYSTEM_BUCKET } from "@/lib/aws/s3";
import { feltFetch } from "./client";
import type { Viewer } from "./access";
import { readZipEntry } from "./zip";
import {
  authorize,
  extensionOf,
  fail,
  getReplaceableOrigin,
  requestLayerRefresh,
  safeFileName,
  SOURCE_ARM_MS,
  UPLOAD_PREFIX,
  UploadError,
  type FeltLayerStatus,
} from "./uploads";

/**
 * Add records (points) to a layer by hand.
 *
 * Felt's API can't add a single feature to a layer. It can only re-import a
 * layer from the address it was first imported from. So for layers created by
 * a portal file upload (which import from a permanent RippleMap address), we:
 *   1. export the layer's current data from Felt (so edits made on the map
 *      are kept),
 *   2. add the new records,
 *   3. point the layer's source address at the result and ask Felt to refresh.
 *
 * Only point layers from CSV or GeoJSON uploads are supported: those formats
 * can be written back faithfully.
 */

export const APPENDABLE_EXTENSIONS = ["csv", "geojson", "json"] as const;
/** Exports bigger than this aren't edited in a serverless function: use Replace data instead. */
const MAX_EXPORT_BYTES = 25 * 1024 * 1024;
const MAX_RECORDS_PER_SAVE = 50;
const MAX_SAVES_PER_HOUR = 60;
const EXPORT_TIMEOUT_MS = 35_000;

const LAT_COLUMN = /^(lat|latitude|y|point_y)$/i;
const LON_COLUMN = /^(lon|lng|long|longitude|x|point_x)$/i;

export type FieldType = "INTEGER" | "REAL" | "TEXT" | "BOOLEAN" | "DATE" | "DATETIME";

export interface RecordField {
  name: string;
  type: FieldType;
}

export interface AppendableLayer {
  uploadId: string;
  layerName: string;
  fileExt: string;
  /** Columns to fill in. Coordinate columns are left out: they come from the location. */
  fields: RecordField[];
}

export interface NewRecord {
  latitude: number;
  longitude: number;
  values: Record<string, string | boolean | null>;
}

function toFieldType(type: string | undefined): FieldType | null {
  switch (type) {
    case "INTEGER":
    case "REAL":
    case "BOOLEAN":
    case "DATE":
    case "DATETIME":
    case "TEXT":
      return type;
    case "GEOMETRY":
      return null;
    default:
      return "TEXT";
  }
}

function getLayer(feltMapId: string, feltLayerId: string) {
  return feltFetch<FeltLayerStatus>(`/maps/${encodeURIComponent(feltMapId)}/layers/${encodeURIComponent(feltLayerId)}`);
}

/** Point layers on this map, from portal CSV/GeoJSON uploads, that records can be added to. */
export async function listAppendableLayers(viewer: Viewer, feltMapId: string): Promise<AppendableLayer[]> {
  const map = await authorize(viewer, feltMapId);
  const origins = await db.mapUpload.findMany({
    where: {
      mapId: map.id,
      mode: "NEW",
      status: "COMPLETED",
      kind: "FILE",
      feltLayerId: { not: null },
      sourceToken: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const results = await Promise.all(
    origins.map(async (o): Promise<AppendableLayer | null> => {
      const ext = extensionOf(o.fileName ?? "");
      if (!(APPENDABLE_EXTENSIONS as readonly string[]).includes(ext)) return null;
      try {
        const layer = await getLayer(feltMapId, o.feltLayerId!);
        if (layer.geometry_type && layer.geometry_type !== "Point") return null;
        const fields = (layer.attributes ?? [])
          .map((a) => ({ name: a.name, type: toFieldType(a.type) }))
          .filter((f): f is RecordField => f.type !== null && !LAT_COLUMN.test(f.name) && !LON_COLUMN.test(f.name));
        return { uploadId: o.id, layerName: o.layerName, fileExt: ext, fields };
      } catch {
        return null; // deleted in Felt, or unreachable
      }
    })
  );
  return results.filter((r): r is AppendableLayer => r !== null);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GeoJsonFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown> | null;
}

/** Export the layer's current data from Felt as GeoJSON features. */
async function exportLayer(feltMapId: string, feltLayerId: string): Promise<GeoJsonFeature[]> {
  const base = `/maps/${encodeURIComponent(feltMapId)}/layers/${encodeURIComponent(feltLayerId)}`;
  const started = await feltFetch<{ export_request_id: string }>(`${base}/custom_export`, {
    method: "POST",
    body: { output_format: "geojson", email_on_completion: false },
  });

  const deadline = Date.now() + EXPORT_TIMEOUT_MS;
  let downloadUrl: string | null = null;
  while (Date.now() < deadline) {
    await sleep(1500);
    const status = await feltFetch<{ status: string; download_url: string | null }>(
      `${base}/custom_exports/${encodeURIComponent(started.export_request_id)}`
    );
    if (status.status === "failed") throw new UploadError("Felt couldn't export the layer's current data.", 502);
    if (status.status === "completed" && status.download_url) {
      downloadUrl = status.download_url;
      break;
    }
  }
  if (!downloadUrl) throw new UploadError("Felt took too long to export the layer. Please try again.", 504);

  const res = await fetch(downloadUrl, { cache: "no-store" });
  if (!res.ok) throw new UploadError("Couldn't download the layer's current data from Felt.", 502);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_EXPORT_BYTES) {
    throw new UploadError("This layer is too large to add records here. Use Replace a layer's data instead.", 413);
  }
  let body: Buffer = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_EXPORT_BYTES) {
    throw new UploadError("This layer is too large to add records here. Use Replace a layer's data instead.", 413);
  }
  // Zip archive ("PK\x03\x04"): take the GeoJSON file inside.
  if (body.length > 4 && body.readUInt32LE(0) === 0x04034b50) {
    const entry = readZipEntry(body, (name) => /\.(geo)?json$/i.test(name));
    if (!entry) throw new UploadError("Felt's export didn't contain GeoJSON data.", 502);
    body = entry;
  }

  let parsed: { type?: string; features?: GeoJsonFeature[] };
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw new UploadError("Couldn't read the layer's current data from Felt.", 502);
  }
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new UploadError("Couldn't read the layer's current data from Felt.", 502);
  }
  return parsed.features;
}

function typedValue(value: string | boolean | null | undefined, type: FieldType): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (type === "BOOLEAN") return value === true || value === "true";
  const text = String(value).trim();
  if (type === "INTEGER") {
    const n = Number.parseInt(text, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "REAL") {
    const n = Number.parseFloat(text);
    return Number.isFinite(n) ? n : null;
  }
  return text;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Point features → CSV, with coordinates in the layer's own lat/lon columns (or new ones). */
export function toCsv(features: GeoJsonFeature[], fieldOrder: string[]): string {
  const columns: string[] = [];
  const seen = new Set<string>();
  const add = (c: string) => {
    if (!seen.has(c)) {
      seen.add(c);
      columns.push(c);
    }
  };
  fieldOrder.forEach(add);
  for (const f of features) Object.keys(f.properties ?? {}).forEach(add);

  const latColumn = columns.find((c) => LAT_COLUMN.test(c)) ?? "latitude";
  const lonColumn = columns.find((c) => LON_COLUMN.test(c)) ?? "longitude";
  add(latColumn);
  add(lonColumn);

  const lines = [columns.map(csvCell).join(",")];
  for (const f of features) {
    const coords = f.geometry?.type === "Point" ? (f.geometry.coordinates as [number, number]) : null;
    const row = { ...(f.properties ?? {}) } as Record<string, unknown>;
    if (coords) {
      row[lonColumn] = coords[0];
      row[latColumn] = coords[1];
    }
    lines.push(columns.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * Add records to a layer. Returns the APPEND upload, IMPORTING while Felt
 * refreshes; poll it like any other upload.
 */
export async function appendRecords(
  viewer: Viewer,
  feltMapId: string,
  input: { originUploadId: string; records: NewRecord[]; confirmed: boolean }
): Promise<MapUpload> {
  const map = await authorize(viewer, feltMapId);
  if (!input.confirmed) throw new UploadError("Please confirm the records don't contain personal or sensitive data", 400);
  if (input.records.length === 0) throw new UploadError("Add at least one record", 400);
  if (input.records.length > MAX_RECORDS_PER_SAVE) {
    throw new UploadError(`Save at most ${MAX_RECORDS_PER_SAVE} records at a time`, 400);
  }
  for (const r of input.records) {
    if (!(Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180)) {
      throw new UploadError("Every record needs a valid location", 400);
    }
  }

  const origin = await getReplaceableOrigin(map.id, input.originUploadId);
  const ext = extensionOf(origin.fileName ?? "");
  if (origin.kind !== "FILE" || !origin.sourceToken || !(APPENDABLE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UploadError("Records can only be added to layers created from a CSV or GeoJSON upload here.", 400);
  }

  const recent = await db.mapUpload.count({
    where: { mapId: map.id, mode: "APPEND", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_SAVES_PER_HOUR) {
    throw new UploadError("Too many saves on this map in the last hour. Please try again later.", 429);
  }

  const layer = await getLayer(feltMapId, origin.feltLayerId!);
  if (layer.geometry_type && layer.geometry_type !== "Point") {
    throw new UploadError("Records can only be added to point layers.", 400);
  }
  const fields = (layer.attributes ?? [])
    .map((a) => ({ name: a.name, type: toFieldType(a.type) }))
    .filter((f): f is RecordField => f.type !== null);
  const fillable = fields.filter((f) => !LAT_COLUMN.test(f.name) && !LON_COLUMN.test(f.name));

  const upload = await db.mapUpload.create({
    data: {
      orgId: map.orgId,
      mapId: map.id,
      userId: viewer.id,
      kind: "FILE",
      mode: "APPEND",
      replacesUploadId: origin.id,
      layerName: origin.layerName,
      fileName: origin.fileName,
      confirmedNoSensitiveData: true,
    },
  });

  try {
    const features = await exportLayer(feltMapId, origin.feltLayerId!);
    for (const record of input.records) {
      const properties: Record<string, unknown> = {};
      for (const f of fillable) properties[f.name] = typedValue(record.values[f.name], f.type);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [record.longitude, record.latitude] },
        properties,
      });
    }

    const body =
      ext === "csv"
        ? toCsv(features, fields.map((f) => f.name))
        : JSON.stringify({ type: "FeatureCollection", features });
    const bytes = new TextEncoder().encode(body);
    const s3Key = `${UPLOAD_PREFIX}/${map.orgId}/${upload.id}/${safeFileName(origin.fileName ?? `data.${ext}`)}`;
    await putFile(s3Key, bytes, ext === "csv" ? "text/csv" : "application/geo+json", SYSTEM_BUCKET);
    await db.mapUpload.update({ where: { id: upload.id }, data: { s3Key, sizeBytes: BigInt(bytes.length) } });

    // Point the layer's permanent source at the new file and ask Felt to re-fetch it.
    await db.mapUpload.update({
      where: { id: origin.id },
      data: { sourceKey: s3Key, sourceArmedUntil: new Date(Date.now() + SOURCE_ARM_MS) },
    });
    const requestedAt = new Date();
    await requestLayerRefresh(feltMapId, origin.feltLayerId!);
    return db.mapUpload.update({
      where: { id: upload.id },
      data: { status: "IMPORTING", feltLayerId: origin.feltLayerId, refreshRequestedAt: requestedAt },
    });
  } catch (err) {
    console.error(`Adding records failed for upload ${upload.id}:`, err);
    const fresh = await db.mapUpload.findUniqueOrThrow({ where: { id: upload.id } });
    return fail(fresh, err instanceof UploadError ? err.message : "Felt couldn't add the records. Please try again.");
  }
}
