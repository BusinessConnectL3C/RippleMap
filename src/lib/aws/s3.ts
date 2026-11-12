import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const DEFAULT_BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * RippleMap's own files (map thumbnails, in-flight data uploads) live under
 * this prefix in SYSTEM_BUCKET. They contain every client's data, so they
 * must never appear in an org's Media page: listings below always skip this
 * prefix, and src/lib/aws/media.ts refuses media scopes that could reach it.
 *
 * SYSTEM_BUCKET defaults to AWS_S3_BUCKET; set RIPPLEMAP_SYSTEM_BUCKET to keep
 * system files in a separate bucket that no org's media points at.
 */
export const SYSTEM_PREFIX = "ripplemap-system/";
export const SYSTEM_BUCKET = process.env.RIPPLEMAP_SYSTEM_BUCKET || DEFAULT_BUCKET;
export const SHARED_MEDIA_BUCKET = DEFAULT_BUCKET;

function isSystemKey(key: string): boolean {
  return key.startsWith(SYSTEM_PREFIX);
}

/** Generate a presigned URL to upload a file directly to S3 (valid for 5 minutes). */
export async function getUploadUrl(
  key: string,
  contentType: string,
  bucket = DEFAULT_BUCKET
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

/** Generate a presigned URL to view a file from S3 in the browser (valid for 1 hour). */
export async function getViewUrl(key: string, bucket = DEFAULT_BUCKET): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/** Generate a presigned URL that forces a file download (Content-Disposition: attachment). */
export async function getDownloadUrl(key: string, bucket = DEFAULT_BUCKET): Promise<string> {
  const filename = key.split("/").pop() ?? key;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/** Delete a file from S3. */
export async function deleteFile(key: string, bucket = DEFAULT_BUCKET): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export interface S3FileInfo {
  key: string;
  filename: string;
  folder: string;
  size: number;
  lastModified: Date;
  viewUrl: string;
  downloadUrl: string;
}

export interface S3FilePage {
  files: S3FileInfo[];
  nextCursor: string | null;
}

/** Return one page of files with presigned URLs. Pass cursor for subsequent pages. */
export async function listFilesPage(
  prefix: string,
  bucket: string,
  limit = 50,
  cursor?: string
): Promise<S3FilePage> {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: limit + 10, // fetch a few extra to skip folder placeholder keys
    ContinuationToken: cursor,
  });
  const response = await client.send(command);

  const files: S3FileInfo[] = [];
  for (const obj of response.Contents ?? []) {
    if (!obj.Key || obj.Key === prefix || obj.Key.endsWith("/") || isSystemKey(obj.Key)) continue;
    const relativePath = obj.Key.slice(prefix.length);
    const parts = relativePath.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const [viewUrl, downloadUrl] = await Promise.all([
      getViewUrl(obj.Key, bucket),
      getDownloadUrl(obj.Key, bucket),
    ]);
    files.push({
      key: obj.Key,
      filename: relativePath,
      folder,
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
      viewUrl,
      downloadUrl,
    });
    if (files.length === limit) break;
  }

  return {
    files,
    nextCursor: response.NextContinuationToken ?? null,
  };
}

/** List all unique folder paths under a prefix (keys only, no presigned URLs — fast). */
export async function listFolders(prefix: string, bucket: string): Promise<string[]> {
  const folders = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await client.send(command);

    for (const obj of response.Contents ?? []) {
      if (!obj.Key || obj.Key === prefix || obj.Key.endsWith("/") || isSystemKey(obj.Key)) continue;
      const relativePath = obj.Key.slice(prefix.length);
      const parts = relativePath.split("/");
      if (parts.length > 1) {
        folders.add(parts.slice(0, -1).join("/"));
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(folders).sort();
}

/** Upload a file from the server (for server-generated assets, e.g. map thumbnails). */
export async function putFile(
  key: string,
  body: Uint8Array,
  contentType: string,
  bucket = DEFAULT_BUCKET
): Promise<void> {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

/**
 * Presigned PUT for a browser upload of exactly `sizeBytes`. Content-Length is
 * part of the signature, so S3 rejects a body of any other size.
 */
export async function getSizedUploadUrl(
  key: string,
  sizeBytes: number,
  bucket = DEFAULT_BUCKET,
  expiresIn = 600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: "application/octet-stream",
    ContentLength: sizeBytes,
  });
  return getSignedUrl(client, command, { expiresIn, signableHeaders: new Set(["content-length", "content-type"]) });
}

/** Object size in bytes, or null if it doesn't exist. */
export async function getObjectSize(key: string, bucket = DEFAULT_BUCKET): Promise<number | null> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}
