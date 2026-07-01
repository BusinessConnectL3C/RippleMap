import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
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

/** List all objects under a prefix and return them with presigned view + download URLs. */
export async function listFiles(prefix: string, bucket = DEFAULT_BUCKET): Promise<S3FileInfo[]> {
  const results: S3FileInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await client.send(command);

    for (const obj of response.Contents ?? []) {
      if (!obj.Key || obj.Key === prefix) continue;
      const relativePath = obj.Key.slice(prefix.length);
      const parts = relativePath.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      const [viewUrl, downloadUrl] = await Promise.all([
        getViewUrl(obj.Key, bucket),
        getDownloadUrl(obj.Key, bucket),
      ]);
      results.push({
        key: obj.Key,
        filename: relativePath,
        folder,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
        viewUrl,
        downloadUrl,
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return results;
}
