import "server-only";
import { randomBytes } from "node:crypto";
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
  last_refreshed_at?: string | null;
  attributes?: Array<{ name: string; type?: string }> | null;
}

/** How long the permanent source address answers after an import is started. */
const SOURCE_ARM_MS = 30 * 60 * 1000;

/** Permanent address Felt imports an uploaded layer from (see sourceToken). */
function sourceUrl(origin: string, token: string, fileName: string): string {
  return new URL(`/api/felt/sources/${token}/${encodeURIComponent(safeFileName(fileName))}`, origin).toString();
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
  input: { fileName: string; sizeBytes: number; layerName?: string; confirmed: boolean; replacesUploadId?: string }
): Promise<{ uploadId: string; putUrl: string }> {
  const map = await authorize(viewer, feltMapId);
  if (!input.confirmed) throw new UploadError("Please confirm the file doesn't contain personal or sensitive data", 400);

  const ext = extensionOf(input.fileName);
  const origin = input.replacesUploadId ? await getReplaceableOrigin(map.id, input.replacesUploadId) : null;
  if (origin) {
    if (origin.kind !== "FILE") throw new UploadError("That layer came from a link. Use Refresh from link instead.", 400);
    const originExt = extensionOf(origin.fileName ?? "");
    if (originExt && ext !== originExt) {
      throw new UploadError(`Replace this layer with a .${originExt} file, the same type it was created from.`, 400);
    }
  }
  const layerName = origin?.layerName ?? input.layerName?.trim();
  if (!layerName) throw new UploadError("Give the layer a name", 400);
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
      layerName,
      fileName: input.fileName,
      sizeBytes: BigInt(input.sizeBytes),
      confirmedNoSensitiveData: true,
      ...(origin && { mode: "REPLACE" as const, replacesUploadId: origin.id }),
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

/**
 * Step 2 (files): the browser finished the PUT; verify it and hand it to Felt.
 * `siteOrigin` is the portal's public origin, used to build the permanent
 * source address Felt imports from.
 */
export async function completeFileUpload(
  viewer: Viewer,
  feltMapId: string,
  uploadId: string,
  siteOrigin: string
): Promise<MapUpload> {
  const upload = await getOwnedUpload(viewer, feltMapId, uploadId);
  if (upload.kind !== "FILE" || !upload.s3Key) throw new UploadError("Not a file upload", 400);
  if (upload.status !== "PENDING_UPLOAD") return upload;

  const size = await getObjectSize(upload.s3Key, SYSTEM_BUCKET);
  if (size === null || size !== Number(upload.sizeBytes)) {
    return fail(upload, "The file didn't finish uploading. Please try again.");
  }

  const armedUntil = new Date(Date.now() + SOURCE_ARM_MS);

  if (upload.mode === "REPLACE" && upload.replacesUploadId) {
    const origin = await db.mapUpload.findUnique({ where: { id: upload.replacesUploadId } });
    if (!origin?.sourceToken || !origin.feltLayerId) return fail(upload, "That layer can no longer be replaced.");
    // Point the layer's permanent source at the new file, then ask Felt to
    // re-fetch it. Felt replaces all of the layer's data.
    await db.mapUpload.update({
      where: { id: origin.id },
      data: { sourceKey: upload.s3Key, sourceArmedUntil: armedUntil },
    });
    try {
      const requestedAt = new Date();
      await requestLayerRefresh(feltMapId, origin.feltLayerId);
      return db.mapUpload.update({
        where: { id: upload.id },
        data: { status: "IMPORTING", feltLayerId: origin.feltLayerId, refreshRequestedAt: requestedAt },
      });
    } catch (err) {
      console.error(`Felt refresh failed for upload ${upload.id}:`, err);
      await disarmSource(origin.id);
      return fail(upload, "Felt couldn't replace the layer's data. Please try again.");
    }
  }

  // New layer: Felt imports from this upload's permanent source address.
  const token = randomBytes(32).toString("base64url");
  await db.mapUpload.update({
    where: { id: upload.id },
    data: { sourceToken: token, sourceKey: upload.s3Key, sourceArmedUntil: armedUntil },
  });
  try {
    const layerId = await importIntoFelt(feltMapId, upload.layerName, sourceUrl(siteOrigin, token, upload.fileName ?? "data"));
    return db.mapUpload.update({ where: { id: upload.id }, data: { status: "IMPORTING", feltLayerId: layerId } });
  } catch (err) {
    console.error(`Felt import failed for upload ${upload.id}:`, err);
    return fail(upload, "Felt couldn't read that file. Check the format and try again.");
  }
}

async function requestLayerRefresh(feltMapId: string, feltLayerId: string): Promise<void> {
  await feltFetch(`/maps/${encodeURIComponent(feltMapId)}/layers/${encodeURIComponent(feltLayerId)}/refresh`, {
    method: "POST",
  });
}

async function disarmSource(originId: string) {
  await db.mapUpload.update({ where: { id: originId }, data: { sourceKey: null, sourceArmedUntil: null } });
}

/**
 * An upload that created a layer which can still be replaced: on this map,
 * finished, created after permanent sources existed (or from a link), and
 * with no other replacement of it in flight.
 */
async function getReplaceableOrigin(mapId: string, originId: string): Promise<MapUpload> {
  const origin = await db.mapUpload.findUnique({ where: { id: originId } });
  if (
    !origin ||
    origin.mapId !== mapId ||
    origin.mode !== "NEW" ||
    origin.status !== "COMPLETED" ||
    !origin.feltLayerId ||
    (origin.kind === "FILE" && !origin.sourceToken)
  ) {
    throw new UploadError("That layer can't be replaced from the portal.", 400);
  }
  const busy = await db.mapUpload.count({
    where: {
      replacesUploadId: origin.id,
      OR: [
        { status: "IMPORTING" },
        { status: "PENDING_UPLOAD", createdAt: { gt: new Date(Date.now() - ABANDON_AFTER_MS) } },
      ],
    },
  });
  if (busy > 0) throw new UploadError("That layer is already being updated. Wait for it to finish.", 409);
  return origin;
}

/** Link layers: ask Felt to re-fetch the original link (Felt can't change it). */
export async function refreshFromLink(
  viewer: Viewer,
  feltMapId: string,
  input: { replacesUploadId: string; confirmed: boolean }
): Promise<MapUpload> {
  const map = await authorize(viewer, feltMapId);
  if (!input.confirmed) throw new UploadError("Please confirm the data doesn't contain personal or sensitive data", 400);
  const origin = await getReplaceableOrigin(map.id, input.replacesUploadId);
  if (origin.kind !== "URL" || !origin.feltLayerId) throw new UploadError("That layer wasn't added from a link", 400);
  await enforceCount(map.orgId, map.id);

  const upload = await db.mapUpload.create({
    data: {
      orgId: map.orgId,
      mapId: map.id,
      userId: viewer.id,
      kind: "URL",
      mode: "REPLACE",
      replacesUploadId: origin.id,
      layerName: origin.layerName,
      sourceUrl: origin.sourceUrl,
      confirmedNoSensitiveData: true,
    },
  });
  try {
    const requestedAt = new Date();
    await requestLayerRefresh(feltMapId, origin.feltLayerId);
    return db.mapUpload.update({
      where: { id: upload.id },
      data: { status: "IMPORTING", feltLayerId: origin.feltLayerId, refreshRequestedAt: requestedAt },
    });
  } catch (err) {
    console.error(`Felt link refresh failed for upload ${upload.id}:`, err);
    return fail(upload, "Felt couldn't refresh from that link. Make sure it's still public.");
  }
}

export interface ReplaceableLayer {
  uploadId: string;
  layerName: string;
  kind: "FILE" | "URL";
  fileExt: string | null;
  sourceUrl: string | null;
  /** Column names Felt currently has for the layer (geometry excluded). */
  columns: string[];
}

/**
 * Layers on this map that came from portal uploads and can be replaced.
 * Layers deleted in Felt are left out. One Felt call per layer.
 */
export async function listReplaceableLayers(viewer: Viewer, feltMapId: string): Promise<ReplaceableLayer[]> {
  const map = await authorize(viewer, feltMapId);
  const origins = await db.mapUpload.findMany({
    where: {
      mapId: map.id,
      mode: "NEW",
      status: "COMPLETED",
      feltLayerId: { not: null },
      OR: [{ kind: "URL" }, { kind: "FILE", sourceToken: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const results = await Promise.all(
    origins.map(async (o): Promise<ReplaceableLayer | null> => {
      try {
        const layer = await feltFetch<FeltLayerStatus>(
          `/maps/${encodeURIComponent(feltMapId)}/layers/${encodeURIComponent(o.feltLayerId!)}`
        );
        return {
          uploadId: o.id,
          layerName: o.layerName,
          kind: o.kind,
          fileExt: o.fileName ? extensionOf(o.fileName) || null : null,
          sourceUrl: o.kind === "URL" ? o.sourceUrl : null,
          columns: (layer.attributes ?? []).filter((a) => a.type !== "GEOMETRY").map((a) => a.name),
        };
      } catch {
        return null; // deleted in Felt, or unreachable
      }
    })
  );
  return results.filter((r): r is ReplaceableLayer => r !== null);
}

/** The file Felt should fetch for a permanent source address, if it's armed. */
export async function resolveSource(token: string): Promise<string | null> {
  const origin = await db.mapUpload.findUnique({
    where: { sourceToken: token },
    select: { sourceKey: true, sourceArmedUntil: true },
  });
  if (!origin?.sourceKey || !origin.sourceArmedUntil || origin.sourceArmedUntil < new Date()) return null;
  if (!origin.sourceKey.startsWith(`${UPLOAD_PREFIX}/`)) return null;
  return getViewUrl(origin.sourceKey, SYSTEM_BUCKET);
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

  // A replaced layer was already "completed" before the refresh: only count it
  // done once Felt reports data newer than our refresh request.
  if (upload.mode === "REPLACE" && layer.status === "completed" && upload.refreshRequestedAt) {
    const refreshedAt = layer.last_refreshed_at ? Date.parse(layer.last_refreshed_at) : NaN;
    if (!(refreshedAt >= upload.refreshRequestedAt.getTime() - 5000)) return { upload, completedNow: false };
  }

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
  // Close the permanent source address until the next replacement.
  const originId = upload.mode === "REPLACE" ? upload.replacesUploadId : upload.sourceToken ? upload.id : null;
  if (originId) await disarmSource(originId).catch(() => {});
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
    mode: u.mode,
    status: abandoned ? ("FAILED" as const) : u.status,
    error: abandoned ? "Not uploaded" : u.error,
    createdAt: u.createdAt.toISOString(),
  };
}
