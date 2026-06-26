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

const BUCKET = process.env.AWS_S3_BUCKET!;

/** Generate a presigned URL to upload a file directly to S3 (valid for 5 minutes). */
export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

/** Generate a presigned URL to download a file from S3 (valid for 1 hour). */
export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/** Delete a file from S3. */
export async function deleteFile(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export interface S3FileInfo {
  key: string;
  filename: string;
  size: number;
  lastModified: Date;
  downloadUrl: string;
}

/** List all objects under a prefix and return them with fresh presigned download URLs. */
export async function listFiles(prefix: string): Promise<S3FileInfo[]> {
  const results: S3FileInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await client.send(command);

    for (const obj of response.Contents ?? []) {
      if (!obj.Key || obj.Key === prefix) continue; // skip the folder key itself
      const downloadUrl = await getDownloadUrl(obj.Key);
      results.push({
        key: obj.Key,
        filename: obj.Key.slice(prefix.length),
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(),
        downloadUrl,
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return results;
}
