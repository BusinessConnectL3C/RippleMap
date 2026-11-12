import "server-only";
import { SHARED_MEDIA_BUCKET, SYSTEM_BUCKET, SYSTEM_PREFIX } from "./s3";

/**
 * Which S3 bucket + prefix an org's Media page may list. This is the tenant
 * boundary for media, so it fails closed:
 *
 * - A prefix always ends in "/", so "acme" can't also match "acme-two/…".
 * - In the shared bucket (AWS_S3_BUCKET) an org must have a non-empty prefix;
 *   an empty prefix would list every org's files.
 * - No scope may reach RippleMap's system files (thumbnails, uploads).
 *
 * A dedicated per-org bucket may use an empty prefix (the whole bucket is
 * theirs) unless it is also the system bucket.
 */
export interface MediaScope {
  bucket: string;
  prefix: string;
}

export type MediaScopeResult = { ok: true; scope: MediaScope } | { ok: false; reason: string };

export function normalizeMediaPrefix(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function checkMediaScope(bucket: string | null | undefined, rawPrefix: string | null | undefined): MediaScopeResult {
  const b = (bucket ?? "").trim() || SHARED_MEDIA_BUCKET;
  const prefix = normalizeMediaPrefix(rawPrefix);
  const shared = b === SHARED_MEDIA_BUCKET || b === SYSTEM_BUCKET;

  if (shared && !prefix) {
    return { ok: false, reason: "Orgs in the shared bucket need their own folder prefix (e.g. orgs/acme/)." };
  }
  if (prefix.startsWith(SYSTEM_PREFIX) || prefix.includes("..")) {
    return { ok: false, reason: `The prefix can't point at RippleMap's system folder (${SYSTEM_PREFIX}).` };
  }
  return { ok: true, scope: { bucket: b, prefix } };
}

/** Media scope for an org, or null if media is off or misconfigured (logged). */
export function getOrgMediaScope(org: {
  id?: string;
  mediaSource: string | null;
  s3Bucket: string | null;
  s3Prefix: string | null;
}): MediaScope | null {
  if (org.mediaSource !== "S3") return null;
  const result = checkMediaScope(org.s3Bucket, org.s3Prefix);
  if (!result.ok) {
    console.error(`Media scope refused for org ${org.id ?? "?"}: ${result.reason}`);
    return null;
  }
  return result.scope;
}
