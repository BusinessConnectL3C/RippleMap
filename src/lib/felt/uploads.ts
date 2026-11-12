import "server-only";
import type { MapUpload } from "@prisma/client";
import { db } from "@/lib/db";
import { deleteFile, getObjectSize, getSizedUploadUrl, getViewUrl, SYSTEM_BUCKET, SYSTEM_PREFIX } from "@/lib/aws/s3";
import { getOrgTier, UPLOAD_LIMITS, formatBytes, type PlanTier } from "@/lib/plans";
import { feltFetch } from "./client";
import { getViewableMap, isOrgAdmin, type Viewer } from "./access";

/**
 * "Add data" from the portal into a Felt map.
 *
 * Files: the browser PUTs the file to BC's S3 bucket with a presigned URL that
 * fixes its exact size (so plan limits hold), then Felt imports it from a
 * short-lived signed link. Once Felt finishes, the S3 copy is deleted — Felt
 * keeps its own copy as the layer's data.
 *
 * Links: passed straight to Felt's URL import (Google Sheets, hosted files,
 * ArcGIS services, …). Felt fetches them, not us.
 *
 * Who: org owners/admins and BC staff, on maps they can view.
 */

const UPLOAD_PREFIX = `${SYSTEM_PREFIX}uploads`;

/** File types Felt can turn into layers that we accept from the portal. */
export const ALLOWED_EXTENSIONS = [
  "csv", "xlsx", "xls", "geojson", "json", "kml", "kmz", "gpx", "gpkg", "zip", "parquet", "tif", "tiff",
] as const;

export class UploadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface FeltUploadResponse {
  layer_id?: string;
  layer_group_id?: string;
}

interface FeltLayerStatus {
  status: "uploading" | "processing" | "failed" | "completed";
  progress?: number;
}

export interface UploadQuota {
  tier: PlanTier;
  maxFileBytes: number;
  maxUploadsPerMap: number | null;
  used: number;
}

/**
 * A reserved file upload whose browser PUT never completed (closed tab,
 * network or CORS error) is abandoned after this long: it stops counting
 * toward the plan limit and is shown as not uploaded.
 */
const ABANDON_AFTER_MS = 15 * 60 * 1000;

export function isAbandoned(u: Pick<MapUpload, "status" | "createdAt">): boolean {
  return u.status === "PENDING_UPLOAD" && Date.now() - u.createdAt.getTime() > ABANDON_AFTER_MS;
}

/**
 * Uploads that count toward the per-map limit: imports that started or
 * finished, plus file uploads reserved in the last few minutes (so parallel
 * attempts can't exceed the limit). Failed and abandoned ones don't count.
 */
function countedUploads(mapId: string) {
  return db.mapUpload.count({
    where: {
      mapId,
      OR: [
        { status: { in: ["IMPORTING", "COMPLETED"] } },
        { status: "PENDING_UPLOAD", createdAt: { gt: new Date(Date.now() - ABANDON_AFTER_MS) } },
      ],
    },
  });
}

export async function getUploadQuota(orgId: string, mapId: string): Promise<UploadQuota> {
  const [tier, used] = await Promise.all([getOrgTier(orgId), countedUploads(mapId)]);
  return { tier, ...UPLOAD_LIMITS[tier], used };
}

async function authorize(viewer: Viewer, feltMapId: string) {
  if (viewer.role !== "BC_STAFF" && !isOrgAdmin(viewer)) {
    throw new UploadError("Only organization owners and admins can add data", 403);
  }
  const access = await getViewableMap(viewer, feltMapId);
  if (!access) throw new UploadError("Map not found", 404);
  return access.map;
}

async function enforceCount(orgId: string, mapId: string) {
  const quota = await getUploadQuota(orgId, mapId);
  if (quota.maxUploadsPerMap !== null && quota.used >= quota.maxUploadsPerMap) {
    throw new UploadError(
      `This map has reached the ${quota.maxUploadsPerMap}-upload limit for your plan. Contact BC to upgrade.`,
      409
    );
  }
  return quota;
}

function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
  return cleaned.slice(-120) || "upload";
}

function extensionOf(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "";
}

/** Step 1 (files): reserve an upload and return a size-locked S3 PUT URL. */
export async function startFileUpload(
  viewer: Viewer,
  feltMapId: string,
  input: { fileName: string; sizeBytes: number; layerName: string; confirmed: boolean }
): Promise<{ uploadId: string; putUrl: string }> {
  const map = await authorize(viewer, feltMapId);
  if (!input.confirmed) throw new UploadError("Please confirm the file doesn't contain personal or sensitive data", 400);

  const ext = extensionOf(input.fileName);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UploadError(
      `.${ext || "?"} files aren't supported here. Use CSV, Excel, GeoJSON, KML/KMZ, GPX, GeoPackage, GeoTIFF, Parquet, or a .zip (for Shapefiles).`,
      400
    );
  }

  const quota = await enforceCount(map.orgId, map.id);
  if (input.sizeBytes <= 0) throw new UploadError("That file is empty", 400);
  if (input.sizeBytes > quota.maxFileBytes) {
    throw new UploadError(
      `That file is ${formatBytes(input.sizeBytes)}. Your plan allows files up to ${formatBytes(quota.maxFileBytes)}.`,
      413
    );
  }

  const upload = await db.mapUpload.create({
    data: {
      orgId: map.orgId,
      mapId: map.id,
      userId: viewer.id,
      kind: "FILE",
      layerName: input.layerName,
      fileName: input.fileName,
      sizeBytes: BigInt(input.sizeBytes),
      confirmedNoSensitiveData: true,
    },
  });
  // The key ends with the original file name so Felt can tell the format
  // from the link's path.
  const s3Key = `${UPLOAD_PREFIX}/${map.orgId}/${upload.id}/${safeFileName(input.fileName)}`;
  await db.mapUpload.update({ where: { id: upload.id }, data: { s3Key } });

  return { uploadId: upload.id, putUrl: await getSizedUploadUrl(s3Key, input.sizeBytes, SYSTEM_BUCKET) };
}

async function getOwnedUpload(viewer: Viewer, feltMapId: string, uploadId: string): Promise<MapUpload> {
  const map = await authorize(viewer, feltMapId);
  const upload = await db.mapUpload.findUnique({ where: { id: uploadId } });
  if (!upload || upload.mapId !== map.id) throw new UploadError("Upload not found", 404);
  return upload;
}

async function importIntoFelt(feltMapId: string, layerName: string, importUrl: string): Promise<string | null> {
  const res = await feltFetch<FeltUploadResponse>(`/maps/${encodeURIComponent(feltMapId)}/upload`, {
    method: "POST",
    body: { name: layerName, import_url: importUrl },
  });
  return res.layer_id ?? null;
}

/** Step 2 (files): the browser finished the PUT; verify it and hand it to Felt. */
export async function completeFileUpload(viewer: Viewer, feltMapId: string, uploadId: string): Promise<MapUpload> {
  const upload = await getOwnedUpload(viewer, feltMapId, uploadId);
  if (upload.kind !== "FILE" || !upload.s3Key) throw new UploadError("Not a file upload", 400);
  if (upload.status !== "PENDING_UPLOAD") return upload;

  const size = await getObjectSize(upload.s3Key, SYSTEM_BUCKET);
  if (size === null || size !== Number(upload.sizeBytes)) {
    return fail(upload, "The file didn't finish uploading. Please try again.");
  }

  // Long enough for Felt to fetch it; Felt keeps its own copy afterwards.
  const importUrl = await getViewUrl(upload.s3Key, SYSTEM_BUCKET);
  try {
    const layerId = await importIntoFelt(feltMapId, upload.layerName, importUrl);
    return db.mapUpload.update({ where: { id: upload.id }, data: { status: "IMPORTING", feltLayerId: layerId } });
  } catch (err) {
    console.error(`Felt import failed for upload ${upload.id}:`, err);
    return fail(upload, "Felt couldn't read that file. Check the format and try again.");
  }
}

/** Links: one step. Felt fetches the URL itself. */
export async function startUrlUpload(
  viewer: Viewer,
  feltMapId: string,
  input: { url: string; layerName: string; confirmed: boolean }
): Promise<MapUpload> {
  const map = await authorize(viewer, feltMapId);
  if (!input.confirmed) throw new UploadError("Please confirm the data doesn't contain personal or sensitive data", 400);
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new UploadError("That isn't a valid link", 400);
  }
  if (parsed.protocol !== "https:") throw new UploadError("Links must start with https://", 400);
  await enforceCount(map.orgId, map.id);

  const upload = await db.mapUpload.create({
    data: {
      orgId: map.orgId,
      mapId: map.id,
      userId: viewer.id,
      kind: "URL",
      layerName: input.layerName,
      sourceUrl: parsed.toString(),
      confirmedNoSensitiveData: true,
    },
  });
  try {
    const layerId = await importIntoFelt(feltMapId, input.layerName, parsed.toString());
    return db.mapUpload.update({ where: { id: upload.id }, data: { status: "IMPORTING", feltLayerId: layerId } });
  } catch (err) {
    console.error(`Felt URL import failed for upload ${upload.id}:`, err);
    return fail(upload, "Felt couldn't read data from that link. Make sure it's public and a supported format.");
  }
}

/**
 * Poll an import; on finish, record the result and delete the S3 copy.
 * `completedNow` is true only on the poll that saw it finish.
 */
export async function refreshUploadStatus(
  viewer: Viewer,
  feltMapId: string,
  uploadId: string
): Promise<{ upload: MapUpload; completedNow: boolean }> {
  const upload = await getOwnedUpload(viewer, feltMapId, uploadId);
  if (upload.status !== "IMPORTING" || !upload.feltLayerId) return { upload, completedNow: false };

  const layer = await feltFetch<FeltLayerStatus>(
    `/maps/${encodeURIComponent(feltMapId)}/layers/${encodeURIComponent(upload.feltLayerId)}`
  );
  if (layer.status === "completed") {
    await cleanup(upload);
    const done = await db.mapUpload.update({ where: { id: upload.id }, data: { status: "COMPLETED" } });
    return { upload: done, completedNow: true };
  }
  if (layer.status === "failed") {
    const failed = await fail(upload, "Felt couldn't process that data. Check the file's format and contents.");
    return { upload: failed, completedNow: false };
  }
  return { upload, completedNow: false };
}

async function cleanup(upload: MapUpload) {
  if (!upload.s3Key) return;
  await deleteFile(upload.s3Key, SYSTEM_BUCKET).catch((err) => console.error(`Failed to delete upload ${upload.s3Key}:`, err));
}

async function fail(upload: MapUpload, message: string): Promise<MapUpload> {
  await cleanup(upload);
  return db.mapUpload.update({ where: { id: upload.id }, data: { status: "FAILED", error: message } });
}

export function serializeUpload(u: MapUpload) {
  const abandoned = isAbandoned(u);
  return {
    id: u.id,
    kind: u.kind,
    layerName: u.layerName,
    fileName: u.fileName,
    sourceUrl: u.sourceUrl,
    status: abandoned ? ("FAILED" as const) : u.status,
    error: abandoned ? "Not uploaded" : u.error,
    createdAt: u.createdAt.toISOString(),
  };
}
